/**
 * Deletes a VR video's files from R2. Authorization: the source row is read with
 * the CALLER's Supabase token, so RLS only returns it to the owner or an admin.
 */
export const config = { runtime: "nodejs" };
import { assertConfigured, deletePrefix, userSelect } from "./_lib/vr";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    assertConfigured();
    const { videoId, token } = req.body || {};
    if (!videoId || !token) throw new Error("Missing videoId or token");
    const rows = await userSelect(token, "vr_video_sources", `video_id=eq.${videoId}&select=blob_url`);
    const source = rows[0]?.blob_url as string | undefined;
    if (!source) return res.status(200).json({ ok: true, note: "no asset to delete" });
    const m = /^r2:([A-Za-z0-9-]+):/.exec(source);
    if (m) await deletePrefix(`videos/${m[1]}/`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
}
