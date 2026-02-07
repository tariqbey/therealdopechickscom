import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: userData } = await anonClient.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { amount, description } = await req.json();
    if (!amount || amount <= 0) throw new Error("Invalid amount");

    // Get or create credit wallet
    let { data: wallet } = await supabase
      .from("credit_wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (!wallet) {
      // Create credit wallet with 0 balance
      const { data: newWallet, error: createErr } = await supabase
        .from("credit_wallets")
        .insert({ user_id: user.id, balance: 0 })
        .select("balance")
        .single();
      if (createErr) throw new Error("Failed to create credit wallet");
      wallet = newWallet;
    }

    if (wallet.balance < amount) throw new Error("Insufficient credits");

    // Deduct balance
    const { error: updateError } = await supabase
      .from("credit_wallets")
      .update({ balance: wallet.balance - amount })
      .eq("user_id", user.id);

    if (updateError) throw new Error("Failed to deduct credits");

    // Log transaction
    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount: -amount,
      type: "spend",
      description,
    });

    return new Response(JSON.stringify({ success: true, new_balance: wallet.balance - amount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
