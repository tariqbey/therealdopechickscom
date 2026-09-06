/**
 * Kicks off transcoding for an uploaded VR video.
 *
 * 1. Verifies the caller owns the video (RLS read with their token).
 * 2. Probes the source in R2 (duration, size, audio) with ffmpeg.
 * 3. Writes a plan (renditions + 45s chunks) to vr_transcode_jobs.
 * 4. Fans out one /api/vr-chunk call per chunk (+ one audio job) in parallel.
 *    The LAST chunk to finish assembles the playlists (see vr-chunk.ts), so this
 *    function never has to wait for the whole encode.
 */
export const config = { runtime: "nodejs", maxDuration: 300 };
import { waitUntil } from "@vercel/functions";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";
const ffmpegPath = ffmpegStatic as unknown as string;
import {
  INTERNAL, assertConfigured, buildPlan, getUser, internalHeaders, internalUrl, jobStart, selfOrigin, userSelect, videoGet, videoUpdate,
} from "./_lib/vr";

const run = promisify(execFile);

async function probe(videoId: string) {
  const url = internalUrl(`videos/${videoId}/source.mp4`);
  // ffmpeg -i prints stream info to stderr and exits non-zero (no output) — that's expected.
  let stderr = "";
  try {
    await run(ffmpegPath, ["-hide_banner", "-headers", `x-internal-secret: ${INTERNAL}\r\n`, "-i", url], { maxBuffer: 4 * 1024 * 1024 });
  } catch (e: any) { stderr = e.stderr || ""; }
  const dur = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const vid = /Stream #\d+:\d+.*?Video:.*?\s(\d{2,5})x(\d{2,5})/.exec(stderr);
  if (!dur || !vid) throw new Error("Could not read the video (unsupported file?)");
  const duration = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
  return { duration, width: Number(vid[1]), height: Number(vid[2]), hasAudio: /Stream #\d+:\d+.*?Audio:/.test(stderr) };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    assertConfigured();
    const { videoId, token } = req.body || {};
    if (!videoId) throw new Error("Missing videoId");
    let format: string | null = null;
    if ((req.headers["x-internal-secret"] || "") === INTERNAL) {
      // admin / re-transcode trigger
      const v = await videoGet(videoId);
      if (!v) throw new Error("Video not found");
      format = v.format;
    } else {
      if (!token) throw new Error("Missing token");
      const user = await getUser(token);
      const rows = await userSelect(token, "vr_videos", `id=eq.${videoId}&select=id,creator_id,format`);
      if (!rows[0] || rows[0].creator_id !== user.id) throw new Error("Not your video");
      format = rows[0].format;
    }

    // Make sure the upload actually landed.
    const head = await fetch(internalUrl(`videos/${videoId}/source.mp4`), { method: "HEAD", headers: internalHeaders() });
    if (!head.ok) throw new Error("Source file not found — upload incomplete");

    await videoUpdate(videoId, { status: "processing", progress: 1, transcode_error: null });

    const info = await probe(videoId);
    const plan = buildPlan(info.duration, info.width, info.height, info.hasAudio, format);
    const totalJobs = plan.chunks.length + (plan.hasAudio ? 1 : 0) + 1; // + thumbnail job
    await jobStart(videoId, plan, totalJobs);
    await videoUpdate(videoId, { width: info.width, height: info.height, duration_seconds: Math.round(info.duration), progress: 3 });

    const origin = selfOrigin();
    const fire = (body: Record<string, unknown>) =>
      fetch(`${origin}/api/vr-chunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL },
        body: JSON.stringify({ videoId, ...body }),
      }).catch((e) => console.error("chunk dispatch failed", e));

    const jobs: Promise<unknown>[] = [];
    jobs.push(fire({ mode: "thumb" }));
    if (plan.hasAudio) jobs.push(fire({ mode: "audio" }));
    for (const c of plan.chunks) jobs.push(fire({ mode: "video", index: c.index }));
    // Keep this invocation alive while the fan-out requests are in flight; the
    // chunk functions finish on their own regardless.
    waitUntil(Promise.allSettled(jobs));

    return res.status(202).json({ ok: true, plan: { duration: plan.duration, chunks: plan.chunks.length, renditions: plan.renditions.map((r) => r.name) } });
  } catch (err) {
    try {
      const { videoId } = req.body || {};
      if (videoId) await videoUpdate(videoId, { status: "ready", transcode_error: (err as Error).message });
    } catch { /* ignore */ }
    return res.status(400).json({ error: (err as Error).message });
  }
}
