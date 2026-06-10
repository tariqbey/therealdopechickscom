/**
 * Deletes a VR video's underlying Bunny Stream asset. Authorization is enforced
 * by reading the source row with the CALLER's Supabase token — RLS only returns
 * it if they own the video (or are admin), so a non-owner gets nothing.
 */
export const config = { runtime: "nodejs" };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID as string;
const API_KEY = process.env.BUNNY_STREAM_API_KEY as string;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { videoId, token } = req.body || {};
    if (!videoId || !token) throw new Error("Missing videoId or token");

    // RLS gate: only the owner/admin can read the source row (holds Bunny GUID).
    const srcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/vr_video_sources?video_id=eq.${videoId}&select=blob_url`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` } }
    );
    const rows = await srcRes.json();
    const bunnyGuid = Array.isArray(rows) && rows[0]?.blob_url;
    if (!bunnyGuid) return res.status(200).json({ ok: true, note: "no asset to delete" });

    await fetch(`https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${bunnyGuid}`, {
      method: "DELETE",
      headers: { AccessKey: API_KEY, accept: "application/json" },
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
}
