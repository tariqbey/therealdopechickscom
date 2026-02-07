import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Scissors } from "lucide-react";

interface VideoTrimmerProps {
  videoUrl: string;
  onTrimmed: (blob: Blob) => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, "0")}.${ms}`;
}

const VideoTrimmer = ({ videoUrl, onTrimmed }: VideoTrimmerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => {
      setDuration(v.duration);
      setTrimEnd(v.duration);
    };
    const onTime = () => setCurrentTime(v.currentTime);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [videoUrl]);

  // Clamp playback to trim range
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playing) return;
    if (v.currentTime >= trimEnd) {
      v.pause();
      setPlaying(false);
      v.currentTime = trimStart;
    }
  }, [currentTime, trimEnd, trimStart, playing]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) {
        v.currentTime = trimStart;
      }
      v.play();
      setPlaying(true);
    }
  };

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, handle: "start" | "end" | "seek") => {
      const track = trackRef.current;
      if (!track || !duration) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = pct * duration;

      if (handle === "start") {
        setTrimStart(Math.min(time, trimEnd - 0.5));
      } else if (handle === "end") {
        setTrimEnd(Math.max(time, trimStart + 0.5));
      } else {
        if (videoRef.current) videoRef.current.currentTime = time;
      }
    },
    [duration, trimStart, trimEnd]
  );

  // Drag handlers for trim handles
  const startDrag = (handle: "start" | "end") => {
    const onMove = (e: MouseEvent) => {
      const track = trackRef.current;
      if (!track || !duration) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = pct * duration;
      if (handle === "start") {
        setTrimStart(Math.min(time, trimEnd - 0.5));
      } else {
        setTrimEnd(Math.max(time, trimStart + 0.5));
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleTrim = async () => {
    // Client-side trimming using MediaRecorder + captureStream
    const v = videoRef.current;
    if (!v) return;
    setTrimming(true);

    try {
      v.currentTime = trimStart;
      await new Promise((r) => (v.onseeked = r));

      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(30);

      // Try to capture audio too
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(v);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(audioCtx.destination);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch {
        // No audio track or not supported - continue without audio
      }

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      });

      recorder.start();
      v.play();

      const drawFrame = () => {
        if (v.currentTime >= trimEnd || v.paused) {
          v.pause();
          recorder.stop();
          return;
        }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };
      drawFrame();

      const blob = await done;
      onTrimmed(blob);
    } catch (err) {
      console.error("Trim error:", err);
    } finally {
      setTrimming(false);
    }
  };

  const trimDuration = trimEnd - trimStart;
  const startPct = duration ? (trimStart / duration) * 100 : 0;
  const endPct = duration ? (trimEnd / duration) * 100 : 100;
  const playheadPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Video Preview */}
      <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[350px]">
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-h-[350px] w-auto"
          crossOrigin="anonymous"
          playsInline
          preload="metadata"
        />
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={togglePlay} className="h-8 w-8 p-0">
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <span className="text-xs text-muted-foreground font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <span className="ml-auto text-xs text-primary font-medium">
          Selection: {formatTime(trimDuration)}
        </span>
      </div>

      {/* Timeline Track */}
      <div className="px-1">
        <div
          ref={trackRef}
          className="relative h-12 bg-muted rounded-lg cursor-pointer overflow-hidden"
          onClick={(e) => handleTrackClick(e, "seek")}
        >
          {/* Selected range */}
          <div
            className="absolute top-0 bottom-0 bg-primary/20 border-y-2 border-primary/40"
            style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          />

          {/* Start handle */}
          <div
            className="absolute top-0 bottom-0 w-3 bg-primary rounded-l cursor-ew-resize z-10 flex items-center justify-center hover:bg-primary/80"
            style={{ left: `${startPct}%` }}
            onMouseDown={(e) => { e.stopPropagation(); startDrag("start"); }}
          >
            <div className="w-0.5 h-4 bg-primary-foreground rounded-full" />
          </div>

          {/* End handle */}
          <div
            className="absolute top-0 bottom-0 w-3 bg-primary rounded-r cursor-ew-resize z-10 flex items-center justify-center hover:bg-primary/80"
            style={{ left: `calc(${endPct}% - 12px)` }}
            onMouseDown={(e) => { e.stopPropagation(); startDrag("end"); }}
          >
            <div className="w-0.5 h-4 bg-primary-foreground rounded-full" />
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground z-20"
            style={{ left: `${playheadPct}%` }}
          />
        </div>

        {/* Time labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
          <span>{formatTime(trimStart)}</span>
          <span>{formatTime(trimEnd)}</span>
        </div>
      </div>

      {/* Trim button */}
      <Button
        onClick={handleTrim}
        disabled={trimming || trimDuration < 0.5}
        className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
      >
        <Scissors className="h-4 w-4 mr-1" />
        {trimming ? "Trimming..." : `Trim to ${formatTime(trimDuration)}`}
      </Button>
    </div>
  );
};

export default VideoTrimmer;
