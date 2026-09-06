/**
 * Dope Chicks VR media Worker (Cloudflare Workers + R2).
 *
 *   Playback   GET  /v/:token/:exp/:videoId/<path>      signed, expiring, Range-aware
 *   Thumbnail  GET  /t/:videoId/thumb.jpg                public poster frame
 *   Upload     POST /u/:token/:exp/:videoId/create       resumable multipart, browser → R2
 *              PUT  /u/:token/:exp/:videoId/part/:uploadId/:n
 *              POST /u/:token/:exp/:videoId/complete     { uploadId, parts:[{partNumber, etag}] }
 *              DELETE /u/:token/:exp/:videoId/abort/:uploadId
 *   Internal   GET|PUT|HEAD /i/object/<key>              transcoder + admin (x-internal-secret)
 *              DELETE /i/prefix/<prefix>
 *              GET  /i/list/<prefix>
 *
 * Tokens are HMAC-SHA256(SIGNING_SECRET, `${scope}:${videoId}:${exp}`) base64url, minted
 * by the Vercel API after it has checked the BREAD paywall / creator role. Objects live
 * under videos/<videoId>/… so one directory token covers a whole HLS tree.
 */
export interface Env {
  VR: R2Bucket;
  SIGNING_SECRET: string;
  INTERNAL_SECRET: string;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, PUT, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range, x-internal-secret, x-upload-id",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, ETag, x-etag",
  "Access-Control-Max-Age": "86400",
};

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS, ...extra } });
const err = (message: string, status: number) => json({ error: message }, status);

const contentTypeFor = (key: string) => {
  const k = key.toLowerCase();
  if (k.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (k.endsWith(".ts")) return "video/mp2t";
  if (k.endsWith(".mp4") || k.endsWith(".m4s")) return "video/mp4";
  if (k.endsWith(".jpg") || k.endsWith(".jpeg")) return "image/jpeg";
  if (k.endsWith(".png")) return "image/png";
  if (k.endsWith(".webp")) return "image/webp";
  if (k.endsWith(".json")) return "application/json";
  return "application/octet-stream";
};

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifyToken(env: Env, scope: "play" | "upload", token: string, exp: string, videoId: string) {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) return false;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(videoId)) return false;
  const expected = await hmac(env.SIGNING_SECRET, `${scope}:${videoId}:${exp}`);
  return timingSafeEqual(expected, token);
}

