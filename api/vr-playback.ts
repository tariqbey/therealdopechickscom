import { createHash } from "node:crypto";

/**
 * Returns a SIGNED Bunny Stream HLS URL — but only after confirming, through
 * Supabase, that the caller is allowed to watch (creator / admin / free /
 * unlocked). The Supabase RPC get_vr_video_url() is the paywall gate; it
 * returns the Bunny video GUID only for authorized viewers, NULL otherwise.
 *
 * Uses Bunny's directory token authentication so the playlist and every HLS
 * segment under /{guid}/ are authorized by the same token.
 */
export const config = { runtime: "nodejs" };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const CDN_HOST = process.env.BUNNY_STREAM_CDN_HOST as string;
const TOKEN_KEY = process.env.BUNNY_STREAM_TOKEN_KEY as string;

function signDirectory(guid: string, expires: number) {
  const tokenPath = `/${guid}/`;
  const hash = createHash("sha256")
    .update(TOKEN_KEY + tokenPath + expires)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `token=${hash}&expires=${expires}&token_path=${encodeURIComponent(tokenPath)}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { videoId, token } = req.body || {};
    if (!videoId || !token) throw new Error("Missing videoId or token");

    // Paywall gate: RPC returns the Bunny GUID only if this user may watch.
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_vr_video_url`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_video_id: videoId }),
    });
    const guid = await rpcRes.json();
    if (!guid || typeof guid !== "string") {
      return res.status(403).json({ error: "locked" });
    }

    const expires = Math.floor(Date.now() / 1000) + 6 * 60 * 60; // 6 hours
    const query = signDirectory(guid, expires);
    const playlistUrl = `https://${CDN_HOST}/${guid}/playlist.m3u8?${query}`;

    return res.status(200).json({ playlistUrl, query });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
}
