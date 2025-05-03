
// This edge function will create database helper functions to avoid TypeScript errors
// and also serve as an RPC endpoint to interact with those functions

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    // Create client with service role (admin) permissions
    const supabase = createClient(url, serviceRoleKey);
    
    // Check if this is an RPC call or creating functions
    try {
      const { action, params } = await req.json();
      
      if (action) {
        console.log(`Processing RPC call for action: ${action}`);
        
        // Handle different RPC actions
        switch (action) {
          case 'save_wallet_connection': {
            const { telegram_id, wallet_address } = params || {};
            
            if (!telegram_id || !wallet_address) {
              return new Response(
                JSON.stringify({ error: "Missing required parameters" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            console.log(`Saving wallet connection for user: ${telegram_id}, wallet: ${wallet_address}`);
            
            // Insert wallet connection directly (simplifying this process)
            try {
              // First check if the connection already exists
              const { data: existingWallet } = await supabase
                .from("wallets")
                .select("id")
                .eq("telegram_id", telegram_id)
                .eq("wallet_address", wallet_address)
                .maybeSingle();
                
              if (!existingWallet) {
                // Insert the connection if it doesn't exist
                const { error: insertError } = await supabase
                  .from("wallets")
                  .insert([{ 
                    telegram_id, 
                    wallet_address 
                  }]);
                  
                if (insertError) {
                  console.error("Error inserting wallet connection:", insertError);
                  return new Response(
                    JSON.stringify({ success: false, error: insertError.message }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              }
              
              // Also make sure the user record exists and has the wallet linked
              const { error: updateError } = await supabase
                .from("users")
                .update({ links: wallet_address })
                .eq("id", telegram_id);
                
              if (updateError) {
                console.error("Error updating user wallet:", updateError);
              }
              
              return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            } catch (error) {
              console.error("Error in save_wallet_connection:", error);
              return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
            
          case 'insert_payment': {
            const { telegram_id, wallet_address, amount_paid, task_type, transaction_hash } = params || {};
            
            if (!telegram_id || !wallet_address || amount_paid === undefined || !task_type) {
              return new Response(
                JSON.stringify({ error: "Missing required payment parameters" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            console.log(`Inserting payment: ${telegram_id}, ${wallet_address}, ${amount_paid} TON, task: ${task_type}`);
            
            try {
              // Insert payment record directly
              const { error: insertError } = await supabase
                .from("payments")
                .insert([{ 
                  telegram_id, 
                  wallet_address,
                  amount_paid,
                  task_type,
                  transaction_hash: transaction_hash || null
                }]);
                
              if (insertError) {
                console.error("Error inserting payment:", insertError);
                return new Response(
                  JSON.stringify({ success: false, error: insertError.message }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
              
              return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            } catch (error) {
              console.error("Error in insert_payment:", error);
              return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
            
          case 'get_wallet_connections': {
            try {
              // Get wallet connections directly
              const { data, error } = await supabase
                .from("wallets")
                .select("telegram_id, wallet_address");
                
              if (error) {
                console.error("Error fetching wallet connections:", error);
                return new Response(
                  JSON.stringify({ success: false, error: error.message }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
              
              return new Response(
                JSON.stringify({ success: true, connections: data }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            } catch (error) {
              console.error("Error in get_wallet_connections:", error);
              return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
            
          default:
            return new Response(
              JSON.stringify({ error: `Unknown action: ${action}` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
      }
    } catch (parseError) {
      console.log("Not an RPC call or invalid JSON, proceeding with function creation");
    }

    // If we reach here, this is a regular call to create the helper functions
    console.log("Creating helper functions...");
    return new Response(
      JSON.stringify({
        message: "Database helper function is active and ready for RPC calls",
        actions: ["save_wallet_connection", "insert_payment", "get_wallet_connections"]
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
      }
    );
  }
});
