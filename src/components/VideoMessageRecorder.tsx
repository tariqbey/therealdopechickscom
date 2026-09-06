import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Circle, Loader2, RefreshCw, Send, Square, SwitchCamera } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (blob: Blob, mimeType: string, durationSeconds: number) => Promise<void>;
  maxSeconds?: number;
}

const pickMime = () => {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || "";
};

/** Record a short selfie video (up to maxSeconds) and hand the blob to the chat. */
const VideoMessageRecorder = ({ open, onOpenChange, onSend, maxSeconds = 60 }: Props) => {
  const previewRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const facingRef = useRef<"user" | "environment">("user");

  const [phase, setPhase] = useState<"init" | "ready" | "recording" | "review" | "sending" | "error">("init");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mime, setMime] = useState("");
  const [error, setError] = useState("");
  const [canFlip, setCanFlip] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    stopStream();
    setPhase("init");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingRef.current, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (previewRef.current) { previewRef.current.srcObject = stream; previewRef.current.play().catch(() => {}); }
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        setCanFlip(devs.filter((d) => d.kind === "videoinput").length > 1);
      } catch { /* ignore */ }
      setPhase("ready");
    } catch (e: any) {
      setError(e?.name === "NotAllowedError" ? "Camera access was blocked. Allow it in your browser settings and try again." : "Couldn't access your camera.");
      setPhase("error");
    }
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlob(null); setBlobUrl(null); setElapsed(0); setPhase("init"); setError("");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Video recording isn't supported in this browser.");
      setPhase("error");
      return;
    }
    startCamera();
    return () => { stopStream(); if (timerRef.current) window.clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const type = pickMime();
    const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 2_500_000 } : undefined);
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const finalType = rec.mimeType || type || "video/webm";
      const b = new Blob(chunksRef.current, { type: finalType });
      setBlob(b);
      setMime(finalType);
      const url = URL.createObjectURL(b);
      setBlobUrl(url);
      setPhase("review");
      stopStream();
    };
    rec.start(250);
    startedAtRef.current = Date.now();
    setElapsed(0);
    setPhase("recording");
    timerRef.current = window.setInterval(() => {
      const secs = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(secs);
      if (secs >= maxSeconds) stopRecording();
    }, 200);
  };

  const stopRecording = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const reRecord = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlob(null); setBlobUrl(null); setElapsed(0);
    startCamera();
  };

  const flip = async () => {
    facingRef.current = facingRef.current === "user" ? "environment" : "user";
    await startCamera();
  };

  const send = async () => {
    if (!blob) return;
    setPhase("sending");
    try {
      await onSend(blob, mime, Math.round(elapsed));
      onOpenChange(false);
    } catch {
      setPhase("review");
    }
  };

  const pct = Math.min(100, (elapsed / maxSeconds) * 100);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (phase !== "sending") onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md bg-gradient-card border-border p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-lg font-black">Video message</DialogTitle>
          <DialogDescription className="text-xs">Up to {maxSeconds} seconds. Recorded right here, sent straight into the chat.</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[3/4] sm:aspect-video bg-black">
          {phase === "review" && blobUrl ? (
            <video ref={playbackRef} src={blobUrl} controls playsInline className="absolute inset-0 w-full h-full object-contain" />
          ) : (
            <video
              ref={previewRef}
              muted
              playsInline
              autoPlay
              className={cn("absolute inset-0 w-full h-full object-cover", facingRef.current === "user" && "scale-x-[-1]")}
            />
          )}
          {phase === "init" && (
            <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/80" /></div>
          )}
          {phase === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/85">
              {error}
              <Button size="sm" variant="outline" onClick={startCamera}>Try again</Button>
            </div>
          )}
          {phase === "recording" && (
            <>
              <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> REC {Math.floor(elapsed)}s
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div className="h-full bg-gradient-to-r from-[#a855f7] to-[#ec4899]" style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
          {(phase === "ready") && canFlip && (
            <button onClick={flip} className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Flip camera">
              <SwitchCamera className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 p-4">
          {phase === "ready" && (
            <Button onClick={startRecording} className="rounded-full h-14 w-14 p-0 bg-red-600 hover:bg-red-500 text-white" aria-label="Start recording">
              <Circle className="h-6 w-6" fill="currentColor" />
            </Button>
          )}
          {phase === "recording" && (
            <Button onClick={stopRecording} className="rounded-full h-14 w-14 p-0 bg-white text-black hover:bg-white/90" aria-label="Stop recording">
              <Square className="h-5 w-5" fill="currentColor" />
            </Button>
          )}
          {(phase === "review" || phase === "sending") && (
            <>
              <Button variant="outline" onClick={reRecord} disabled={phase === "sending"}>
                <RefreshCw className="h-4 w-4 mr-2" /> Re-record
              </Button>
              <Button onClick={send} disabled={phase === "sending"} className="bg-gradient-purple text-primary-foreground font-bold">
                {phase === "sending" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send {Math.round(elapsed)}s video
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoMessageRecorder;
