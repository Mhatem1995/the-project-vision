
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DatabaseAction {
  action: string;
  params: any;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json() as DatabaseAction;
    console.log(`Processing RPC call for action: ${action} with params:`, JSON.stringify(params, null, 2));

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    let result = null;

    switch (action) {
      case 'ensure_user_exists':
        const { user_id, username, firstname, lastname, languagecode } = params;
        console.log(`Ensuring user exists: ${user_id}`);
        
        // First try to get existing user
        const { data: existingUser, error: fetchError } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("id", user_id)
          .maybeSingle();

        if (fetchError) {
          console.error("Error fetching user:", fetchError);
        }

        if (!existingUser) {
          console.log("Creating new user");
          const { data: newUser, error: insertError } = await supabaseAdmin
            .from("users")
            .insert({
              id: user_id,
              username: username || "",
              firstname: firstname || "",
              lastname: lastname || "", 
              languagecode: languagecode || "",
              last_seen_at: new Date().toISOString(),
              balance: 0
            })
            .select()
            .single();

          if (insertError) {
            console.error("Error creating user:", insertError);
            throw new Error(`Failed to create user: ${insertError.message}`);
          }
          
          console.log("User created successfully:", newUser);
          result = newUser;
        } else {
          console.log("User exists, updating last_seen_at");
          const { data: updatedUser, error: updateError } = await supabaseAdmin
            .from("users")
            .update({ 
              last_seen_at: new Date().toISOString(),
              username: username || existingUser.username
            })
            .eq("id", user_id)
            .select()
            .single();

          if (updateError) {
            console.error("Error updating user:", updateError);
          }
          
          result = updatedUser || existingUser;
        }
        break;

      case 'save_wallet_connection':
        const { telegram_id, wallet_address } = params;
        console.log(`Saving wallet connection for user: ${telegram_id}, wallet: ${wallet_address}`);
        
        // Check if connection already exists
        const { data: existingConnection } = await supabaseAdmin
          .from("wallets")
          .select("*")
          .eq("telegram_id", telegram_id)
          .eq("wallet_address", wallet_address)
          .maybeSingle();

        if (existingConnection) {
          console.log("Wallet connection already exists, skipping insert");
          result = existingConnection;
        } else {
          const { data: walletData, error: walletError } = await supabaseAdmin
            .from("wallets")
            .insert({
              telegram_id,
              wallet_address
            })
            .select()
            .single();

          if (walletError) {
            console.error("Error saving wallet:", walletError);
            throw new Error(`Failed to save wallet: ${walletError.message}`);
          }
          
          console.log("Wallet connection saved successfully:", walletData);
          result = walletData;
        }

        // Also update user with wallet address
        const { error: userUpdateError } = await supabaseAdmin
          .from("users")
          .update({ links: wallet_address })
          .eq("id", telegram_id);

        if (userUpdateError) {
          console.warn("Failed to update user with wallet:", userUpdateError);
        } else {
          console.log("Updated wallet address for user");
        }
        break;

      case 'insert_payment':
        const { telegram_id: paymentUserId, wallet_address: paymentWallet, amount_paid, task_type, transaction_hash } = params;
        console.log(`Inserting payment: ${paymentUserId}, ${paymentWallet}, ${amount_paid} TON, task: ${task_type}`);
        
        const { data: paymentData, error: paymentError } = await supabaseAdmin
          .from("payments")
          .insert({
            telegram_id: paymentUserId,
            wallet_address: paymentWallet,
            amount_paid,
            task_type,
            transaction_hash
          })
          .select();

        if (paymentError) {
          console.error("Error inserting payment:", paymentError);
          throw new Error(`Failed to insert payment: ${paymentError.message}`);
        }
        
        console.log("Payment record inserted successfully:", paymentData);
        result = paymentData;
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Error in database helper:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
