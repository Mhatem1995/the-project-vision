import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SaveWalletRequest {
  telegramId: string;
  walletAddress: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telegramId, walletAddress } = await req.json() as SaveWalletRequest;

    console.log("💾 [SAVE WALLET] Request:", { telegramId, walletAddress });

    if (!telegramId || !walletAddress) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing telegramId or walletAddress" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that walletAddress is user-friendly format (UQ/EQ)
    if (!walletAddress.startsWith("UQ") && !walletAddress.startsWith("EQ")) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Only user-friendly wallet addresses (UQ/EQ) are accepted" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Save or update wallet connection
    const { data, error } = await supabaseAdmin
      .from("wallets")
      .upsert({
        telegram_id: telegramId,
        wallet_address: walletAddress
      }, {
        onConflict: "telegram_id"
      });

    if (error) {
      console.error("❌ [SAVE WALLET] Database error:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to save wallet connection",
          error: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ [SAVE WALLET] Wallet saved successfully:", data);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Wallet connection saved successfully",
        data 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ [SAVE WALLET] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});