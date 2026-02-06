import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ATLAS_API_BASE = "https://api.atlascloud.ai/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const ATLAS_API_KEY = Deno.env.get("ATLAS_CLOUD_API_KEY");
  if (!ATLAS_API_KEY) throw new Error("ATLAS_CLOUD_API_KEY not configured");

  try {
    // Auth
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: userData } = await anonClient.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const body = await req.json();
    const { type, prompt, style, aspectRatio, characterName, characterDescription, characterStyle, motionPreset, duration, quality, sourceImageUrl, motionDescription } = body;

    // Determine cost
    const costs: Record<string, number> = { image: 25, character: 30, video: 75 };
    const cost = costs[type] || 25;

    // Check balance
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (!wallet || wallet.balance < cost) {
      return new Response(JSON.stringify({ error: "Insufficient BREAD balance", required: cost, balance: wallet?.balance ?? 0 }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create generation record
    const { data: generation, error: genError } = await supabase
      .from("ai_generations")
      .insert({
        user_id: user.id,
        generation_type: type,
        prompt: prompt || characterDescription || motionDescription,
        style_preset: style || characterStyle,
        aspect_ratio: aspectRatio,
        cost,
        status: "processing",
        metadata: body,
      })
      .select()
      .single();

    if (genError) throw new Error("Failed to create generation record");

    // Call Atlas Cloud API
    let atlasEndpoint: string;
    let atlasBody: Record<string, unknown>;

    switch (type) {
      case "image":
        atlasEndpoint = `${ATLAS_API_BASE}/images/generate`;
        atlasBody = { prompt, style_preset: style, aspect_ratio: aspectRatio, num_images: 4 };
        break;
      case "character":
        atlasEndpoint = `${ATLAS_API_BASE}/characters/create`;
        atlasBody = { name: characterName, description: characterDescription, style: characterStyle };
        break;
      case "video":
        atlasEndpoint = `${ATLAS_API_BASE}/videos/generate`;
        atlasBody = { source_image_url: sourceImageUrl, motion_preset: motionPreset, duration, quality, motion_description: motionDescription };
        break;
      default:
        throw new Error("Invalid generation type");
    }

    const atlasResponse = await fetch(atlasEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ATLAS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(atlasBody),
    });

    if (!atlasResponse.ok) {
      const errorText = await atlasResponse.text();
      console.error("Atlas Cloud API error:", atlasResponse.status, errorText);

      // Refund on failure
      await supabase.from("ai_generations").update({ status: "failed" }).eq("id", generation.id);

      return new Response(JSON.stringify({ error: `Atlas Cloud API error: ${atlasResponse.status}`, details: errorText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const atlasData = await atlasResponse.json();

    // Deduct BREAD
    await supabase.from("wallets").update({ balance: wallet.balance - cost }).eq("user_id", user.id);
    await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      amount: -cost,
      type: "spend",
      description: `AI ${type} generation`,
      reference_id: generation.id,
    });

    // Update generation record
    const resultUrl = atlasData.images?.[0]?.url || atlasData.character?.thumbnail_url || atlasData.video?.url || null;
    await supabase.from("ai_generations").update({
      status: "completed",
      result_url: resultUrl,
      metadata: { ...body, atlas_response: atlasData },
    }).eq("id", generation.id);

    return new Response(JSON.stringify({
      success: true,
      generation_id: generation.id,
      result: atlasData,
      new_balance: wallet.balance - cost,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-ai error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
