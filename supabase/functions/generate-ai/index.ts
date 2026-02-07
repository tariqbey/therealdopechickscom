import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const ATLAS_IMAGE_URL = "https://api.atlascloud.ai/api/v1/model/generateImage";
const ATLAS_VIDEO_URL = "https://api.atlascloud.ai/api/v1/model/generateVideo";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
    const { type, prompt, style, aspectRatio, referenceImageUrl, characterName, characterDescription, characterStyle, motionPreset, duration, quality, sourceImageUrl, motionDescription } = body;

    // Determine cost and API cost tracking
    const costs: Record<string, number> = { image: 25, character: 30, video: 75 };
    const apiCostsCents: Record<string, number> = { image: 3, character: 5, video: 50 };
    const platformFeeCents = 15;
    const cost = costs[type] || 25;
    const apiCostCents = apiCostsCents[type] || 3;

    // Check if user is admin (unlimited BREAD)
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleData;

    // Check balance (skip for admin)
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (!isAdmin && (!wallet || wallet.balance < cost)) {
      return new Response(JSON.stringify({ error: "Insufficient BREAD balance", required: cost, balance: wallet?.balance ?? 0 }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create generation record with cost tracking
    const { data: generation, error: genError } = await supabase
      .from("ai_generations")
      .insert({
        user_id: user.id,
        generation_type: type,
        prompt: prompt || characterDescription || motionDescription,
        style_preset: style || characterStyle,
        aspect_ratio: aspectRatio,
        cost: isAdmin ? 0 : cost,
        api_cost_cents: apiCostCents,
        platform_fee_cents: platformFeeCents,
        status: "processing",
        metadata: body,
      })
      .select()
      .single();

    if (genError) throw new Error("Failed to create generation record");

    // Build request based on type
    let apiUrl: string;
    let apiKey: string;
    let requestBody: Record<string, unknown>;
    let isAtlasImage = false;
    let isAtlasVideo = false;

    switch (type) {
      case "image": {
        const styleText = style ? ` in ${style} style` : "";
        const ratioText = aspectRatio ? ` with ${aspectRatio} aspect ratio` : "";
        const fullPrompt = `${prompt}${styleText}${ratioText}`;

        if (referenceImageUrl) {
          // Use Atlas Cloud qwen-image/edit-plus for image editing (I2I)
          isAtlasImage = true;
          apiUrl = ATLAS_IMAGE_URL;
          apiKey = ATLAS_API_KEY;

          requestBody = {
            model: "atlascloud/qwen-image/edit-plus",
            images: [referenceImageUrl],
            prompt: fullPrompt,
            enable_sync_mode: true,
            enable_safety_checker: false,
            output_format: "png",
          };
        } else {
          // No reference image: use Lovable AI for text-to-image
          apiUrl = LOVABLE_AI_URL;
          apiKey = LOVABLE_API_KEY;
          requestBody = {
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: `Generate an image: ${fullPrompt}` }],
            modalities: ["image", "text"],
          };
        }
        break;
      }
      case "character": {
        apiUrl = LOVABLE_AI_URL;
        apiKey = LOVABLE_API_KEY;
        const charStyleText = characterStyle ? ` in ${characterStyle} style` : "";
        requestBody = {
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: `Create a character portrait${charStyleText}. Character name: ${characterName}. Description: ${characterDescription}. Generate a detailed, high-quality character image.` }],
          modalities: ["image", "text"],
        };
        break;
      }
      case "video": {
        if (sourceImageUrl) {
          // Use Atlas Cloud wan-2.2-spicy for image-to-video
          isAtlasVideo = true;
          apiUrl = ATLAS_VIDEO_URL;
          apiKey = ATLAS_API_KEY;
          const videoPrompt = motionDescription || `Cinematic motion with ${motionPreset || "smooth"} camera movement`;
          requestBody = {
            model: "alibaba/wan-2.2-spicy/image-to-video",
            image: sourceImageUrl,
            prompt: videoPrompt,
            ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
          };
        } else {
          // No source image: generate a still frame via Lovable AI
          apiUrl = LOVABLE_AI_URL;
          apiKey = LOVABLE_API_KEY;
          const motionText = motionPreset ? ` with ${motionPreset} motion` : "";
          requestBody = {
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: `Create a cinematic still frame${motionText} suitable for animation. ${motionDescription || prompt || "A dynamic scene ready for animation."}. Ultra high resolution.` }],
            modalities: ["image", "text"],
          };
        }
        break;
      }
      default:
        throw new Error("Invalid generation type");
    }

    const requestJson = JSON.stringify(requestBody);
    console.log("Sending request to:", apiUrl, "body length:", requestJson.length, "model:", (requestBody as any).model);

    // Call the appropriate API
    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: requestJson,
    });

    if (!aiResponse.ok) {
      let errorDetail: string;
      try {
        const errorJson = await aiResponse.json();
        errorDetail = JSON.stringify(errorJson);
      } catch {
        try { errorDetail = await aiResponse.text(); } catch { errorDetail = "Could not read error body"; }
      }
      console.error("AI API error:", aiResponse.status, errorDetail);
      console.error("Request body sent:", requestJson.substring(0, 500));
      await supabase.from("ai_generations").update({ status: "failed" }).eq("id", generation.id);
      return new Response(JSON.stringify({ error: `AI generation failed: ${aiResponse.status}`, details: errorDetail }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    console.log("AI response keys:", JSON.stringify(Object.keys(aiData)));

    // Parse results
    const imageUrls: string[] = [];
    let videoUrl: string | null = null;
    let textContent = "";

    if (isAtlasVideo) {
      // Atlas Cloud generateVideo - check if sync mode returned a result directly
      const atlasData = aiData.data || aiData;
      const atlasOutputs = atlasData.output || atlasData.outputs || [];
      const directVideoUrl = Array.isArray(atlasOutputs) && atlasOutputs.length > 0 ? atlasOutputs[0] : null;
      
      if (directVideoUrl) {
        // Sync mode succeeded - we have the video URL directly
        // Deduct BREAD (skip for admin)
        if (!isAdmin && wallet) {
          await supabase.from("wallets").update({ balance: wallet.balance - cost }).eq("user_id", user.id);
          await supabase.from("wallet_transactions").insert({
            user_id: user.id, amount: -cost, type: "spend",
            description: `AI ${type} generation`, reference_id: generation.id,
          });
        }
        await supabase.from("ai_generations").update({
          status: "completed", result_url: directVideoUrl,
          metadata: { ...body, video_url: directVideoUrl },
        }).eq("id", generation.id);

        return new Response(JSON.stringify({
          success: true, generation_id: generation.id, polling: false,
          result: { images: [], video: { url: directVideoUrl }, text: "Video generated" },
          new_balance: isAdmin ? wallet?.balance ?? 0 : (wallet?.balance ?? 0) - cost,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Async mode - need to poll
      const atlasJobId = aiData.id || atlasData.id;
      console.log("Atlas video job ID:", atlasJobId, "status:", atlasData.status);
      
      await supabase.from("ai_generations").update({
        status: "processing",
        metadata: { ...body, atlas_job_id: atlasJobId, atlas_status: atlasData.status || "processing" },
      }).eq("id", generation.id);

      if (!isAdmin && wallet) {
        await supabase.from("wallets").update({ balance: wallet.balance - cost }).eq("user_id", user.id);
        await supabase.from("wallet_transactions").insert({
          user_id: user.id, amount: -cost, type: "spend",
          description: `AI ${type} generation`, reference_id: generation.id,
        });
      }

      return new Response(JSON.stringify({
        success: true, generation_id: generation.id, atlas_job_id: atlasJobId, polling: true,
        result: { images: [], video: null, text: `Video generation started` },
        new_balance: isAdmin ? wallet?.balance ?? 0 : (wallet?.balance ?? 0) - cost,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (isAtlasImage) {
      // Atlas Cloud generateImage returns { code, data: { outputs: [url, ...], status, ... } }
      const atlasData = aiData.data || aiData;
      const outputs = atlasData.outputs || [];
      for (const url of outputs) {
        if (url && typeof url === "string") {
          imageUrls.push(url);
        }
      }
      if (imageUrls.length === 0) {
        textContent = atlasData.status || aiData.message || "No images generated";
      }
    } else {
      // Lovable AI gateway format
      const generatedImages = aiData.choices?.[0]?.message?.images || [];
      textContent = aiData.choices?.[0]?.message?.content || "";

      for (let i = 0; i < generatedImages.length; i++) {
        const img = generatedImages[i];
        const base64Data = img.image_url?.url;
        if (!base64Data) continue;
        const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
        const binaryData = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
        const fileName = `${user.id}/${generation.id}_${i}.png`;
        const { error: uploadError } = await supabase.storage
          .from("ai-studio")
          .upload(fileName, binaryData, { contentType: "image/png", upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("ai-studio").getPublicUrl(fileName);
          imageUrls.push(urlData.publicUrl);
        }
      }
    }

    const resultUrl = videoUrl || imageUrls[0] || null;

    // Deduct BREAD (skip for admin)
    if (!isAdmin && wallet) {
      await supabase.from("wallets").update({ balance: wallet.balance - cost }).eq("user_id", user.id);
      await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        amount: -cost,
        type: "spend",
        description: `AI ${type} generation`,
        reference_id: generation.id,
      });
    }

    // Update generation record
    await supabase.from("ai_generations").update({
      status: "completed",
      result_url: resultUrl,
      metadata: { ...body, image_urls: imageUrls, ai_text: textContent },
    }).eq("id", generation.id);

    return new Response(JSON.stringify({
      success: true,
      generation_id: generation.id,
      result: { images: imageUrls.map(url => ({ url })), video: videoUrl ? { url: videoUrl } : null, text: textContent },
      new_balance: isAdmin ? wallet?.balance ?? 0 : (wallet?.balance ?? 0) - cost,
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
