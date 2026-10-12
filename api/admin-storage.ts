/**
 * Storage usage for the admin dashboard. Verifies the caller is an admin (their
 * Supabase JWT → has_role), then sums the R2 bucket through the Worker's
 * internal list and groups it by creator.
 */
export const config = { runtime: "nodejs" };
import { SUPABASE_ANON, SUPABASE_URL, WORKER, getUser, internalHeaders, userSelect } from "./_lib/vr.js";

export default async function handler(req: any, res: any) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const user = await getUser(token);
    const roles = await userSelect(token, "user_roles", `user_id=eq.${user.id}&role=eq.admin&select=role`);
    if (!roles.length) return res.status(403).json({ error: "Admin only" });
    if (!WORKER) return res.status(200).json({ total_bytes: 0, videos: 0, by_creator: [], limit_bytes: 10 * 1e9 });

    const r = await fetch(`${WORKER}/i/list/videos/`, { headers: internalHeaders() });
    if (!r.ok) throw new Error(`list failed ${r.status}`);
    const { objects } = (await r.json()) as { objects: { key: string; size: number }[] };
    const byVideo = new Map<string, number>();
    let total = 0;
    for (const o of objects) {
      const id = o.key.split("/")[1];
      if (!id) continue;
      byVideo.set(id, (byVideo.get(id) || 0) + o.size);
      total += o.size;
    }
    // Map video ids → creators via the caller's token (admin RLS sees all vr_videos)
    const ids = [...byVideo.keys()].filter((k) => /^[0-9a-f-]{36}$/.test(k));
    const byCreator = new Map<string, number>();
    if (ids.length) {
      const vids = await userSelect(token, "vr_videos", `id=in.(${ids.join(",")})&select=id,creator_id`);
      for (const v of vids) byCreator.set(v.creator_id, (byCreator.get(v.creator_id) || 0) + (byVideo.get(v.id) || 0));
    }
    const creatorIds = [...byCreator.keys()];
    const names = new Map<string, string | null>();
    if (creatorIds.length) {
      const profs = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=in.(${creatorIds.join(",")})&select=user_id,display_name`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` } }).then((x) => x.json());
      for (const p of profs) names.set(p.user_id, p.display_name);
    }
    const by_creator = creatorIds.map((c) => ({ creator_id: c, name: names.get(c) ?? null, bytes: byCreator.get(c) || 0 })).sort((a, b) => b.bytes - a.bytes);
    return res.status(200).json({ total_bytes: total, videos: ids.length, by_creator, limit_bytes: 10 * 1e9 });
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
}
