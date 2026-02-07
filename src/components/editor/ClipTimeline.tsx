import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, Film, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Clip {
  id: string;
  url: string;
  duration: number;
  type: "image" | "video";
  thumbnail?: string;
}

interface ClipTimelineProps {
  initialClip?: { url: string; type: "image" | "video" };
  onRender: (blob: Blob) => void;
}

const MAX_DURATION = 30;
const IMAGE_DURATION = 3; // seconds per image clip

const ClipTimeline = ({ initialClip, onRender }: ClipTimelineProps) => {
  const [clips, setClips] = useState<Clip[]>(
    initialClip
      ? [{ id: "1", url: initialClip.url, duration: initialClip.type === "image" ? IMAGE_DURATION : 0, type: initialClip.type }]
      : []
  );
  const [rendering, setRendering] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);

  const addClip = async (file: File) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");

    if (isVideo) {
      const vid = document.createElement("video");
      vid.preload = "metadata";
      vid.src = url;
      await new Promise((r) => (vid.onloadedmetadata = r));
      const dur = vid.duration;

      if (totalDuration + dur > MAX_DURATION) {
        toast({ title: "Clip too long", description: `Max total is ${MAX_DURATION}s. ${(MAX_DURATION - totalDuration).toFixed(1)}s remaining.`, variant: "destructive" });
        return;
      }

      setClips((prev) => [...prev, { id: Date.now().toString(), url, duration: dur, type: "video" }]);
    } else {
      if (totalDuration + IMAGE_DURATION > MAX_DURATION) {
        toast({ title: "Timeline full", description: `Max total is ${MAX_DURATION}s.`, variant: "destructive" });
        return;
      }
      setClips((prev) => [...prev, { id: Date.now().toString(), url, duration: IMAGE_DURATION, type: "image" }]);
    }
  };

  const removeClip = (id: string) => setClips((prev) => prev.filter((c) => c.id !== id));

  const handleRender = async () => {
    if (clips.length === 0) return;
    setRendering(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      });

      recorder.start();

      for (const clip of clips) {
        if (clip.type === "image") {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = clip.url;
          await new Promise((r) => (img.onload = r));

          // Draw image for its duration
          const frames = clip.duration * 30;
          for (let i = 0; i < frames; i++) {
            // Fit image to canvas
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
            await new Promise((r) => setTimeout(r, 1000 / 30));
          }
        } else {
          const vid = document.createElement("video");
          vid.crossOrigin = "anonymous";
          vid.src = clip.url;
          vid.muted = true;
          await new Promise((r) => (vid.oncanplay = r));
          vid.play();

          await new Promise<void>((resolve) => {
            const draw = () => {
              if (vid.ended || vid.paused) {
                resolve();
                return;
              }
              const scale = Math.min(canvas.width / vid.videoWidth, canvas.height / vid.videoHeight);
              const w = vid.videoWidth * scale;
              const h = vid.videoHeight * scale;
              ctx.fillStyle = "#000";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(vid, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
              requestAnimationFrame(draw);
            };
            vid.onended = () => resolve();
            draw();
          });
        }
      }

      recorder.stop();
      const blob = await done;
      onRender(blob);
      toast({ title: "Render complete!", description: "Your combined video is ready." });
    } catch (err: any) {
      console.error("Render error:", err);
      toast({ title: "Render failed", description: err.message, variant: "destructive" });
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1">
          <Film className="h-3 w-3" /> Clip Timeline
        </h4>
        <span className="text-xs text-muted-foreground font-mono">
          {totalDuration.toFixed(1)}s / {MAX_DURATION}s
        </span>
      </div>

      {/* Duration bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all"
          style={{ width: `${(totalDuration / MAX_DURATION) * 100}%` }}
        />
      </div>

      {/* Clip cards */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {clips.map((clip, i) => (
          <div
            key={clip.id}
            className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted group"
          >
            {clip.type === "video" ? (
              <video src={clip.url} className="w-full h-full object-cover" muted />
            ) : (
              <img src={clip.url} alt="" className="w-full h-full object-cover" />
            )}
            <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-center text-white py-0.5 font-mono">
              {clip.duration.toFixed(1)}s
            </div>
            <button
              onClick={() => removeClip(clip.id)}
              className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-2.5 w-2.5" />
            </button>
            <div className="absolute top-0.5 left-0.5 bg-black/60 text-[8px] text-white px-1 rounded">
              #{i + 1}
            </div>
          </div>
        ))}

        {/* Add clip button */}
        {totalDuration < MAX_DURATION && (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/40 flex flex-col items-center justify-center gap-1 transition-colors"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">Add clip</span>
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) addClip(f);
          e.target.value = "";
        }}
      />

      {/* Render button */}
      <Button
        onClick={handleRender}
        disabled={rendering || clips.length === 0}
        className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
      >
        {rendering ? (
          <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Rendering...</>
        ) : (
          <><Film className="h-4 w-4 mr-1" /> Render Video ({totalDuration.toFixed(1)}s)</>
        )}
      </Button>
    </div>
  );
};

export default ClipTimeline;
