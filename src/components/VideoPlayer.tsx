import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Play, Pause, Maximize, Minimize, Volume2, VolumeX, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type VideoMode = "standard" | "360" | "vr180";

interface VideoPlayerProps {
  src: string;
  mode: VideoMode;
  poster?: string;
}

/* ─── Immersive sphere that maps video texture ─── */

function VideoSphere({ video, mode }: { video: HTMLVideoElement; mode: "360" | "vr180" }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => {
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;

    if (mode === "vr180") {
      // Show only the left half (left eye) of a side-by-side stereo video
      t.repeat.set(0.5, 1);
      t.offset.set(0, 0);
    }
    return t;
  }, [video, mode]);

  useFrame(() => {
    if (texture) texture.needsUpdate = true;
  });

  const geometry = useMemo(() => {
    if (mode === "360") {
      return new THREE.SphereGeometry(500, 64, 32);
    }
    // VR180: half sphere (front hemisphere)
    return new THREE.SphereGeometry(
      500, 64, 32,
      Math.PI / 2,  // phiStart – start at left
      Math.PI,      // phiLength – 180 degrees
      0,
      Math.PI
    );
  }, [mode]);

  return (
    <mesh ref={meshRef} geometry={geometry} scale={[-1, 1, 1]}>
      <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
}

function ImmersiveControls({ mode, gyroEnabled }: { mode: "360" | "vr180"; gyroEnabled: boolean }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  useEffect(() => {
    camera.position.set(0, 0, 0.1);
  }, [camera]);

  // Gyroscope device orientation
  useEffect(() => {
    if (!gyroEnabled) return;
    const onOrientation = (e: DeviceOrientationEvent) => {
      const alpha = THREE.MathUtils.degToRad(e.alpha || 0);
      const beta = THREE.MathUtils.degToRad(e.beta || 0);
      const gamma = THREE.MathUtils.degToRad(e.gamma || 0);

      euler.current.set(beta, alpha, -gamma, "YXZ");
      camera.quaternion.setFromEuler(euler.current);

      // Rotate to landscape-aware orientation
      const q = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
      camera.quaternion.multiply(q);

      // Disable orbit controls when gyro is active
      if (controlsRef.current) controlsRef.current.enabled = false;
    };
    window.addEventListener("deviceorientation", onOrientation, true);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation, true);
      if (controlsRef.current) controlsRef.current.enabled = true;
    };
  }, [gyroEnabled, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={false}
      enablePan={false}
      enableDamping
      dampingFactor={0.15}
      rotateSpeed={-0.4}
      minPolarAngle={mode === "vr180" ? Math.PI * 0.2 : 0}
      maxPolarAngle={mode === "vr180" ? Math.PI * 0.8 : Math.PI}
      minAzimuthAngle={mode === "vr180" ? -Math.PI / 2 : -Infinity}
      maxAzimuthAngle={mode === "vr180" ? Math.PI / 2 : Infinity}
    />
  );
}

/* ─── Main VideoPlayer ─── */

const VideoPlayer = ({ src, mode, poster }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  // Detect gyroscope availability
  useEffect(() => {
    if (typeof DeviceOrientationEvent !== "undefined") {
      setGyroAvailable(true);
    }
  }, []);

  const toggleGyro = useCallback(async () => {
    if (gyroEnabled) {
      setGyroEnabled(false);
      return;
    }
    // iOS 13+ requires permission
    if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      try {
        const perm = await (DeviceOrientationEvent as any).requestPermission();
        if (perm === "granted") setGyroEnabled(true);
      } catch {
        // denied
      }
    } else {
      setGyroEnabled(true);
    }
  }, [gyroEnabled]);

  // Create off-screen video for immersive modes
  const immersiveVideo = useMemo(() => {
    if (mode === "standard") return null;
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.loop = true;
    v.playsInline = true;
    v.src = src;
    return v;
  }, [src, mode]);

  const activeVideo = mode === "standard" ? videoRef.current : immersiveVideo;

  const togglePlay = useCallback(() => {
    if (!activeVideo) return;
    if (activeVideo.paused) {
      activeVideo.play();
      setPlaying(true);
    } else {
      activeVideo.pause();
      setPlaying(false);
    }
  }, [activeVideo]);

  const toggleMute = useCallback(() => {
    if (!activeVideo) return;
    activeVideo.muted = !activeVideo.muted;
    setMuted(activeVideo.muted);
  }, [activeVideo]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeVideo || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    activeVideo.currentTime = pct * duration;
  }, [activeVideo, duration]);

  // Time update loop
  useEffect(() => {
    const v = activeVideo;
    if (!v) return;
    const onTime = () => {
      setCurrentTime(v.currentTime);
      setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
    };
    const onMeta = () => setDuration(v.duration);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
    };
  }, [activeVideo]);

  // Cleanup immersive video
  useEffect(() => {
    return () => {
      if (immersiveVideo) {
        immersiveVideo.pause();
        immersiveVideo.src = "";
      }
    };
  }, [immersiveVideo]);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-background rounded-lg overflow-hidden group cursor-pointer"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* Standard HTML5 video */}
      {mode === "standard" && (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-contain"
          playsInline
          onClick={togglePlay}
        />
      )}

      {/* Immersive 360 / VR180 canvas */}
      {mode !== "standard" && immersiveVideo && (
        <div className="w-full h-full" onClick={togglePlay}>
          <Canvas
            camera={{ fov: 75, near: 0.1, far: 1000 }}
            style={{ width: "100%", height: "100%" }}
            gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
          >
            <VideoSphere video={immersiveVideo} mode={mode} />
            <ImmersiveControls mode={mode} gyroEnabled={gyroEnabled} />
          </Canvas>
        </div>
      )}

      {/* Overlay controls */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: "linear-gradient(transparent 60%, hsl(0 0% 0% / 0.7))" }}
      >
        {/* Big center play button when paused */}
        {!playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/80 flex items-center justify-center backdrop-blur-sm">
              <Play className="h-7 w-7 text-primary-foreground ml-1" />
            </div>
          </button>
        )}

        {/* Bottom bar */}
        <div className="px-4 pb-3 space-y-2">
          {/* Progress bar */}
          <div
            className="w-full h-1.5 bg-muted rounded-full cursor-pointer group/progress"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-primary rounded-full transition-all relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary-foreground opacity-0 group-hover/progress:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-foreground hover:text-foreground/80"
                onClick={togglePlay}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-foreground hover:text-foreground/80"
                onClick={toggleMute}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>

              <span className="text-xs text-muted-foreground font-mono">
                {formatTime(currentTime)} / {formatTime(duration || 0)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {mode !== "standard" && gyroAvailable && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${gyroEnabled ? "text-accent" : "text-foreground hover:text-foreground/80"}`}
                  onClick={toggleGyro}
                  title={gyroEnabled ? "Disable gyroscope" : "Enable gyroscope"}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              )}
              {mode !== "standard" && (
                <span className="text-xs text-accent font-medium px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                  {mode === "360" ? "360°" : "VR 180°"}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-foreground hover:text-foreground/80"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
