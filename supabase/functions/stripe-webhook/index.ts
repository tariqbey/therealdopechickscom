import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No Stripe signature found");

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const priceId = session.metadata?.price_id;
      const currencyType = session.metadata?.currency_type;

      if (!userId || !priceId) {
        logStep("Missing metadata, skipping", { userId, priceId });
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      logStep("Processing payment", { userId, priceId, currencyType });

      if (currencyType === "credits") {
        // Credit purchase (creators)
        const amount = CREDIT_PRICE_MAP[priceId];
        if (!amount) {
          logStep("Unknown credit price ID", { priceId });
          return new Response(JSON.stringify({ received: true }), { status: 200 });
        }

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

        // Log transaction
        await supabase.from("credit_transactions").insert({
          user_id: userId,
          amount,
          type: "purchase",
          description: `Purchased ${amount} credits`,
          reference_id: session.id,
        });

        logStep("Credits added", { userId, amount });
      } else {
        // BREAD purchase (fans) — default
        const amount = BREAD_PRICE_MAP[priceId];
        if (!amount) {
          logStep("Unknown BREAD price ID", { priceId });
          return new Response(JSON.stringify({ received: true }), { status: 200 });
        }

        // Update wallet
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

        // Log transaction
        await supabase.from("wallet_transactions").insert({
          user_id: userId,
          amount,
          type: "purchase",
          description: `Purchased ${amount} BREAD`,
          reference_id: session.id,
        });

        logStep("BREAD added", { userId, amount });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("ERROR", { message: (error as Error).message });
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
