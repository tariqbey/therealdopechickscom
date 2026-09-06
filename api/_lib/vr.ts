/**
 * Shared helpers for the VR media pipeline (Cloudflare R2 behind our Worker +
 * ffmpeg on Vercel). Objects live at videos/<videoId>/… in the bucket:
 *   source.mp4            original upload
 *   master.m3u8           HLS master (after transcode)
 *   <rendition>/index.m3u8 + c<chunk>_<n>.ts
 *   audio/index.m3u8 + a_<n>.ts
 *   thumb.jpg             auto thumbnail
 *   _work/c<chunk>.json   per-chunk manifests (deleted on finalize)
 */
import { createHmac, randomUUID } from "node:crypto";

export const WORKER = (process.env.VR_WORKER_URL || "").replace(/\/$/, "");
const SIGNING = process.env.VR_SIGNING_SECRET || "";
export const INTERNAL = process.env.VR_INTERNAL_SECRET || "";
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const assertConfigured = () => {
  if (!WORKER || !SIGNING || !INTERNAL) throw new Error("VR storage is not configured (VR_WORKER_URL / VR_SIGNING_SECRET / VR_INTERNAL_SECRET)");
};

const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const signToken = (scope: "play" | "upload", videoId: string, exp: number) =>
  b64url(createHmac("sha256", SIGNING).update(`${scope}:${videoId}:${exp}`).digest());

export const playbackUrl = (videoId: string, path: string, ttlSeconds = 6 * 3600) => {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${WORKER}/v/${signToken("play", videoId, exp)}/${exp}/${videoId}/${path}`;
};
export const uploadBase = (videoId: string, ttlSeconds = 12 * 3600) => {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${WORKER}/u/${signToken("upload", videoId, exp)}/${exp}/${videoId}`;
};
export const thumbUrl = (videoId: string) => `${WORKER}/t/${videoId}/thumb.jpg`;
export const newVideoId = () => randomUUID();

/** Internal (secret-authenticated) access to the bucket through the Worker. */
export const internalUrl = (key: string) => `${WORKER}/i/object/${key}`;
export const internalHeaders = (extra: Record<string, string> = {}) => ({ "x-internal-secret": INTERNAL, ...extra });
export async function putObject(key: string, body: Buffer | Uint8Array | string, contentType: string) {
  const r = await fetch(internalUrl(key), { method: "PUT", headers: internalHeaders({ "Content-Type": contentType }), body });
  if (!r.ok) throw new Error(`PUT ${key} failed: ${r.status} ${await r.text()}`);
}
export async function getObjectText(key: string) {
  const r = await fetch(internalUrl(key), { headers: internalHeaders() });
  if (!r.ok) throw new Error(`GET ${key} failed: ${r.status}`);
  return r.text();
}
export async function headObject(key: string) {
  const r = await fetch(internalUrl(key), { method: "HEAD", headers: internalHeaders() });
  return r.ok ? Number(r.headers.get("content-length") || 0) : null;
}
export async function listPrefix(prefix: string): Promise<{ key: string; size: number }[]> {
  const r = await fetch(`${WORKER}/i/list/${prefix}`, { headers: internalHeaders() });
  if (!r.ok) throw new Error(`LIST ${prefix} failed: ${r.status}`);
  return (await r.json()).objects;
}
export async function deletePrefix(prefix: string) {
  const r = await fetch(`${WORKER}/i/prefix/${prefix}`, { method: "DELETE", headers: internalHeaders() });
  if (!r.ok) throw new Error(`DELETE ${prefix} failed: ${r.status}`);
}

/** Supabase helpers. User-scoped calls respect RLS. Pipeline calls go through
 *  SECURITY DEFINER functions gated by the pipeline secret (no service-role key). */
export async function getUser(token: string) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("Invalid session");
  const u = await r.json();
  if (!u?.id) throw new Error("Invalid session");
  return u as { id: string; email?: string };
}
export async function userSelect<T = any>(token: string, table: string, query: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Supabase ${table}: ${r.status}`);
  return r.json();
}
export async function pipe<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: INTERNAL, ...args }),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  const text = await r.text();
  return (text ? JSON.parse(text) : null) as T;
}
export const videoUpdate = (videoId: string, patch: Record<string, unknown>) => pipe("vr_pipeline_video_update", { p_video_id: videoId, p_patch: patch });
export const videoGet = (videoId: string) => pipe<{ id: string; creator_id: string; format: string; thumbnail_url: string | null; status: string } | null>("vr_pipeline_video_get", { p_video_id: videoId });
export const setSource = (videoId: string, source: string) => pipe("vr_pipeline_set_source", { p_video_id: videoId, p_source: source });
export const jobStart = (videoId: string, plan: unknown, total: number) => pipe("vr_pipeline_job_start", { p_video_id: videoId, p_plan: plan, p_total: total });
export const jobGet = (videoId: string) => pipe<{ plan: Plan; total_jobs: number; done_jobs: number; status: string } | null>("vr_pipeline_job_get", { p_video_id: videoId });
export const jobDone = (videoId: string) => pipe<{ done_jobs: number; total_jobs: number }>("vr_pipeline_job_done", { p_video_id: videoId });
export const jobStatus = (videoId: string, status: string, error?: string) => pipe("vr_pipeline_job_status", { p_video_id: videoId, p_status: status, p_error: error ?? null });

/** Where this deployment can reach itself (for fan-out to worker functions). */
export const selfOrigin = () => {
  const host = process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : "http://localhost:3000";
};

// ---------- transcode plan ----------
export interface Rendition { name: string; width: number; height: number; bitrateK: number; maxrateK: number }
export interface Plan {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  chunkSeconds: number;
  chunks: { index: number; start: number; duration: number }[];
  renditions: Rendition[];
  sideBySide: boolean;
}
export const CHUNK_SECONDS = 45;

export function buildPlan(duration: number, width: number, height: number, hasAudio: boolean, format?: string | null): Plan {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const aspect = width / height;
  const ladder: Rendition[] = [];
  const add = (w: number, bitrateK: number) => {
    if (ladder.some((r) => r.width === w)) return;
    ladder.push({ name: w >= 3840 ? "4k" : `${even(w / aspect)}p`, width: even(w), height: even(w / aspect), bitrateK, maxrateK: Math.round(bitrateK * 1.15) });
  };
  const native = Math.min(width, 4096);
  const px = native * (native / aspect);
  const nativeK = px >= 7_000_000 ? 14000 : px >= 3_000_000 ? 8000 : px >= 1_900_000 ? 5000 : 3000;
  add(native, nativeK);
  if (native >= 3600) add(2560, 6000);
  if (native >= 2400) add(1920, 3500);
  const chunks = [];
  for (let i = 0, t = 0; t < duration - 0.05; i++, t += CHUNK_SECONDS) chunks.push({ index: i, start: t, duration: Math.min(CHUNK_SECONDS, duration - t) });
  return {
    duration, width, height, hasAudio, chunkSeconds: CHUNK_SECONDS, chunks, renditions: ladder,
    sideBySide: format ? format.endsWith("_LR") : aspect > 1.7 && aspect < 2.3,
  };
}
