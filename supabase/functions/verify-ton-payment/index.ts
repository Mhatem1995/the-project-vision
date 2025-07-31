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

const debugLog = (message: string, data?: any) => {
  console.log(`🔍 [VERIFY] ${message}`, data || "");
};

/**
 * Generate all possible address formats for searching
 */
function generateAddressVariants(address: string): string[] {
  const variants = new Set<string>();
  
  // Add original
  variants.add(address);
  
  // If UQ/EQ format, convert to raw
  if (address.startsWith("UQ") || address.startsWith("EQ")) {
    try {
      const base64 = address.substring(2);
      // Convert base64url back to base64
      const base64Standard = base64.replace(/-/g, '+').replace(/_/g, '/');
      // Pad if needed
      const padded = base64Standard + '='.repeat((4 - base64Standard.length % 4) % 4);
      
      const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      
      variants.add(`0:${hex}`);
      variants.add(hex);
      variants.add(`EQ${base64}`);
      variants.add(`UQ${base64}`);
    } catch (e) {
      debugLog("Failed to convert address variant:", e);
    }
  }
  
  // If raw format, convert to UQ/EQ
  if (address.startsWith("0:")) {
    const hex = address.substring(2);
    try {
      const bytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
      
      const base64 = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      variants.add(`UQ${base64}`);
      variants.add(`EQ${base64}`);
      variants.add(hex);
    } catch (e) {
      debugLog("Failed to convert raw address:", e);
    }
  }
  
  return Array.from(variants);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    debugLog("=== TRANSACTION VERIFICATION START ===");
    
    const requestBody = await req.json();
    debugLog("Request body:", requestBody);
    
    const { userId, amount, taskId, boostId, taskType, comment } = requestBody as TransactionVerifyRequest;

    if (!userId || !amount || (!taskId && !boostId)) {
      debugLog("❌ Missing required parameters");
      return new Response(
        JSON.stringify({ success: false, message: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    debugLog(`Getting wallet for user: ${userId}`);
    
    // Get user's real wallet address
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("wallet_address")
      .eq("telegram_id", userId)
      .single();
      
    debugLog("Wallet query result:", { walletData, walletError });
      
    if (walletError || !walletData?.wallet_address) {
      debugLog("❌ No wallet found for user!");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Wallet not found. Please connect your TON wallet first.",
          error: "WALLET_NOT_FOUND"
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userWalletAddress = walletData.wallet_address;
    debugLog(`✅ Found user wallet: ${userWalletAddress}`);

    // Generate all possible address formats
    const userAddressVariants = generateAddressVariants(userWalletAddress);
    const ourAddressVariants = generateAddressVariants(tonWalletAddress);
    
    debugLog("User address variants:", userAddressVariants);
    debugLog("Our address variants:", ourAddressVariants);

    const expectedAmountNano = Math.floor(amount * 1000000000);
    const expectedComment = comment || (boostId ? `boost_${boostId}` : taskId ? `task${taskId}` : "");
    
    debugLog("Transaction search parameters:", {
      userAddressVariants,
      ourAddressVariants,
      expectedAmountNano,
      expectedComment
    });
    
    let matchingTx: any = null;
    
    // Search transactions for each user address variant
    for (const userAddr of userAddressVariants) {
      debugLog(`Checking transactions for user address: ${userAddr}`);
      
      try {
        const tonapiUrl = `https://tonapi.io/v2/accounts/${userAddr}/transactions?limit=50`;
        debugLog(`Requesting: ${tonapiUrl}`);
        
        const response = await fetch(tonapiUrl, {
          headers: { 'Authorization': `Bearer ${tonApiKey}` }
        });
        
        if (!response.ok) {
          debugLog(`❌ API request failed: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const data = await response.json();
        const transactions = data.transactions || [];
        debugLog(`Found ${transactions.length} transactions for ${userAddr}`);
        
        // Check each transaction
        for (const tx of transactions) {
          // Check transaction age (within last 2 hours)
          const txTime = new Date(tx.utime * 1000);
          const timeDiff = Date.now() - txTime.getTime();
          const maxAge = 2 * 60 * 60 * 1000; // 2 hours
          
          if (timeDiff > maxAge) {
            continue; // Skip old transactions
          }
          
          debugLog(`Checking tx ${tx.hash || tx.transaction_id} from ${txTime.toISOString()}`);
          
          // Check outgoing messages
          const outMsgs = tx.out_msgs || [];
          for (const msg of outMsgs) {
            const destination = msg.destination?.address || msg.destination || msg.address;
            const msgValue = parseInt(msg.value || "0");
            
            debugLog(`Message: to=${destination}, value=${msgValue}, expected=${expectedAmountNano}`);
            
            // Check if destination matches our wallet (any variant)
            const isToOurWallet = ourAddressVariants.some(variant => 
              destination === variant ||
              destination === `0:${variant}` ||
              destination === variant.replace(/^0:/, '')
            );
            
            if (!isToOurWallet) {
              debugLog(`❌ Destination mismatch`);
              continue;
            }
            
            // Check amount (with tolerance for fees)
            const amountDiff = Math.abs(msgValue - expectedAmountNano);
            const tolerance = Math.max(50000000, expectedAmountNano * 0.05); // 0.05 TON or 5%
            
            if (amountDiff > tolerance) {
              debugLog(`❌ Amount mismatch: diff=${amountDiff}, tolerance=${tolerance}`);
              continue;
            }
            
            // Check comment if expected
            if (expectedComment) {
              const msgText = typeof msg.message === 'string' ? msg.message : 
                             msg.message?.body || msg.comment || '';
              if (!msgText.includes(expectedComment)) {
                debugLog(`❌ Comment mismatch: "${msgText}" vs "${expectedComment}"`);
                continue;
              }
            }
            
            debugLog(`✅ FOUND MATCHING TRANSACTION!`, {
              hash: tx.hash || tx.transaction_id,
              amount: msgValue,
              time: txTime.toISOString(),
              to: destination,
              from: userAddr
            });
            
            matchingTx = tx;
            break;
          }
          
          if (matchingTx) break;
        }
        
        if (matchingTx) break;
        
      } catch (error) {
        debugLog(`❌ Error checking ${userAddr}:`, error);
      }
    }
    
    if (!matchingTx) {
      debugLog("❌ NO MATCHING TRANSACTION FOUND");
      return new Response(
        JSON.stringify({
          success: false,
          message: "No matching transaction found. Please ensure you sent the correct amount with the required comment.",
          debug: {
            userWallet: userWalletAddress,
            userAddressVariants,
            ourWallet: tonWalletAddress,
            expectedAmount: expectedAmountNano,
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
    try {
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
        debugLog("Warning: Failed to update payment record:", paymentUpdateError);
      }
    } catch (e) {
      debugLog("Warning: Payment record update failed:", e);
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
  debugLog(`Processing verified transaction for user ${userId}`);
  
  // Handle boost payment
  if (boostId) {
    debugLog(`Confirming boost ${boostId}`);
    
    const { error: updateError } = await supabaseAdmin
      .from("mining_boosts")
      .update({
        status: "confirmed",
        ton_tx: txHash,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      })
      .eq("id", boostId)
      .eq("user_id", userId);
    
    if (updateError) {
      debugLog("❌ Failed to confirm boost:", updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to confirm boost",
          error: updateError.message 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    debugLog("✅ Boost confirmed successfully");
  }
  
  // Handle task completion
  if (taskId) {
    debugLog(`Processing task ${taskId} completion`);
    
    // Add task completion record
    try {
      const { data: existingTask } = await supabaseAdmin
        .from("tasks_completed")
        .select("*")
        .eq("user_id", userId)
        .eq("task_id", taskId)
        .maybeSingle();
      
      if (!existingTask) {
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
          debugLog("✅ Task completion recorded");
        }
      }
    } catch (err) {
      debugLog("❌ Error handling task completion:", err);
    }
    
    // Handle rewards
    if (taskId === "6") {
      // Fortune cookies
      const { error: cookieError } = await supabaseAdmin.rpc('add_fortune_cookies', { 
        p_user_id: userId, 
        p_cookie_count: 10 
      });
      
      if (cookieError) {
        debugLog("❌ Failed to add fortune cookies:", cookieError);
      } else {
        debugLog("✅ Added fortune cookies successfully");
      }
    } else {
      // KFC rewards
      const rewards: { [key: string]: number } = {
        "3": 100,
        "4": 1500,
        "5": 30000
      };
      
      const reward = rewards[taskId] || 0;
      
      if (reward > 0) {
        try {
          const { data: currentUser } = await supabaseAdmin
            .from("users")
            .select("balance")
            .eq("id", userId)
            .single();
            
          const currentBalance = currentUser?.balance || 0;
          const newBalance = currentBalance + reward;
          
          const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ balance: newBalance })
            .eq("id", userId);
            
          if (updateError) {
            debugLog("❌ Failed to update balance:", updateError);
          } else {
            debugLog(`✅ Added ${reward} KFC to balance`);
          }
        } catch (e) {
          debugLog("❌ Balance update failed:", e);
        }
      }
    }
  }
  
  // Record daily task if needed
  if (taskType === "daily_ton_payment") {
    try {
      await supabaseAdmin
        .from("daily_tasks")
        .insert([{
          user_id: userId,
          task_type: taskType
        }]);
      debugLog("✅ Daily task recorded");
    } catch (err) {
      debugLog("❌ Failed to record daily task:", err);
    }
  }
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      transaction: {
        hash: txHash,
        senderAddress,
        verifiedAt: new Date().toISOString()
      }
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}