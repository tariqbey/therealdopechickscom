/**
 * One unit of transcoding work, invoked by /api/vr-process (internal secret):
 *   mode "video"  → encode chunk N of the source into every rendition (4s HLS segments)
 *   mode "audio"  → encode the whole audio track to an AAC HLS rendition
 *   mode "thumb"  → grab a poster frame (left eye for side-by-side 3D)
 * Each job uploads its files to R2 via the Worker, writes a small manifest, and bumps
 * the job counter. Whichever job finishes LAST stitches master + rendition playlists
 * and flips the video to `r2:<id>:hls` / status ready.
 */
export const config = { runtime: "nodejs", maxDuration: 800 };
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
const ffmpegPath = ffmpegStatic as unknown as string;
import {
  INTERNAL, deletePrefix, getObjectText, internalUrl, jobDone, jobGet, jobStatus, listPrefix, putObject, setSource, thumbUrl, videoGet, videoUpdate, type Plan,
} from "./_lib/vr.js";

const ffmpeg = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); if (err.length > 20000) err = err.slice(-20000); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-1500)}`))));
  });

const parseDurations = (m3u8: string) =>
  [...m3u8.matchAll(/#EXTINF:([\d.]+)/g)].map((m) => Number(m[1]));

async function uploadDir(dir: string, keyPrefix: string, contentType: string, skip: (f: string) => boolean = () => false) {
  const files = (await readdir(dir)).filter((f) => !skip(f)).sort();
  const queue = [...files];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const f = queue.shift()!;
      const buf = await readFile(join(dir, f));
      await putObject(`${keyPrefix}/${f}`, buf, contentType);
    }
  });
  await Promise.all(workers);
  return files;
}

async function finalize(videoId: string, plan: Plan) {
  const manifests = await listPrefix(`videos/${videoId}/_work/`);
  const chunks: { index: number; segments: Record<string, { file: string; duration: number }[]> }[] = [];
  for (const m of manifests) chunks.push(JSON.parse(await getObjectText(m.key)));
  chunks.sort((a, b) => a.index - b.index);
  if (chunks.length !== plan.chunks.length) throw new Error(`expected ${plan.chunks.length} chunk manifests, found ${chunks.length}`);

  const header = (target: number) =>
    `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:${target}\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-INDEPENDENT-SEGMENTS\n`;
  for (const r of plan.renditions) {
    let body = "";
    let maxDur = 0;
    for (const c of chunks) {
      for (const s of c.segments[r.name] || []) {
        body += `#EXTINF:${s.duration.toFixed(3)},\n${s.file}\n`;
        maxDur = Math.max(maxDur, s.duration);
      }
    }
    await putObject(`videos/${videoId}/${r.name}/index.m3u8`, header(Math.ceil(maxDur) || 5) + body + "#EXT-X-ENDLIST\n", "application/vnd.apple.mpegurl");
  }

  let master = "#EXTM3U\n#EXT-X-VERSION:3\n";
  if (plan.hasAudio) master += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Audio",DEFAULT=YES,AUTOSELECT=YES,URI="audio/index.m3u8"\n`;
  for (const r of [...plan.renditions].sort((a, b) => b.bitrateK - a.bitrateK)) {
    const bw = (r.bitrateK + (plan.hasAudio ? 160 : 0)) * 1000;
    master += `#EXT-X-STREAM-INF:BANDWIDTH=${bw},AVERAGE-BANDWIDTH=${Math.round(bw * 0.92)},RESOLUTION=${r.width}x${r.height},CODECS="avc1.640033${plan.hasAudio ? ",mp4a.40.2" : ""}"${plan.hasAudio ? ',AUDIO="aud"' : ""}\n${r.name}/index.m3u8\n`;
  }
  await putObject(`videos/${videoId}/master.m3u8`, master, "application/vnd.apple.mpegurl");

  await setSource(videoId, `r2:${videoId}:hls`);
  await videoUpdate(videoId, { status: "ready", progress: 100, transcode_error: null });
  await jobStatus(videoId, "done");
  await deletePrefix(`videos/${videoId}/_work/`).catch(() => {}); // best-effort cleanup
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if ((req.headers["x-internal-secret"] || "") !== INTERNAL) return res.status(403).json({ error: "Forbidden" });
  const { videoId, mode, index } = req.body || {};
  if (!videoId || !mode) return res.status(400).json({ error: "Missing videoId/mode" });

  const job = await jobGet(videoId);
  if (!job) return res.status(404).json({ error: "No job" });
  const plan = job.plan as Plan;
  const src = internalUrl(`videos/${videoId}/source.mp4`);
  const inputArgs = ["-headers", `x-internal-secret: ${INTERNAL}\r\n`];
  const work = await mkdtemp(join(tmpdir(), "vr-"));

  try {
    if (mode === "thumb") {
      const t = Math.min(3, Math.max(0, plan.duration / 3));
      const vf = plan.sideBySide ? "crop=iw/2:ih:0:0,scale=900:-2" : "scale=900:-2";
      await ffmpeg([...inputArgs, "-ss", String(t), "-i", src, "-frames:v", "1", "-vf", vf, "-q:v", "3", join(work, "thumb.jpg")]);
      await putObject(`videos/${videoId}/thumb.jpg`, await readFile(join(work, "thumb.jpg")), "image/jpeg");
      const v = await videoGet(videoId);
      if (v && !v.thumbnail_url) await videoUpdate(videoId, { thumbnail_url: thumbUrl(videoId) });
    } else if (mode === "audio") {
      const dir = join(work, "audio");
      await mkdir(dir, { recursive: true });
      await ffmpeg([...inputArgs, "-i", src, "-vn", "-map", "0:a:0", "-c:a", "aac", "-b:a", "160k", "-ac", "2",
        "-f", "hls", "-hls_time", "4", "-hls_list_size", "0", "-hls_playlist_type", "vod", "-hls_flags", "independent_segments",
        "-hls_segment_type", "mpegts", "-hls_segment_filename", join(dir, "a_%05d.ts"), join(dir, "index.m3u8")]);
      await uploadDir(dir, `videos/${videoId}/audio`, "video/mp2t", (f) => f.endsWith(".m3u8"));
      await putObject(`videos/${videoId}/audio/index.m3u8`, await readFile(join(dir, "index.m3u8")), "application/vnd.apple.mpegurl");
    } else if (mode === "video") {
      const chunk = plan.chunks[Number(index)];
      if (!chunk) throw new Error(`No chunk ${index}`);
      const args = [...inputArgs, "-ss", chunk.start.toFixed(3), "-t", chunk.duration.toFixed(3), "-i", src, "-an"];
      const manifest: Record<string, { file: string; duration: number }[]> = {};
      for (const r of plan.renditions) {
        const dir = join(work, r.name);
        await mkdir(dir, { recursive: true });
        args.push(
          "-map", "0:v:0", "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-level", "5.1", "-pix_fmt", "yuv420p",
          "-b:v", `${r.bitrateK}k`, "-maxrate", `${r.maxrateK}k`, "-bufsize", `${r.maxrateK * 2}k`,
          "-vf", `scale=${r.width}:${r.height}:flags=lanczos`,
          "-g", "120", "-keyint_min", "120", "-sc_threshold", "0", "-force_key_frames", "expr:gte(t,n_forced*4)",
          "-output_ts_offset", chunk.start.toFixed(3),
          "-f", "hls", "-hls_time", "4", "-hls_list_size", "0", "-hls_playlist_type", "vod", "-hls_flags", "independent_segments",
          "-hls_segment_type", "mpegts", "-hls_segment_filename", join(dir, `c${String(chunk.index).padStart(4, "0")}_%04d.ts`), join(dir, "index.m3u8"),
        );
      }
      await ffmpeg(args);
      for (const r of plan.renditions) {
        const dir = join(work, r.name);
        const files = await uploadDir(dir, `videos/${videoId}/${r.name}`, "video/mp2t", (f) => f.endsWith(".m3u8"));
        const durations = parseDurations(await readFile(join(dir, "index.m3u8"), "utf8"));
        manifest[r.name] = files.map((f, i) => ({ file: f, duration: durations[i] ?? 4 }));
      }
      await putObject(`videos/${videoId}/_work/c${String(chunk.index).padStart(4, "0")}.json`, JSON.stringify({ index: chunk.index, segments: manifest }), "application/json");
    } else {
      throw new Error(`Unknown mode ${mode}`);
    }

    const done = await jobDone(videoId);
    const progress = Math.max(3, Math.min(99, Math.round((done.done_jobs / done.total_jobs) * 100)));
    await videoUpdate(videoId, { progress });
    if (done.done_jobs >= done.total_jobs) await finalize(videoId, plan);
    return res.status(200).json({ ok: true, mode, index, done });
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[vr-chunk] ${videoId} ${mode} ${index ?? ""} failed:`, message);
    try {
      await jobStatus(videoId, "failed", message);
      // Keep the video watchable from the original file.
      await videoUpdate(videoId, { status: "ready", transcode_error: message });
    } catch { /* ignore */ }
    return res.status(500).json({ error: message });
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
