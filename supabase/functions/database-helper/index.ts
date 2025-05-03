
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
            
            const { error } = await supabase.rpc('save_wallet_connection', { 
              p_telegram_id: telegram_id, 
              p_wallet_address: wallet_address 
            });
            
            return new Response(
              JSON.stringify({ success: !error, error: error?.message }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
            
          case 'insert_payment': {
            const { telegram_id, wallet_address, amount_paid, task_type, transaction_hash } = params || {};
            
            if (!telegram_id || !wallet_address || amount_paid === undefined || !task_type) {
              return new Response(
                JSON.stringify({ error: "Missing required payment parameters" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            const { error } = await supabase.rpc('insert_payment', { 
              p_telegram_id: telegram_id, 
              p_wallet_address: wallet_address,
              p_amount_paid: amount_paid,
              p_task_type: task_type,
              p_transaction_hash: transaction_hash || null
            });
            
            return new Response(
              JSON.stringify({ success: !error, error: error?.message }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
            
          case 'get_wallet_connections': {
            const { data, error } = await supabase.rpc('get_wallet_connections');
            
            return new Response(
              JSON.stringify({ success: !error, connections: data, error: error?.message }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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
    const { error: createSaveWalletFnError } = await supabase.rpc('create_save_wallet_connection_function');
    const { error: createInsertPaymentFnError } = await supabase.rpc('create_insert_payment_function');
    const { error: createGetWalletsFnError } = await supabase.rpc('create_get_wallet_connections_function');
    
    return new Response(
      JSON.stringify({
        message: "Helper functions created successfully",
        errors: {
          saveWalletFn: createSaveWalletFnError?.message || null,
          insertPaymentFn: createInsertPaymentFnError?.message || null,
          getWalletsFn: createGetWalletsFnError?.message || null
        }
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
      }
    );
  } catch (error) {
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
