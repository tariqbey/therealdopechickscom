import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATOR-CHECKOUT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { tierId } = await req.json();
    if (!tierId) throw new Error("Tier ID required");

    // Get tier details
    const { data: tier, error: tierError } = await supabaseAdmin
      .from("creator_subscription_tiers")
      .select("*")
      .eq("id", tierId)
      .single();

    if (tierError || !tier) throw new Error("Tier not found");
    logStep("Tier found", { tierName: tier.tier_name, price: tier.price_cents });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create Stripe product/price for this tier
    let stripePriceId = tier.stripe_price_id;

    if (!stripePriceId) {
      // Get creator display name
      const { data: creatorProfile } = await supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("user_id", tier.creator_id)
        .single();

      const creatorName = creatorProfile?.display_name || "Creator";

      const product = await stripe.products.create({
        name: `${creatorName} - ${tier.tier_name} Subscription`,
        metadata: { creator_id: tier.creator_id, tier_id: tier.id },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: tier.price_cents,
        currency: "usd",
        recurring: { interval: "month" },
      });

      // Store stripe IDs back
      await supabaseAdmin
        .from("creator_subscription_tiers")
        .update({ stripe_product_id: product.id, stripe_price_id: price.id })
        .eq("id", tier.id);

      stripePriceId = price.id;
      logStep("Created Stripe product/price", { productId: product.id, priceId: price.id });
    }

    // Find existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const origin = req.headers.get("origin") || "";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/creator/${tier.creator_id}?subscribed=true`,
      cancel_url: `${origin}/creator/${tier.creator_id}`,
      metadata: {
        fan_user_id: user.id,
        creator_id: tier.creator_id,
        tier_id: tier.id,
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
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
