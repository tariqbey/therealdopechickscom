/**
 * Prepares a creator upload. Verifies the caller is a creator via their Supabase
 * JWT, then hands back a short-lived, video-scoped upload URL on our Cloudflare
 * Worker. The browser streams the file straight to R2 in resumable 20MB parts.
 */
export const config = { runtime: "nodejs" };
import { assertConfigured, getUser, newVideoId, uploadBase, userSelect } from "./_lib/vr";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    assertConfigured();
    const { token } = req.body || {};
    if (!token) throw new Error("Not authenticated");
    const user = await getUser(token);
    const profiles = await userSelect(token, "profiles", `user_id=eq.${user.id}&select=is_creator`);
    if (!profiles[0]?.is_creator) throw new Error("Creator access required");

    const videoId = newVideoId();
    return res.status(200).json({ videoId, uploadBase: uploadBase(videoId), partSize: 20 * 1024 * 1024 });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
}
