/**
 * Returns a playable URL for a VR video — but only after the Supabase RPC
 * get_vr_video_url() confirms the caller may watch (creator / admin / free /
 * unlocked). Logged-out visitors are checked as `anon`, which only free videos pass.
 *
 * Source values:  r2:<videoId>:hls     → signed HLS master on our Worker
 *                 r2:<videoId>:source  → signed original MP4 (fallback / not transcoded yet)
 *                 https://…            → passed through as-is
 */
export const config = { runtime: "nodejs" };
import { SUPABASE_ANON, SUPABASE_URL, playbackUrl } from "./_lib/vr";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { videoId, token } = req.body || {};
    if (!videoId) throw new Error("Missing videoId");

    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_vr_video_url`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token || SUPABASE_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_video_id: videoId }),
    });
    const source = await rpcRes.json();
    if (!source || typeof source !== "string") return res.status(403).json({ error: "locked" });

    if (/^https?:\/\//i.test(source)) return res.status(200).json({ playlistUrl: source });

    const m = /^r2:([A-Za-z0-9-]+):(hls|source)$/.exec(source);
    if (!m) return res.status(500).json({ error: "Unknown source type" });
    const [, id, kind] = m;
    const path = kind === "hls" ? "master.m3u8" : "source.mp4";
    return res.status(200).json({ playlistUrl: playbackUrl(id, path), kind });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
}