/** Serve an R2 object with Range support and sensible caching. */
async function serveObject(env: Env, key: string, request: Request, publicCache: boolean) {
  const rangeHeader = request.headers.get("Range");
  let range: R2Range | undefined;
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (m) {
      if (m[1] && m[2]) range = { offset: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 };
      else if (m[1]) range = { offset: Number(m[1]) };
      else if (m[2]) range = { suffix: Number(m[2]) };
    }
  }
  const obj = request.method === "HEAD" ? await env.VR.head(key) : await env.VR.get(key, { range, onlyIf: request.headers });
  if (!obj) return err("Not found", 404);

  const headers = new Headers(CORS);
  obj.writeHttpMetadata(headers);
  headers.set("ETag", obj.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  if (!headers.get("Content-Type") || headers.get("Content-Type") === "application/octet-stream") headers.set("Content-Type", contentTypeFor(key));
  const isPlaylist = key.endsWith(".m3u8");
  headers.set("Cache-Control", publicCache ? (isPlaylist ? "public, max-age=60" : "public, max-age=31536000, immutable") : "private, no-store");

  if (request.method === "HEAD") {
    headers.set("Content-Length", String(obj.size));
    return new Response(null, { status: 200, headers });
  }
  const body = obj as R2ObjectBody;
  if (!("body" in body) || !body.body) return new Response(null, { status: 304, headers }); // onlyIf matched
  if (range) {
    const size = obj.size;
    let start: number, end: number;
    if ("suffix" in range) { start = size - range.suffix; end = size - 1; }
    else { start = range.offset ?? 0; end = range.length != null ? start + range.length - 1 : size - 1; }
    end = Math.min(end, size - 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(body.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(obj.size));
  return new Response(body.body, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const area = parts[0];

    // ---------- signed playback: /v/:token/:exp/:videoId/<path> ----------
    if (area === "v") {
      const [, token, exp, videoId, ...rest] = parts;
      if (!token || !exp || !videoId || rest.length === 0) return err("Bad request", 400);
      if (!(await verifyToken(env, "play", token, exp, videoId))) return err("Invalid or expired token", 403);
      if (request.method !== "GET" && request.method !== "HEAD") return err("Method not allowed", 405);
      const key = `videos/${videoId}/${rest.join("/")}`;
      if (key.includes("..") || key.endsWith("/source.mp4") && url.searchParams.get("orig") !== "1") {
        // the raw upload is only served when explicitly requested (fallback playback)
        if (key.includes("..")) return err("Bad path", 400);
      }
      return serveObject(env, key, request, true);
    }

    // ---------- public thumbnails: /t/:videoId/thumb.jpg ----------
    if (area === "t") {
      const [, videoId, file] = parts;
      if (!videoId || file !== "thumb.jpg" || !/^[A-Za-z0-9_-]{8,128}$/.test(videoId)) return err("Not found", 404);
      if (request.method !== "GET" && request.method !== "HEAD") return err("Method not allowed", 405);
      return serveObject(env, `videos/${videoId}/thumb.jpg`, request, true);
    }

    // ---------- browser uploads: /u/:token/:exp/:videoId/... ----------
    if (area === "u") {
      const [, token, exp, videoId, action, uploadId, partNo] = parts;
      if (!token || !exp || !videoId || !action) return err("Bad request", 400);
      if (!(await verifyToken(env, "upload", token, exp, videoId))) return err("Invalid or expired upload token", 403);
      const key = `videos/${videoId}/source.mp4`;

      if (action === "create" && request.method === "POST") {
        const mp = await env.VR.createMultipartUpload(key, { httpMetadata: { contentType: "video/mp4" } });
        return json({ uploadId: mp.uploadId, key });
      }
      if (action === "part" && request.method === "PUT" && uploadId && partNo) {
        if (!request.body) return err("Empty part", 400);
        const mp = env.VR.resumeMultipartUpload(key, uploadId);
        const part = await mp.uploadPart(Number(partNo), request.body);
        return json({ partNumber: part.partNumber, etag: part.etag }, 200, { "x-etag": part.etag });
      }
      if (action === "complete" && request.method === "POST") {
        const body = (await request.json()) as { uploadId: string; parts: { partNumber: number; etag: string }[] };
        const mp = env.VR.resumeMultipartUpload(key, body.uploadId);
        const obj = await mp.complete(body.parts);
        return json({ key, size: obj.size, etag: obj.httpEtag });
      }
      if (action === "abort" && request.method === "DELETE" && uploadId) {
        await env.VR.resumeMultipartUpload(key, uploadId).abort();
        return json({ ok: true });
      }
      return err("Unknown upload action", 404);
    }

    // ---------- internal (transcoder / admin): /i/... ----------
    if (area === "i") {
      const secret = request.headers.get("x-internal-secret") || "";
      if (!env.INTERNAL_SECRET || !timingSafeEqual(secret, env.INTERNAL_SECRET)) return err("Forbidden", 403);
      const kind = parts[1];
      const rest = parts.slice(2).join("/");
      if (!rest || rest.includes("..")) return err("Bad key", 400);

      if (kind === "object") {
        if (request.method === "GET" || request.method === "HEAD") return serveObject(env, rest, request, false);
        if (request.method === "PUT") {
          const ct = request.headers.get("Content-Type") || contentTypeFor(rest);
          const obj = await env.VR.put(rest, request.body, { httpMetadata: { contentType: ct } });
          return json({ key: rest, size: obj.size, etag: obj.httpEtag });
        }
        if (request.method === "DELETE") { await env.VR.delete(rest); return json({ ok: true }); }
        return err("Method not allowed", 405);
      }
      if (kind === "list" && request.method === "GET") {
        const out: { key: string; size: number }[] = [];
        let cursor: string | undefined;
        do {
          const page = await env.VR.list({ prefix: rest, cursor, limit: 1000 });
          for (const o of page.objects) out.push({ key: o.key, size: o.size });
          cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);
        return json({ prefix: rest, objects: out });
      }
      if (kind === "prefix" && request.method === "DELETE") {
        let deleted = 0;
        let cursor: string | undefined;
        do {
          const page = await env.VR.list({ prefix: rest, cursor, limit: 1000 });
          const keys = page.objects.map((o) => o.key);
          if (keys.length) { await env.VR.delete(keys); deleted += keys.length; }
          cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);
        return json({ deleted });
      }
      return err("Unknown internal route", 404);
    }

    if (url.pathname === "/" || url.pathname === "/health") return json({ ok: true, service: "dopechicks-vr" });
    return err("Not found", 404);
  },
} satisfies ExportedHandler<Env>;
