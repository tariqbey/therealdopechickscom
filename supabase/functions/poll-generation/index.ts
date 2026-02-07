import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ATLAS_RESULT_URL = "https://api.atlascloud.ai/api/v1/model/result";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ATLAS_API_KEY = Deno.env.get("ATLAS_CLOUD_API_KEY");
  if (!ATLAS_API_KEY) throw new Error("ATLAS_CLOUD_API_KEY not configured");

  try {
    const { generationId } = await req.json();
    if (!generationId) throw new Error("generationId is required");

    const response = await fetch(`${ATLAS_RESULT_URL}/${generationId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ATLAS_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Atlas poll error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `Poll failed: ${response.status}`, details: errorText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("Poll result:", JSON.stringify(data).substring(0, 500));

    // Atlas result format: { id, urls: { get: "url" }, model, output: ["video_url"], status }
    const status = data.status || "processing";
    const output = data.output || [];
    const videoUrl = Array.isArray(output) && output.length > 0 ? output[0] : 
                     (data.urls?.get ? data.urls.get : null);

    return new Response(JSON.stringify({
      status: status === "succeeded" ? "succeeded" : "processing",
      videoUrl: status === "succeeded" ? videoUrl : null,
      raw: data,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("poll-generation error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
