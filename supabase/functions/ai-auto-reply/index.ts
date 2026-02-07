import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, creatorId, conversationId } = await req.json();

    // Fetch creator profile for context
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: creatorProfile } = await adminClient
      .from("profiles")
      .select("display_name, bio")
      .eq("user_id", creatorId)
      .maybeSingle();

    const creatorName = creatorProfile?.display_name || "Creator";
    const creatorBio = creatorProfile?.bio || "";

    // Get recent conversation history
    const { data: recentMessages } = await adminClient
      .from("messages")
      .select("content, sender_id, is_ai_reply")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    const history = (recentMessages || []).reverse().map((m) =>
      `${m.sender_id === creatorId ? creatorName : "Fan"}: ${m.content}`
    ).join("\n");

    // Generate AI reply using Lovable AI
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const aiResponse = await fetch("https://ai.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are ${creatorName}, a content creator. Your bio: "${creatorBio}". Reply to fan messages in a warm, flirty, engaging way. Keep replies short (1-3 sentences). Be personable and use emojis sparingly. Never break character.`,
          },
          {
            role: "user",
            content: `Recent conversation:\n${history}\n\nFan's new message: "${message}"\n\nReply as ${creatorName}:`,
          },
        ],
        max_tokens: 150,
      }),
    });

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "Thanks for your message! 💕";

    // Save the AI reply as a message from the creator
    await adminClient.from("messages").insert({
      conversation_id: conversationId,
      sender_id: creatorId,
      receiver_id: user.id,
      content: reply,
      is_ai_reply: true,
    });

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
