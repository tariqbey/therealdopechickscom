import { createHash } from "node:crypto";

/**
 * Prepares a Bunny Stream upload. Verifies the caller is a creator (via their
 * Supabase JWT), creates the video object in the Bunny library, and returns a
 * pre-signed TUS (resumable) upload signature so the browser can push the large
 * VR file straight to Bunny — which then auto-transcodes it to adaptive HLS.
 */
export const config = { runtime: "nodejs" };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID as string;
const API_KEY = process.env.BUNNY_STREAM_API_KEY as string;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { token, title } = req.body || {};
    if (!token) throw new Error("Not authenticated");

    // Verify the Supabase user is a creator
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) throw new Error("Invalid session");
    const user = await userRes.json();
    if (!user?.id) throw new Error("Invalid session");

    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}&select=is_creator`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` } }
    );
    const profiles = await profRes.json();
    if (!Array.isArray(profiles) || !profiles[0]?.is_creator) {
      throw new Error("Creator access required");
    }

    // 1. Create the video object in Bunny Stream → returns its GUID
    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`,
      {
        method: "POST",
        headers: { AccessKey: API_KEY, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ title: (title || "VR Video").slice(0, 200) }),
      }
    );
    if (!createRes.ok) throw new Error("Failed to create Bunny video");
    const video = await createRes.json();
    const videoId = video.guid;

    // 2. Pre-sign the TUS resumable upload:
    //    signature = sha256(libraryId + apiKey + expiration + videoId)
    const expiration = Date.now() + 6 * 60 * 60 * 1000; // 6 hours
    const signature = createHash("sha256")
      .update(LIBRARY_ID + API_KEY + expiration + videoId)
      .digest("hex");

    return res.status(200).json({
      videoId,
      libraryId: LIBRARY_ID,
      expiration,
      signature,
      tusEndpoint: "https://video.bunnycdn.com/tusupload",
    });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
}
