import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const caller = data.user;
    if (!caller) throw new Error("Not authenticated");

    // Strict admin check — impersonation is admin-only
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("Admin access required");

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id required");
    if (user_id === caller.id) throw new Error("You are already signed in as this user");

    // Don't allow impersonating another admin
    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .eq("role", "admin")
      .maybeSingle();
    if (targetRole) throw new Error("Cannot impersonate another admin");

    const { data: targetUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (userErr || !targetUser?.user?.email) throw new Error("Target user not found");

    // Mint a one-time magiclink token the client exchanges for a session
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      throw new Error(linkErr?.message || "Failed to generate sign-in token");
    }

    console.log(`[admin-impersonate] admin ${caller.id} -> user ${user_id}`);

    return new Response(
      JSON.stringify({
        token_hash: link.properties.hashed_token,
        target_email: targetUser.user.email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
