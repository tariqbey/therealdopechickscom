import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { displayName, currentBio, isCreator } = await req.json();

    const prompt = isCreator
      ? `You are an expert social media bio writer for content creators on a premium adult creator platform. Write a detailed, compelling, and seductive bio for a creator named "${displayName || "a creator"}". ${currentBio ? `Their current bio is: "${currentBio}". Expand and improve it significantly.` : "Create a fresh, detailed bio."} 

Requirements:
- Write 3-5 sentences (400-500 characters)
- Include personality traits, content style, and what makes them unique
- Be flirty, confident, and enticing but classy
- Mention content themes they might cover
- Include a call-to-action for subscribers
- Use 2-3 emojis maximum
- Do NOT use hashtags
- Output ONLY the bio text, nothing else.`
      : `Write an engaging social media bio for a user named "${displayName || "someone"}". ${currentBio ? `Their current bio is: "${currentBio}". Expand and improve it.` : "Create a fresh bio."} Write 2-3 sentences (200-300 characters). Be friendly, authentic, and personable. Output ONLY the bio text, nothing else.`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You write detailed, compelling social media bios that capture personality and entice followers. Output only the bio text." },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Gateway error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    const bio = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ bio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error generating bio:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
