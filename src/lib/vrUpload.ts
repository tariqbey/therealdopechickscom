import { supabase } from "@/integrations/supabase/client";

/**
 * Resumable browser → R2 upload through the Dope Chicks media Worker.
 * 1. /api/vr-upload verifies the creator and returns a video-scoped upload URL.
 * 2. The file is sent in parallel 20MB parts (each retried up to 4 times).
 * 3. The multipart upload is completed; the caller then creates the DB rows and
 *    calls /api/vr-process to start transcoding.
 */
export interface UploadHandle { videoId: string; uploadBase: string; partSize: number }

export async function prepareUpload(): Promise<UploadHandle> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Session expired — sign in again");
  const res = await fetch("/api/vr-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: session.access_token }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Upload prep failed");
  return data as UploadHandle;
}

const putPart = (url: string, blob: Blob, onProgress: (sent: number) => void) =>
  new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText).etag); } catch { reject(new Error("Bad part response")); }
      } else reject(new Error(`Part upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(blob);
  });

export async function uploadSource(
  handle: UploadHandle,
  file: File,
  onProgress: (fraction: number) => void,
  concurrency = 3
): Promise<void> {
  const createRes = await fetch(`${handle.uploadBase}/create`, { method: "POST" });
  const { uploadId } = await createRes.json();
  if (!createRes.ok || !uploadId) throw new Error("Could not start upload");

  const partSize = handle.partSize;
  const total = Math.ceil(file.size / partSize);
  const sentByPart = new Array<number>(total).fill(0);
  const etags = new Array<string>(total);
  const report = () => onProgress(Math.min(0.999, sentByPart.reduce((a, b) => a + b, 0) / file.size));

  let next = 0;
  let failed: Error | null = null;
  const worker = async () => {
    while (next < total && !failed) {
      const i = next++;
      const blob = file.slice(i * partSize, Math.min(file.size, (i + 1) * partSize));
      for (let attempt = 1; ; attempt++) {
        try {
          etags[i] = await putPart(`${handle.uploadBase}/part/${uploadId}/${i + 1}`, blob, (sent) => { sentByPart[i] = sent; report(); });
          sentByPart[i] = blob.size; report();
          break;
        } catch (e) {
          if (attempt >= 4) { failed = e as Error; return; }
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  if (failed) {
    await fetch(`${handle.uploadBase}/abort/${uploadId}`, { method: "DELETE" }).catch(() => {});
    throw failed;
  }

  const doneRes = await fetch(`${handle.uploadBase}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, parts: etags.map((etag, i) => ({ partNumber: i + 1, etag })) }),
  });
  if (!doneRes.ok) throw new Error("Could not finish upload");
  onProgress(1);
}

/** Ask the server to transcode. Returns quickly; status arrives via realtime on vr_videos. */
export async function startProcessing(videoId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Session expired — sign in again");
  const res = await fetch("/api/vr-process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, token: session.access_token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not start processing");
  return data;
}
