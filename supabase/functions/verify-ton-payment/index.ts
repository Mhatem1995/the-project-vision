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

// Debug logging function for edge function
const debugLog = (message: string, data?: any) => {
  console.log(`🔍 [EDGE DEBUG] ${message}`, data || "");
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    debugLog("=== TRANSACTION VERIFICATION START ===");
    
    const requestBody = await req.json();
    debugLog("Request body received", requestBody);
    
    const { userId, amount, taskId, boostId, taskType, comment } = requestBody as TransactionVerifyRequest;

    if (!userId || !amount || ((!taskId && !boostId))) {
      debugLog("❌ Missing required parameters", { userId: !!userId, amount: !!amount, taskId: !!taskId, boostId: !!boostId });
      return new Response(
        JSON.stringify({ success: false, message: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const tonWalletAddress = "UQDc2Sa1nehhxLYDuSD80u2jJzEu_PtwAIrKVL6Y7Ss5H35C";
    const tonApiKey = Deno.env.get("TON_API_KEY");
    
    if (!tonApiKey) {
      debugLog("❌ TON_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, message: "TON API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    debugLog(`Looking for wallet for user: ${userId}`);
    
    // Get user's wallet address ONLY from the wallets table for security and consistency
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("wallet_address")
      .eq("telegram_id", userId)
      .order('created_at', { ascending: false }) // Get the most recent connected wallet
      .limit(1)
      .maybeSingle();
      
    debugLog("Wallets table query result", { walletData, walletError });
      
    if (!walletData?.wallet_address) {
      debugLog("❌ No wallet found for user in 'wallets' table!");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "User wallet not found. Please connect your wallet in the app first.",
          error: "WALLET_NOT_FOUND",
          debug: { 
            userId, 
            walletTableChecked: true,
            walletTableError: walletError?.message,
          }
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userWalletAddress = walletData.wallet_address;
    debugLog(`✅ Found wallet in wallets table: ${userWalletAddress}`);

    // Transaction search parameters
    const expectedAmountNano = Math.floor(amount * 1000000000);
    const expectedComment = comment || (boostId ? `boost_${boostId}` : taskId ? `task${taskId}` : "");
    
    debugLog(`Searching for transaction:`, {
      from: userWalletAddress,
      to: tonWalletAddress,
      amount: expectedAmountNano,
      amountTON: amount,
      comment: expectedComment || "(any)"
    });
    
    let matchingTx: any = null;
    let searchedWallets: string[] = [];
    
    // Generate different wallet address formats
    const walletFormats = [userWalletAddress];
    
    if (userWalletAddress.startsWith("0:")) {
      walletFormats.push(userWalletAddress.substring(2));
    }
    
    if (!userWalletAddress.startsWith("EQ") && !userWalletAddress.startsWith("UQ")) {
      const baseAddr = userWalletAddress.startsWith("0:") ? userWalletAddress.substring(2) : userWalletAddress;
      walletFormats.push("EQ" + baseAddr);
      walletFormats.push("UQ" + baseAddr);
    }
    
    debugLog(`Will search with wallet formats:`, walletFormats);
    
    // Search transactions for each wallet format
    for (const walletAddr of walletFormats) {
      debugLog(`Checking transactions for: ${walletAddr}`);
      searchedWallets.push(walletAddr);
      
      try {
        const tonapiUrl = `https://tonapi.io/v2/accounts/${walletAddr}/transactions?limit=100`;
        debugLog(`Requesting TON API:`, tonapiUrl);
        const tonapiResponse = await fetch(tonapiUrl, {
          headers: { 'Authorization': `Bearer ${tonApiKey}` }
        });
        
        if (!tonapiResponse.ok) {
          debugLog(`❌ API request failed for ${walletAddr}: ${tonapiResponse.status} ${tonapiResponse.statusText}`);
          continue;
        }
        
        const data = await tonapiResponse.json();
        const transactions = data.transactions || [];
        debugLog(`Found ${transactions.length} transactions for ${walletAddr}`);
        
        // Look for matching transaction
        for (const tx of transactions) {
          const isOutgoing = tx.out_msgs && tx.out_msgs.length > 0;
          if (!isOutgoing) continue;
          
          // Check transaction age (within last 2 hours)
          const txTime = new Date(tx.utime * 1000);
          const timeDiff = Date.now() - txTime.getTime();
          const maxAge = 2 * 60 * 60 * 1000; // 2 hours
          
          if (timeDiff > maxAge) {
            debugLog(`Skipping TX as it is older than 2 hours`, { txHash: tx.hash || tx.transaction_id, txTime: txTime.toISOString() });
            continue;
          }
          
          debugLog(`Checking tx ${tx.hash || tx.transaction_id} from ${txTime.toISOString()}`);
          
          // Check each outgoing message
          for (const msg of tx.out_msgs) {
            const destination = msg.destination || msg.address;
            const msgValue = parseInt(msg.value || "0");
            
            debugLog(`Message details:`, {
              destination,
              msgValue,
              expectedAmountNano,
              ourWallet: tonWalletAddress
            });
            
            // Check destination
            const isToOurWallet = destination === tonWalletAddress || 
                                destination === `0:${tonWalletAddress.substring(2)}` ||
                                destination === `EQ${tonWalletAddress.substring(2)}` ||
                                destination === `UQ${tonWalletAddress.substring(2)}`;
            
            if (!isToOurWallet) {
              debugLog(`❌ Destination mismatch: ${destination} vs ${tonWalletAddress}`);
              continue;
            }
            
            // Check amount (with 10% tolerance for fees)
            const amountDiff = Math.abs(msgValue - expectedAmountNano);
            const tolerance = Math.max(100000000, expectedAmountNano * 0.1); // 0.1 TON or 10%
            
            if (amountDiff > tolerance) {
              debugLog(`❌ Amount mismatch: ${msgValue} vs ${expectedAmountNano} (diff: ${amountDiff}, tolerance: ${tolerance})`);
              continue;
            }
            
            // Check comment if expected
            if (expectedComment) {
              const msgText = typeof msg.message === 'string' ? msg.message : 
                             msg.message?.body ? msg.message.body : '';
              if (!msgText.includes(expectedComment)) {
                debugLog(`❌ Comment mismatch: "${msgText}" doesn't contain "${expectedComment}"`);
                continue;
              }
            }
            
            debugLog(`✅ FOUND MATCHING TRANSACTION!`, {
              hash: tx.hash || tx.transaction_id,
              amount: msgValue,
              time: txTime.toISOString(),
              to: destination
            });
            
            matchingTx = tx;
            break;
          }
          
          if (matchingTx) break;
        }
        
        if (matchingTx) break;
        
      } catch (error) {
        debugLog(`❌ Error fetching transactions for ${walletAddr}:`, error);
      }
    }
    
    if (!matchingTx) {
      debugLog("❌ NO MATCHING TRANSACTION FOUND after checking all variants. Provide this info to the user.");
      return new Response(
        JSON.stringify({
          success: false,
          message: "No matching transaction found. Please ensure you sent the correct amount to the correct address WITH the required comment. If the problem persists, contact support.",
          debug: {
            userWallet: userWalletAddress,
            searchedWallets,
            ourWallet: tonWalletAddress,
            expectedAmountNano,
            expectedComment: expectedComment || "(any)",
            searchTimeframe: "Last 2 hours"
          }
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Process verified transaction
    const txHash = matchingTx.hash || matchingTx.transaction_id;
    debugLog(`✅ Processing verified transaction: ${txHash}`);
    
    // Update payment record
    const { error: paymentUpdateError } = await supabaseAdmin
      .from("payments")
      .update({ 
        transaction_hash: txHash,
        wallet_address: userWalletAddress
      })
      .eq("telegram_id", userId)
      .eq("task_type", taskType || taskId || "boost")
      .is("transaction_hash", null);
    
    if (paymentUpdateError) {
      debugLog("❌ Error updating payment record:", paymentUpdateError);
    } else {
      debugLog("✅ Payment record updated successfully");
    }
      
    return await processVerifiedTransaction(
      supabaseAdmin, 
      txHash, 
      userId, 
      boostId, 
      taskId, 
      taskType, 
      corsHeaders,
      userWalletAddress
    );

  } catch (error) {
    debugLog("❌ Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message,
        error: "VERIFICATION_ERROR"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
  debugLog(`Processing verified transaction ${txHash} for user ${userId}`, {
    taskId: taskId || "none",
    boostId: boostId || "none", 
    taskType: taskType || "none",
    senderAddress: senderAddress || "unknown"
  });
  
  // Handle boost payment confirmation if boostId provided
  if (boostId) {
    debugLog(`Confirming boost ${boostId} for user ${userId}`);
    
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
      debugLog("❌ Failed to confirm boost:", updateError);
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
    
    debugLog("✅ Boost confirmed successfully:", data);
  }
  
  // Handle task completion if taskId provided
  if (taskId) {
    try {
      debugLog(`Processing task ${taskId} completion for user ${userId}`);
      
      // Check if task already exists in tasks_completed
      const { data: existingTask } = await supabaseAdmin
        .from("tasks_completed")
        .select("*")
        .eq("user_id", userId)
        .eq("task_id", taskId)
        .maybeSingle();
      
      debugLog("Existing task check result:", existingTask);
      
      // If not already completed, add record
      if (!existingTask) {
        debugLog("Adding task completion record");
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
          debugLog("❌ Error recording task completion:", taskError);
        } else {
          debugLog("✅ Task completion record added successfully");
        }
      } else {
        debugLog("Task already completed previously");
      }
    } catch (err) {
      debugLog("❌ Error handling task completion:", err);
    }
    
    if (taskId === "6") {
      // Special case: fortune cookies
      debugLog("Processing fortune cookies purchase");
      const { data: cookieResult, error: cookieError } = await supabaseAdmin.rpc('add_fortune_cookies', { 
        p_user_id: userId, 
        p_cookie_count: 10 
      });
      
      if (cookieError) {
        debugLog("❌ Failed to add fortune cookies:", cookieError);
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
      
      debugLog("✅ Added fortune cookies successfully");
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
        debugLog(`Processing reward of ${reward} KFC for task ${taskId}`);
        
        // Get current balance
        const { data: currentUser, error: balanceError } = await supabaseAdmin
          .from("users")
          .select("balance")
          .eq("id", userId)
          .maybeSingle();
          
        debugLog("Current user balance query:", { currentUser, balanceError });
          
        if (balanceError) {
          debugLog("❌ Failed to get user balance:", balanceError);
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
        debugLog(`Updating user balance from ${currentBalance} to ${newBalance}`);
        
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({ balance: newBalance })
          .eq("id", userId);
          
        if (updateError) {
          debugLog("❌ Failed to update balance:", updateError);
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
        
        debugLog("✅ Balance updated successfully");
      }
    }
  }
  
  // Record daily task completion if needed
  if (taskType === "daily_ton_payment") {
    try {
      debugLog(`Recording daily task completion for ${userId}, type: ${taskType}`);
      const { error: dailyTaskError } = await supabaseAdmin
        .from("daily_tasks")
        .insert([{
          user_id: userId,
          task_type: taskType
        }]);
      
      if (dailyTaskError) {
        debugLog("❌ Failed to record daily task:", dailyTaskError);
      } else {
        debugLog("✅ Daily task recorded successfully");
      }
    } catch (err) {
      debugLog("❌ Failed to record daily task:", err);
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
