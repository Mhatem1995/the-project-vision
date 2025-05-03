
// This edge function will create database helper functions to avoid TypeScript errors

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

    // Create necessary database functions
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
