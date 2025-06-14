
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TransactionVerifyRequest {
  userId: string;
  amount: number;
  taskId: string;
  boostId?: string;
  taskType?: string;
  comment?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Transaction verification request received");
    
    // Get the request body
    const requestBody = await req.json();
    console.log("Request body:", requestBody);
    
    const { userId, amount, taskId, boostId, taskType, comment } = requestBody as TransactionVerifyRequest;

    if (!userId || !amount || ((!taskId && !boostId))) {
      console.log("Missing required parameters:", { userId, amount, taskId, boostId });
      return new Response(
        JSON.stringify({ success: false, message: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Get receiver wallet address (our address to receive payments)
    const tonWalletAddress = "UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C";
    
    // Get TON API key from environment
    const tonApiKey = Deno.env.get("TON_API_KEY");
    if (!tonApiKey) {
      console.log("TON_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, message: "TON API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user's wallet address - try multiple sources for reliability
    let userWalletAddress: string | null = null;
    
    console.log(`Searching for wallet address for user ID: ${userId}`);
    
    // Try wallets table first (most reliable)
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("wallet_address")
      .eq("telegram_id", userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (walletData?.wallet_address) {
      userWalletAddress = walletData.wallet_address;
      console.log(`Found wallet address in wallets table: ${userWalletAddress}`);
    } else {
      console.log("Wallet not found in wallets table, checking users.links");
      // Fall back to users table
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("links")
        .eq("id", userId)
        .maybeSingle();

      if (userData?.links) {
        userWalletAddress = userData.links;
        console.log(`Found wallet address in users table: ${userWalletAddress}`);
      }
    }

    if (!userWalletAddress) {
      console.log("User wallet not found - this is the main issue!");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "User wallet not found. Please reconnect your wallet.",
          error: "No wallet address found for this user. Please disconnect and reconnect your TON wallet.",
          debug: {
            userId,
            walletTableResult: walletData,
            walletTableError: walletError?.message
          }
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Checking transactions from ${userWalletAddress} to ${tonWalletAddress}`);
    
    // Format amount for comparison (convert to nanoTONs)
    const expectedAmountNano = Math.floor(amount * 1000000000);
    const expectedComment = comment || (boostId ? `boost_${boostId}` : taskId ? `task${taskId}` : "");
    
    console.log(`Looking for transaction with: amount=${expectedAmountNano} nanoTON, comment=${expectedComment || "(none)"}`);
    
    let matchingTx: any = null;
    let senderAddress: string | null = null;
    
    // Check transactions using tonapi.io with improved logic
    try {
      console.log("Checking transactions using tonapi.io...");
      
      // Convert wallet address to different formats for better matching
      let searchWallets = [userWalletAddress];
      
      // If wallet starts with "0:", also try without the "0:" prefix
      if (userWalletAddress.startsWith("0:")) {
        const withoutPrefix = userWalletAddress.substring(2);
        searchWallets.push(withoutPrefix);
      }
      
      // Try EQ format if not already
      if (!userWalletAddress.startsWith("EQ") && !userWalletAddress.startsWith("UQ")) {
        const eqFormat = "EQ" + (userWalletAddress.startsWith("0:") ? userWalletAddress.substring(2) : userWalletAddress);
        searchWallets.push(eqFormat);
      }
      
      console.log("Searching with wallet formats:", searchWallets);
      
      for (const walletAddr of searchWallets) {
        console.log(`Trying wallet format: ${walletAddr}`);
        
        const tonapiResponse = await fetch(`https://tonapi.io/v2/accounts/${walletAddr}/transactions?limit=50`, {
          headers: {
            'Authorization': `Bearer ${tonApiKey}`
          }
        });
        
        if (tonapiResponse.ok) {
          const data = await tonapiResponse.json();
          console.log(`Found ${data.transactions?.length || 0} transactions for ${walletAddr}`);
          
          const transactions = data.transactions || [];
          
          // Find matching transaction with improved logic
          matchingTx = transactions.find((tx: any) => {
            // Check if this is an outgoing transaction
            const isOutgoing = tx.out_msgs && tx.out_msgs.length > 0;
            if (!isOutgoing) return false;
            
            // Check for messages to our wallet address
            const hasMatchingDestination = tx.out_msgs.some((msg: any) => {
              const destination = msg.destination || msg.address;
              return destination === tonWalletAddress || 
                     destination === `0:${tonWalletAddress.substring(2)}` ||
                     destination === `EQ${tonWalletAddress.substring(2)}` ||
                     destination === `UQ${tonWalletAddress.substring(2)}`;
            });
            
            if (!hasMatchingDestination) {
              console.log("Transaction destination doesn't match our wallet");
              return false;
            }
            
            // Check for matching amount with tolerance
            const hasMatchingAmount = tx.out_msgs.some((msg: any) => {
              const msgValue = parseInt(msg.value || "0");
              const diff = Math.abs(msgValue - expectedAmountNano);
              const tolerance = Math.max(1000000, expectedAmountNano * 0.02); // 2% tolerance or 0.001 TON
              
              console.log(`Comparing amounts: msg=${msgValue}, expected=${expectedAmountNano}, diff=${diff}, tolerance=${tolerance}`);
              
              return diff < tolerance;
            });
            
            if (!hasMatchingAmount) {
              console.log("Transaction amount doesn't match");
              return false;
            }
            
            // Check comment if provided
            if (expectedComment) {
              const hasMatchingComment = tx.out_msgs.some((msg: any) => {
                if (!msg.message) return false;
                const msgText = typeof msg.message === 'string' ? msg.message : 
                               msg.message.body ? msg.message.body : '';
                return msgText.includes(expectedComment);
              });
              
              if (!hasMatchingComment) {
                console.log("Transaction comment doesn't match");
                return false;
              }
            }
            
            // Check if transaction is recent (within last 60 minutes)
            const txTime = new Date(tx.utime * 1000);
            const timeDiff = Date.now() - txTime.getTime();
            const isRecent = timeDiff < 60 * 60 * 1000; // 60 minutes
            
            if (!isRecent) {
              console.log(`Transaction from ${txTime.toISOString()} is too old (${Math.floor(timeDiff/1000/60)} minutes ago)`);
              return false;
            }
            
            console.log("Found matching transaction:", tx.hash || tx.transaction_id);
            senderAddress = walletAddr;
            return true;
          });
          
          if (matchingTx) {
            console.log("Transaction found, breaking search");
            break;
          }
        } else {
          console.log(`tonapi.io request failed for ${walletAddr}:`, tonapiResponse.status);
        }
      }
      
    } catch (error) {
      console.log("Error with tonapi.io:", error);
    }
    
    if (!matchingTx) {
      // No matching transaction found
      console.log("No matching transaction found");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "No matching transaction found. Please ensure you sent the correct amount to the correct address.",
          expected: {
            amount: expectedAmountNano,
            amountTON: amount,
            receiver: tonWalletAddress,
            sender: userWalletAddress,
            comment: expectedComment || "(none)",
            userId: userId,
            taskId: taskId,
            boostId: boostId
          },
          debug: {
            userWallet: userWalletAddress,
            ourWallet: tonWalletAddress,
            expectedAmountNano,
            expectedComment
          }
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Process verified transaction
    const txHash = matchingTx.hash || matchingTx.transaction_id;
    console.log(`Transaction verified with hash: ${txHash}`);
    
    // Update payment record with transaction hash
    console.log("Updating payment record with transaction hash");
    const { error: paymentUpdateError } = await supabaseAdmin
      .from("payments")
      .update({ 
        transaction_hash: txHash,
        telegram_id: userId,
        wallet_address: senderAddress || userWalletAddress
      })
      .eq("telegram_id", userId)
      .eq("task_type", taskType || taskId || "boost")
      .is("transaction_hash", null);
    
    if (paymentUpdateError) {
      console.error("Error updating payment record:", paymentUpdateError);
    } else {
      console.log("Payment record updated successfully");
    }
      
    return await processVerifiedTransaction(
      supabaseAdmin, 
      txHash, 
      userId, 
      boostId, 
      taskId, 
      taskType, 
      corsHeaders,
      senderAddress || userWalletAddress
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message,
        debug: "Check edge function logs for details"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function processVerifiedTransaction(
  supabaseAdmin: any, 
  txHash: string,
  userId: string,
  boostId?: string,
  taskId?: string,
  taskType?: string,
  corsHeaders: any = {},
  senderAddress?: string
) {
  console.log(`Processing verified transaction ${txHash} for user ${userId}`);
  console.log(`Task ID: ${taskId || "none"}, Boost ID: ${boostId || "none"}, Task Type: ${taskType || "none"}`);
  console.log(`Sender address: ${senderAddress || "unknown"}`);
  
  // Handle boost payment confirmation if boostId provided
  if (boostId) {
    console.log(`Confirming boost ${boostId} for user ${userId}`);
    
    const { data, error: updateError } = await supabaseAdmin
      .from("mining_boosts")
      .update({
        status: "confirmed",
        ton_tx: txHash,
        user_id: userId,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      })
      .eq("id", boostId)
      .eq("user_id", userId)
      .select();
    
    if (updateError) {
      console.error("Failed to confirm boost:", updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to confirm boost",
          error: updateError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log("Boost confirmed successfully:", data);
  }
  
  // Handle task completion if taskId provided
  if (taskId) {
    try {
      console.log(`Processing task ${taskId} completion for user ${userId}`);
      
      // Check if task already exists in tasks_completed
      const { data: existingTask } = await supabaseAdmin
        .from("tasks_completed")
        .select("*")
        .eq("user_id", userId)
        .eq("task_id", taskId)
        .maybeSingle();
      
      // If not already completed, add record
      if (!existingTask) {
        console.log("Adding task completion record");
        const { error: taskError } = await supabaseAdmin
          .from("tasks_completed")
          .insert({
            user_id: userId,
            task_id: taskId,
            is_done: true,
            tx_hash: txHash,
            verified_at: new Date().toISOString()
          });
          
        if (taskError) {
          console.error("Error recording task completion:", taskError);
        } else {
          console.log("Task completion record added successfully");
        }
      } else {
        console.log("Task already completed previously");
      }
    } catch (err) {
      console.error("Error handling task completion:", err);
    }
    
    if (taskId === "6") {
      // Special case: fortune cookies
      console.log("Processing fortune cookies purchase");
      const { data: cookieResult, error: cookieError } = await supabaseAdmin.rpc('add_fortune_cookies', { 
        p_user_id: userId, 
        p_cookie_count: 10 
      });
      
      if (cookieError) {
        console.error("Failed to add fortune cookies:", cookieError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Failed to add fortune cookies",
            error: cookieError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      console.log("Added fortune cookies successfully");
    } else {
      // Regular task - add KFC balance
      let reward = 0;
      switch (taskId) {
        case "3": reward = 100; break;
        case "4": reward = 1500; break;
        case "5": reward = 30000; break;
        default: reward = 0;
      }
      
      if (reward > 0) {
        console.log(`Processing reward of ${reward} KFC for task ${taskId}`);
        
        // Get current balance
        const { data: currentUser, error: balanceError } = await supabaseAdmin
          .from("users")
          .select("balance")
          .eq("id", userId)
          .maybeSingle();
          
        if (balanceError) {
          console.error("Failed to get user balance:", balanceError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: "Failed to get user balance",
              error: balanceError.message 
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        // Update balance
        const currentBalance = currentUser?.balance || 0;
        const newBalance = currentBalance + reward;
        console.log(`Updating user balance from ${currentBalance} to ${newBalance}`);
        
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({ balance: newBalance })
          .eq("id", userId);
          
        if (updateError) {
          console.error("Failed to update balance:", updateError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: "Failed to update balance",
              error: updateError.message 
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        console.log("Balance updated successfully");
      }
    }
  }
  
  // Record daily task completion if needed
  if (taskType === "daily_ton_payment") {
    try {
      console.log(`Recording daily task completion for ${userId}, type: ${taskType}`);
      const { error: dailyTaskError } = await supabaseAdmin
        .from("daily_tasks")
        .insert([{
          user_id: userId,
          task_type: taskType
        }]);
      
      if (dailyTaskError) {
        console.error("Failed to record daily task:", dailyTaskError);
      } else {
        console.log("Daily task recorded successfully");
      }
    } catch (err) {
      console.error("Failed to record daily task:", err);
    }
  }
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      transaction: {
        hash: txHash,
        time: new Date().toISOString(),
        senderAddress: senderAddress,
        telegramUserId: userId
      }
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
