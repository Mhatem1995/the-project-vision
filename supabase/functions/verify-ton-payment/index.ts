
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
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the request body
    const { userId, amount, taskId, boostId, taskType } = await req.json() as TransactionVerifyRequest;

    if (!userId || !amount || ((!taskId && !boostId))) {
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
    
    // Check for recent transactions from user to our wallet
    console.log(`Checking transactions from ${userWalletAddress} to ${tonWalletAddress}`);
    
    // Use TON API to check for transactions
    const response = await fetch(`https://tonapi.io/v2/accounts/${userWalletAddress}/transactions?limit=20`, {
      headers: {
        'Authorization': `Bearer ${tonApiKey}`
      }
    });
    
    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to fetch TON transactions",
          status: response.status,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const data = await response.json();
    
    // Format amount for comparison (convert to nanoTONs)
    const expectedAmountNano = Math.floor(amount * 1000000000);
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
      
      // Check if transaction is recent (within last 30 minutes)
      const isRecent = (Date.now() - new Date(tx.utime * 1000).getTime()) < 30 * 60 * 1000;
      
      return isToOurWallet && hasMatchingAmount && isRecent;
    });
    
    if (!matchingTx) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "No matching transaction found",
          expected: {
            amount: expectedAmountNano,
            receiver: tonWalletAddress
          }
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Transaction found! Process according to task type
    if (boostId) {
      // Handle boost payment confirmation
      const { error: updateError } = await supabaseAdmin
        .from("mining_boosts")
        .update({
          status: "confirmed",
          ton_tx: matchingTx.hash,
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // 24 hours from now
        })
        .eq("id", boostId);
      
      if (updateError) {
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
    
    // Handle task completion if it's a task
    if (taskId === "6") {
      // Special case: fortune cookies
      const { error: cookieError } = await supabaseAdmin.rpc('add_fortune_cookies', { 
        p_user_id: userId, 
        p_cookie_count: 10 
      });
      
      if (cookieError) {
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
    } else if (taskId) {
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
          hash: matchingTx.hash,
          time: new Date(matchingTx.utime * 1000).toISOString()
        }
      }),
      {
        status: 200,
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
