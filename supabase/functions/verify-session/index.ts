import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VERIFY-SESSION] ${step}${d}`);
};

// BREAD price ID → amount mapping (fans)
const BREAD_PRICE_MAP: Record<string, number> = {
  "price_1SyE9VKb1BapFa4iRNnwQbdY": 50,
  "price_1SyEAVKb1BapFa4iRdbLTQ7L": 100,
  "price_1SyEAlKb1BapFa4iQRsEOzVT": 250,
  "price_1SyEAvKb1BapFa4it4SG0KCJ": 500,
  "price_1SyEB7Kb1BapFa4iSthPX9Cb": 1000,
  "price_1SyEBHKb1BapFa4iDE4O5ujE": 2500,
};

// Credit price ID → amount mapping (creators)
const CREDIT_PRICE_MAP: Record<string, number> = {
  "price_1SxpgwKb1BapFa4iMI5JpRC8": 500,
  "price_1SxphCKb1BapFa4ikZziXHOu": 1200,
  "price_1SxphMKb1BapFa4iZWXgtr1n": 3500,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: userData } = await anonClient.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("Session ID required");

    logStep("Verifying session", { sessionId, userId: user.id });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      logStep("Payment not completed", { status: session.payment_status });
      return new Response(JSON.stringify({ credited: false, reason: "Payment not completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = session.metadata?.user_id;
    const priceId = session.metadata?.price_id;
    const currencyType = session.metadata?.currency_type;

    if (userId !== user.id) {
      throw new Error("Session does not belong to this user");
    }

    if (!priceId) {
      throw new Error("Missing price info in session");
    }

    // Check if this session was already credited (idempotency)
    const refTable = currencyType === "credits" ? "credit_transactions" : "wallet_transactions";
    const { data: existing } = await supabase
      .from(refTable)
      .select("id")
      .eq("reference_id", sessionId)
      .limit(1);

    if (existing && existing.length > 0) {
      logStep("Already credited", { sessionId });
      return new Response(JSON.stringify({ credited: true, already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (currencyType === "credits") {
      const amount = CREDIT_PRICE_MAP[priceId];
      if (!amount) throw new Error("Unknown credit price");

      // Upsert credit wallet
      const { data: wallet } = await supabase
        .from("credit_wallets")
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (wallet) {
        await supabase
          .from("credit_wallets")
          .update({ balance: wallet.balance + amount })
          .eq("user_id", userId);
      } else {
        await supabase
          .from("credit_wallets")
          .insert({ user_id: userId, balance: amount });
      }

      await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount,
        type: "purchase",
        description: `Purchased ${amount} credits`,
        reference_id: sessionId,
      });

      logStep("Credits added", { userId, amount });
    } else {
      const amount = BREAD_PRICE_MAP[priceId];
      if (!amount) throw new Error("Unknown BREAD price");

      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (wallet) {
        await supabase
          .from("wallets")
          .update({ balance: wallet.balance + amount })
          .eq("user_id", userId);
      } else {
        await supabase
          .from("wallets")
          .insert({ user_id: userId, balance: amount });
      }

      await supabase.from("wallet_transactions").insert({
        user_id: userId,
        amount,
        type: "purchase",
        description: `Purchased ${amount} BREAD`,
        reference_id: sessionId,
      });

      logStep("BREAD added", { userId, amount });
    }

    return new Response(JSON.stringify({ credited: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("ERROR", { message: (error as Error).message });
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
