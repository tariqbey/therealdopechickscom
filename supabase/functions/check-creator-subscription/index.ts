import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { creatorId } = await req.json();
    if (!creatorId) throw new Error("Creator ID required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get all tiers for this creator that have stripe product IDs
    const { data: tiers } = await supabaseAdmin
      .from("creator_subscription_tiers")
      .select("id, tier_name, stripe_product_id, stripe_price_id")
      .eq("creator_id", creatorId)
      .eq("is_active", true);

    if (!tiers || tiers.length === 0) {
      return new Response(JSON.stringify({ subscribed: false, tier: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user has active Stripe subscription to any of these products
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ subscribed: false, tier: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 100,
    });

    // Find matching subscription
    const tierProductIds = new Set(tiers.filter(t => t.stripe_product_id).map(t => t.stripe_product_id));
    
    for (const sub of subscriptions.data) {
      for (const item of sub.items.data) {
        const productId = typeof item.price.product === 'string' ? item.price.product : (item.price.product as any)?.id;
        if (tierProductIds.has(productId)) {
          const matchedTier = tiers.find(t => t.stripe_product_id === productId);
          return new Response(JSON.stringify({
            subscribed: true,
            tier: matchedTier?.tier_name || null,
            tier_id: matchedTier?.id || null,
            subscription_end: new Date(sub.current_period_end * 1000).toISOString(),
            stripe_subscription_id: sub.id,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({ subscribed: false, tier: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
