
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
    const { userId, amount, taskId, boostId, taskType, comment } = await req.json() as TransactionVerifyRequest;

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

    // Get user's wallet address
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("links")
      .eq("id", userId)
      .single();

    if (userError || !userData.links) {
      console.log("User wallet not found:", userError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "User wallet not found",
          error: userError?.message
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userWalletAddress = userData.links;
    console.log(`Checking transactions from ${userWalletAddress} to ${tonWalletAddress}`);
    
    // Format amount for comparison (convert to nanoTONs)
    const expectedAmountNano = Math.floor(amount * 1000000000);
    const expectedComment = comment || (taskId ? `task${taskId}` : "");
    
    // First, try using tonapi.io
    try {
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
          const hasMatchingAmount = tx.out_msgs?.some((msg: any) => 
            Math.abs(msg.value - expectedAmountNano) < 10000000 // Allow small rounding differences
          );
          
          // Check if the message comment matches our expected comment if one was provided
          let hasMatchingComment = true;
          if (expectedComment) {
            hasMatchingComment = tx.out_msgs?.some((msg: any) => {
              if (!msg.message) return false;
              if (typeof msg.message === 'string') {
                return msg.message.includes(expectedComment);
              }
              return false;
            });
          }
          
          // Check if transaction is recent (within last 30 minutes)
          const isRecent = (Date.now() - new Date(tx.utime * 1000).getTime()) < 30 * 60 * 1000;
          
          const isMatch = isToOurWallet && hasMatchingAmount && hasMatchingComment && isRecent;
          if (isMatch) {
            console.log("Found matching transaction:", tx.hash);
          }
          
          return isMatch;
        });
        
        if (matchingTx) {
          // Process verified transaction
          return await processVerifiedTransaction(
            supabaseAdmin, 
            matchingTx.hash, 
            userId, 
            boostId, 
            taskId, 
            taskType, 
            corsHeaders
          );
        }
      } else {
        console.log("tonapi.io request failed:", tonapiResponse.status);
      }
    } catch (error) {
      console.log("Error with tonapi.io:", error);
    }
    
    // If tonapi.io fails, try toncenter API as fallback
    try {
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
              const hasMatchingAmount = Math.abs(parseInt(msg.value) - expectedAmountNano) < 10000000;
              
              // Check comment if expected
              let hasMatchingComment = true;
              if (expectedComment && msg.message) {
                hasMatchingComment = msg.message.includes(expectedComment);
              }
              
              return isToOurWallet && hasMatchingAmount && hasMatchingComment;
            });
            
            // Check if transaction is recent (within last 30 minutes)
            const txTime = tx.utime ? new Date(tx.utime * 1000) : null;
            const isRecent = txTime && (Date.now() - txTime.getTime() < 30 * 60 * 1000);
            
            const isMatch = !!matchingMsg && isRecent;
            if (isMatch) {
              console.log("Found matching transaction in toncenter:", tx.transaction_id);
            }
            
            return isMatch;
          });
          
          if (matchingTx) {
            // Process verified transaction
            return await processVerifiedTransaction(
              supabaseAdmin, 
              matchingTx.transaction_id, 
              userId, 
              boostId, 
              taskId, 
              taskType, 
              corsHeaders
            );
          }
        }
      } else {
        console.log("toncenter request failed:", toncenterResponse.status);
      }
    } catch (error) {
      console.log("Error with toncenter:", error);
    }
    
    // No matching transaction found in either API
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "No matching transaction found",
        expected: {
          amount: Math.floor(amount * 1000000000),
          receiver: tonWalletAddress,
          comment: expectedComment || "(none)"
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
  console.log("Processing verified transaction:", txHash);
  
  // Handle boost payment confirmation if boostId provided
  if (boostId) {
    const { error: updateError } = await supabaseAdmin
      .from("mining_boosts")
      .update({
        status: "confirmed",
        ton_tx: txHash,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // 24 hours from now
      })
      .eq("id", boostId);
    
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
  }
  
  // Handle task completion if taskId provided
  if (taskId) {
    // Check if task already exists in tasks_completed
    const { data: existingTask } = await supabaseAdmin
      .from("tasks_completed")
      .select("*")
      .eq("user_id", userId)
      .eq("task_id", taskId)
      .maybeSingle();
    
    // If not already completed, add record
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
        console.error("Failed to record task completion:", taskError);
        // Continue anyway since the main transaction was successful
      }
    }
    
    if (taskId === "6") {
      // Special case: fortune cookies
      const { error: cookieError } = await supabaseAdmin.rpc('add_fortune_cookies', { 
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
        // Get current balance
        const { data: currentUser, error: balanceError } = await supabaseAdmin
          .from("users")
          .select("balance")
          .eq("id", userId)
          .single();
          
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
        const newBalance = (currentUser.balance || 0) + reward;
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
      }
    }
  }
  
  // Record daily task completion if needed
  if (taskType === "daily_ton_payment") {
    const { error: dailyError } = await supabaseAdmin
      .from("daily_tasks")
      .insert([{
        user_id: userId,
        task_type: taskType
      }]);
      
    if (dailyError) {
      console.error("Failed to record daily task:", dailyError);
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
