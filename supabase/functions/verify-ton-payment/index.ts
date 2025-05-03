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

    // Get user's wallet address - first try from wallets table
    let userWalletAddress: string | null = null;
    
    // Try to get from wallets table first
    console.log(`Searching for wallet address for user ID: ${userId}`);
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
      // Fall back to users table
      console.log("Wallet not found in wallets table, checking users.links");
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
      console.log("User wallet not found:", walletError || "No wallet connected");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "User wallet not found",
          error: walletError?.message || "No wallet address found for this user"
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
    const expectedComment = comment || (taskId ? `task${taskId}` : "");
    
    console.log(`Looking for transaction with: amount=${expectedAmountNano} nanoTON, comment=${expectedComment || "(none)"}`);
    
    // First, try using tonapi.io
    try {
      console.log("Checking transactions using tonapi.io...");
      const tonapiResponse = await fetch(`https://tonapi.io/v2/accounts/${userWalletAddress}/transactions?limit=20`, {
        headers: {
          'Authorization': `Bearer ${tonApiKey}`
        }
      });
      
      if (tonapiResponse.ok) {
        const data = await tonapiResponse.json();
        console.log(`Found ${data.transactions?.length || 0} transactions in tonapi.io response`);
        
        const transactions = data.transactions || [];
        
        // Find matching transaction (sent to our wallet with correct amount)
        const matchingTx = transactions.find((tx: any) => {
          // Check if this is a transaction to our wallet
          const isToOurWallet = tx.out_msgs?.some((msg: any) => 
            msg.destination === tonWalletAddress
          );
          
          if (!isToOurWallet) return false;
          
          // Check for matching amount in any output message
          const hasMatchingAmount = tx.out_msgs?.some((msg: any) => {
            const diff = Math.abs(msg.value - expectedAmountNano);
            const isMatch = diff < 10000000; // Allow small rounding differences
            if (isMatch) {
              console.log(`Found matching amount: ${msg.value} (expected ${expectedAmountNano}), diff: ${diff}`);
            }
            return isMatch;
          });
          
          // Check if the message comment matches our expected comment if one was provided
          let hasMatchingComment = true;
          if (expectedComment) {
            hasMatchingComment = tx.out_msgs?.some((msg: any) => {
              if (!msg.message) return false;
              if (typeof msg.message === 'string') {
                const isMatch = msg.message.includes(expectedComment);
                if (isMatch) {
                  console.log(`Found matching comment: "${msg.message}" includes "${expectedComment}"`);
                }
                return isMatch;
              }
              return false;
            });
          }
          
          // Check if transaction is recent (within last 30 minutes)
          const txTime = new Date(tx.utime * 1000);
          const timeDiff = Date.now() - txTime.getTime();
          const isRecent = timeDiff < 30 * 60 * 1000;
          
          if (!isRecent) {
            console.log(`Transaction from ${txTime.toISOString()} is too old (${Math.floor(timeDiff/1000/60)} minutes ago)`);
          }
          
          const isMatch = isToOurWallet && hasMatchingAmount && hasMatchingComment && isRecent;
          if (isMatch) {
            console.log("Found matching transaction:", tx.hash);
          }
          
          return isMatch;
        });
        
        if (matchingTx) {
          // Process verified transaction
          const txHash = matchingTx.hash;
          console.log(`Transaction match found with hash: ${txHash}`);
          
          // Update payment record with transaction hash
          console.log("Updating payment record with transaction hash");
          await supabaseAdmin
            .from("payments")
            .update({ transaction_hash: txHash })
            .eq("telegram_id", userId)
            .eq("task_type", taskId || "boost")
            .is("transaction_hash", null);
            
          return await processVerifiedTransaction(
            supabaseAdmin, 
            txHash, 
            userId, 
            boostId, 
            taskId, 
            taskType, 
            corsHeaders
          );
        } else {
          console.log("No matching transaction found in tonapi.io response");
        }
      } else {
        console.log("tonapi.io request failed:", tonapiResponse.status);
      }
    } catch (error) {
      console.log("Error with tonapi.io:", error);
    }
    
    // If tonapi.io fails, try toncenter API as fallback
    try {
      console.log("Checking transactions using toncenter API...");
      const toncenterUrl = `https://toncenter.com/api/v2/getTransactions?address=${userWalletAddress}&limit=20&to_lt=0&archival=false`;
      const toncenterResponse = await fetch(toncenterUrl, {
        headers: {
          'X-API-Key': tonApiKey
        }
      });
      
      if (toncenterResponse.ok) {
        const data = await toncenterResponse.json();
        console.log(`Found ${data.result?.length || 0} transactions in toncenter response`);
        
        if (data.ok && data.result && Array.isArray(data.result)) {
          const transactions = data.result;
          
          // Find matching transaction (sent to our wallet with correct amount)
          const matchingTx = transactions.find((tx: any) => {
            if (!tx.out_msgs || !tx.out_msgs.length) return false;
            
            // Look for outgoing message to our wallet
            const matchingMsg = tx.out_msgs.find((msg: any) => {
              const isToOurWallet = msg.destination === tonWalletAddress;
              if (!isToOurWallet) return false;
              
              const msgValue = parseInt(msg.value);
              const diff = Math.abs(msgValue - expectedAmountNano);
              const hasMatchingAmount = diff < 10000000;
              
              if (hasMatchingAmount) {
                console.log(`Found matching amount: ${msgValue} (expected ${expectedAmountNano}), diff: ${diff}`);
              }
              
              // Check comment if expected
              let hasMatchingComment = true;
              if (expectedComment && msg.message) {
                hasMatchingComment = msg.message.includes(expectedComment);
                if (hasMatchingComment) {
                  console.log(`Found matching comment: "${msg.message}" includes "${expectedComment}"`);
                }
              }
              
              return isToOurWallet && hasMatchingAmount && hasMatchingComment;
            });
            
            // Check if transaction is recent (within last 30 minutes)
            const txTime = tx.utime ? new Date(tx.utime * 1000) : null;
            const timeDiff = txTime ? Date.now() - txTime.getTime() : 0;
            const isRecent = txTime && (timeDiff < 30 * 60 * 1000);
            
            if (!isRecent && txTime) {
              console.log(`Transaction from ${txTime.toISOString()} is too old (${Math.floor(timeDiff/1000/60)} minutes ago)`);
            }
            
            const isMatch = !!matchingMsg && isRecent;
            if (isMatch) {
              console.log("Found matching transaction in toncenter:", tx.transaction_id);
            }
            
            return isMatch;
          });
          
          if (matchingTx) {
            // Process verified transaction
            const txHash = matchingTx.transaction_id;
            console.log(`Transaction match found with hash: ${txHash}`);
            
            // Update payment record with transaction hash
            console.log("Updating payment record with transaction hash");
            await supabaseAdmin
              .from("payments")
              .update({ transaction_hash: txHash })
              .eq("telegram_id", userId)
              .eq("task_type", taskId || "boost")
              .is("transaction_hash", null);
              
            return await processVerifiedTransaction(
              supabaseAdmin, 
              txHash, 
              userId, 
              boostId, 
              taskId, 
              taskType, 
              corsHeaders
            );
          } else {
            console.log("No matching transaction found in toncenter response");
          }
        }
      } else {
        console.log("toncenter request failed:", toncenterResponse.status);
      }
    } catch (error) {
      console.log("Error with toncenter:", error);
    }
    
    // No matching transaction found in either API
    console.log("No matching transaction found in any APIs");
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "No matching transaction found",
        expected: {
          amount: Math.floor(amount * 1000000000),
          receiver: tonWalletAddress,
          comment: expectedComment || "(none)",
          userId: userId,
          taskId: taskId,
          boostId: boostId
        }
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
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
  corsHeaders: any = {}
) {
  console.log(`Processing verified transaction ${txHash} for user ${userId}`);
  console.log(`Task ID: ${taskId || "none"}, Boost ID: ${boostId || "none"}, Task Type: ${taskType || "none"}`);
  
  // Handle boost payment confirmation if boostId provided
  if (boostId) {
    console.log(`Confirming boost ${boostId} for user ${userId}`);
    
    const { data, error: updateError } = await supabaseAdmin
      .from("mining_boosts")
      .update({
        status: "confirmed",
        ton_tx: txHash,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // 24 hours from now
      })
      .eq("id", boostId)
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
      // Continue anyway since the main transaction was successful
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
      // First get the task reward amount
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
      // Continue anyway since the main transaction was successful
    }
  }
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      transaction: {
        hash: txHash,
        time: new Date().toISOString()
      }
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
