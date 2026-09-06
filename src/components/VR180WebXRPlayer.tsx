import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Hls from "hls.js";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Check,
  Compass,
  Crosshair,
  Gauge,
  Glasses,
  Headset,
  Loader2,
  LogOut,
  Maximize,
  Minimize,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_VR_FORMAT, VR_FORMATS, formatLabel, guessFormat, is360, isStereo, isTopBottom, type VRFormat,
} from "@/lib/vrFormats";

export interface RelatedVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  format?: VRFormat | string | null;
}

interface VR180WebXRPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Projection / stereo layout. Guessed from the video's pixel size when omitted. */
  format?: VRFormat | string | null;
  /** Shown on the end screen; first one auto-plays after a countdown. */
  related?: RelatedVideo[];
  onSelectRelated?: (id: string) => void;
}

type Level = { index: number; width: number; height: number; bitrate: number };

interface PlayerApi {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  skip: (dt: number) => void;
  resetView: () => void;
  zoom: (delta: number) => void;
  setGyro: (on: boolean) => Promise<boolean>;
  enterVR: () => Promise<void>;
  exitVR: () => void;
  enterCardboard: () => Promise<void>;
  exitCardboard: () => void;
  setFormat: (f: VRFormat) => void;
}

const SKIP_SECONDS = 10;
const HIDE_AFTER_MS = 3000;
const VR_PANEL_HIDE_MS = 10000;
const GAZE_DWELL_MS = 1300;
const UP_NEXT_SECONDS = 10;
const MIN_FOV = 30;
const MAX_FOV = 100;
const DEFAULT_FOV = 75;
const FLAT_FOV = 44;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const fmtTime = (t: number) => {
  if (!isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

const levelLabel = (l: Level) => (l.height >= 2160 || l.width >= 3840 ? "4K" : `${l.height}p`);

/**
 * Dope Chicks immersive video player.
 *
 * Formats: VR180 / 360°, 2D or 3D (side-by-side / top-bottom), plus flat video on a
 * curved virtual cinema screen. Plays MP4 or adaptive HLS.
 *
 * Flat mode (desktop / phone): drag to look, scroll or pinch to zoom, click to
 * play/pause, double-click fullscreen, phone gyroscope look, auto-hiding controls
 * (seek w/ buffered range + hover time, ±10s, volume, quality, speed, projection,
 * reset view, Cardboard, Enter VR, fullscreen), keyboard shortcuts, end screen with
 * replay + up-next.
 *
 * Cardboard mode (any phone, no WebXR needed): fullscreen landscape split-screen
 * stereo driven by the gyroscope — drop the phone in a Cardboard / Daydream-style viewer.
 *
 * VR mode (WebXR headsets): floating laser-pointer panel (restart, ±10s, play/pause,
 * recenter, mute, exit VR, seek), auto-hides while playing. Headsets without
 * controllers get a gaze reticle: look at a button to press it, look down to open the
 * panel. A / X instantly recenters.
 */
const VR180WebXRPlayer = ({ src, poster, title, subtitle, onBack, format, related = [], onSelectRelated }: VR180WebXRPlayerProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const apiRef = useRef<PlayerApi | null>(null);
  const wantPlayingRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);
  const menuOpenRef = useRef(false);
  const seekDragRef = useRef(false);
  const formatRef = useRef<VRFormat>(DEFAULT_VR_FORMAT);
  const formatExplicitRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [ended, setEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1);
  const [activeQuality, setActiveQuality] = useState("");
  const [viewFormat, setViewFormat] = useState<VRFormat>(DEFAULT_VR_FORMAT);
  const [xrSupported, setXrSupported] = useState(false);
  const [inXR, setInXR] = useState(false);
  const [cardboard, setCardboard] = useState(false);
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [gyroOn, setGyroOn] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hintVisible, setHintVisible] = useState(true);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [upNextIn, setUpNextIn] = useState<number | null>(null);

  // ---------- controls auto-hide ----------
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (wantPlayingRef.current && !menuOpenRef.current && !seekDragRef.current) {
        setControlsVisible(false);
        setHoverFrac(null);
      }
    }, HIDE_AFTER_MS);
  }, []);

  useEffect(() => {
    showControls();
    const t = window.setTimeout(() => setHintVisible(false), 4500);
    return () => {
      window.clearTimeout(t);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [showControls]);

  useEffect(() => {
    if (!playing) setControlsVisible(true);
    else showControls();
  }, [playing, showControls]);

  // ---------- capability detection ----------
  useEffect(() => {
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    setCoarsePointer(coarse);
    setGyroAvailable(typeof DeviceOrientationEvent !== "undefined" && coarse);
    const xr = (navigator as any).xr;
    if (xr?.isSessionSupported) {
      xr.isSessionSupported("immersive-vr").then((ok: boolean) => setXrSupported(!!ok)).catch(() => setXrSupported(false));
    }
    const onFs = () => {
      const fs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setFullscreen(fs);
      if (!fs) apiRef.current?.exitCardboard();
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  // ---------- format from props ----------
  useEffect(() => {
    const explicit = VR_FORMATS.some((f) => f.value === format);
    formatExplicitRef.current = explicit;
    const f = (explicit ? format : DEFAULT_VR_FORMAT) as VRFormat;
    formatRef.current = f;
    setViewFormat(f);
    apiRef.current?.setFormat(f);
  }, [format]);

  // ---------- source loading ----------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setLevels([]);
    setActiveQuality("");
    setEnded(false);
    setUpNextIn(null);
    setHasFrame(false);

    const isHls = /\.m3u8(\?|$)/i.test(src);
    if (!isHls) {
      video.src = src;
      return;
    }
    if (video.canPlayType("application/vnd.apple.mpegurl") && !Hls.isSupported()) {
      video.src = src; // iOS Safari: native HLS (no manual rendition picker)
      return;
    }
    if (Hls.isSupported()) {
      // The <video> is hidden (it only feeds the 3D texture), so capLevelToPlayerSize
      // would pick the lowest rendition. VR wants max sharpness → pin the top level;
      // the quality menu can drop it or switch to Auto.
      const hls = new Hls({ capLevelToPlayerSize: false, maxBufferLength: 20, abrEwmaDefaultEstimate: 50_000_000 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        const list: Level[] = (data.levels || []).map((l, i) => ({ index: i, width: l.width, height: l.height, bitrate: l.bitrate }));
        setLevels(list);
        if (list.length) {
          const top = list.length - 1;
          hls.startLevel = top;
          hls.currentLevel = top;
          setSelectedLevel(top);
        }
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        const lvl = hls.levels[data.level];
        if (lvl) setActiveQuality(`${lvl.width}×${lvl.height}`);
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    }
    video.src = src;
  }, [src]);

  const chooseLevel = (idx: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = idx;
    setSelectedLevel(idx);
  };

  // ---------- three.js scene ----------
  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local");
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, container.clientWidth / container.clientHeight, 0.05, 2000);
    camera.layers.enable(1); // flat mode shows the left eye
    scene.add(camera);        // so camera-attached UI (gaze reticle) renders

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    // ---- projection: dome(s) or cinema screen; the group rotates on recenter ----
    const videoGroup = new THREE.Group();
    scene.add(videoGroup);
    let projectionMeshes: THREE.Mesh[] = [];
    const buildProjection = (fmt: VRFormat) => {
      for (const m of projectionMeshes) {
        videoGroup.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      projectionMeshes = [];
      const material = () => new THREE.MeshBasicMaterial({ map: texture });

      if (fmt === "FLAT") {
        // Curved cinema screen straight ahead. Both eyes see it (layer 0).
        const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
        const H = 5.4, W = H * aspect, R = 9;
        const geo = new THREE.PlaneGeometry(W, H, 48, 1);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const a = pos.getX(i) / R;
          pos.setX(i, R * Math.sin(a));
          pos.setZ(i, -R * Math.cos(a));
        }
        pos.needsUpdate = true;
        const mesh = new THREE.Mesh(geo, material());
        mesh.layers.set(0);
        videoGroup.add(mesh);
        projectionMeshes.push(mesh);
        return;
      }

      const full = is360(fmt), stereo = isStereo(fmt), tb = isTopBottom(fmt);
      const dome = (uOff: number, vOff: number, uScale: number, vScale: number, layer: number) => {
        const geo = new THREE.SphereGeometry(500, full ? 96 : 80, 64, full ? 0 : Math.PI / 2, full ? Math.PI * 2 : Math.PI);
        geo.scale(-1, 1, 1); // view from inside
        const uv = geo.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uScale + uOff, uv.getY(i) * vScale + vOff);
        uv.needsUpdate = true;
        const mesh = new THREE.Mesh(geo, material());
        mesh.layers.set(layer);
        mesh.rotation.y = -Math.PI / 2; // frame centre lands straight ahead (-Z)
        videoGroup.add(mesh);
        projectionMeshes.push(mesh);
      };
      if (!stereo) dome(0, 0, 1, 1, 0);                                   // one image, both eyes
      else if (!tb) { dome(0, 0, 0.5, 1, 1); dome(0.5, 0, 0.5, 1, 2); }    // left | right halves
      else { dome(0, 0.5, 1, 0.5, 1); dome(0, 0, 1, 0.5, 2); }             // top = left eye, bottom = right eye
    };
    buildProjection(formatRef.current);

    // ---- playback intent + stall recovery ----
    const userPlay = () => { wantPlayingRef.current = true; setEnded(false); setUpNextIn(null); video.play().catch(() => {}); };
    const userPause = () => { wantPlayingRef.current = false; video.pause(); };
    const userToggle = () => (wantPlayingRef.current ? userPause() : userPlay());
    const seekTo = (t: number) => { if (video.duration) video.currentTime = Math.max(0, Math.min(video.duration - 0.05, t)); };
    const skipBy = (dt: number) => seekTo(video.currentTime + dt);
    const watchdog = window.setInterval(() => {
      if (wantPlayingRef.current && video.paused && !video.seeking && !video.ended) video.play().catch(() => {});
    }, 2000);

    // ---- recenter (VR) ----
    const _dir = new THREE.Vector3();
    const _pos = new THREE.Vector3();
    let recenterCountdown = 0;
    let countdownTimer: number | null = null;
    const placePanelInFront = () => {
      camera.getWorldDirection(_dir);
      camera.getWorldPosition(_pos);
      const yaw = Math.atan2(-_dir.x, -_dir.z);
      panel.position.set(_pos.x - Math.sin(yaw) * 1.25, _pos.y - 0.45, _pos.z - Math.cos(yaw) * 1.25);
      panel.rotation.set(-0.42, yaw, 0);
    };
    const recenter = () => {
      camera.getWorldDirection(_dir);
      videoGroup.rotation.y = Math.atan2(-_dir.x, -_dir.z);
      placePanelInFront();
    };
    const startRecenterCountdown = () => {
      if (countdownTimer) window.clearTimeout(countdownTimer);
      recenterCountdown = 3;
      const tick = () => {
        recenterCountdown--;
        if (recenterCountdown <= 0) { recenterCountdown = 0; countdownTimer = null; recenter(); }
        else countdownTimer = window.setTimeout(tick, 1000);
      };
      countdownTimer = window.setTimeout(tick, 1000);
    };

    // ---- in-VR control panel (canvas-drawn) ----
    const panel = new THREE.Group();
    panel.rotation.order = "YXZ";
    panel.position.set(0, -0.5, -1.3);
    panel.rotation.set(-0.42, 0, 0);
    panel.visible = false;
    scene.add(panel);
    let lastPanelActivity = performance.now();
    const showPanel = () => { panel.visible = true; lastPanelActivity = performance.now(); placePanelInFront(); };

    const interactives: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];

    const canvasTexture = (w: number, h: number, drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      drawFn(c.getContext("2d")!, w, h);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    };
    const rounded = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const PW = 1.72, PH = 0.54;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(1024, 320, (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, "rgba(28,28,42,0.94)");
          g.addColorStop(1, "rgba(12,12,20,0.94)");
          rounded(ctx, 4, 4, w - 8, h - 8, 44);
          ctx.fillStyle = g; ctx.fill();
          ctx.strokeStyle = "rgba(168,85,247,0.4)"; ctx.lineWidth = 3; ctx.stroke();
        }),
        transparent: true,
      })
    );
    panel.add(bg);

    const handle = new THREE.Mesh(
      new THREE.PlaneGeometry(PW * 0.94, 0.075),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(1024, 96, (ctx, w, h) => {
          rounded(ctx, 8, 8, w - 16, h - 16, 36);
          ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.font = "600 36px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("⠿   hold trigger here to move  ·  grip hides panel   ⠿", w / 2, h / 2 + 2);
        }),
        transparent: true,
        color: 0xdddddd,
      })
    );
    handle.position.set(0, PH / 2 - 0.058, 0.004);
    handle.userData = { handle: true, baseColor: 0xdddddd, hoverColor: 0xffffff };
    panel.add(handle);
    interactives.push(handle);

    type IconDraw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
    const iconTexture = (draw: IconDraw, hover: boolean, accent = false) =>
      canvasTexture(256, 256, (ctx, w, h) => {
        ctx.beginPath(); ctx.arc(w / 2, h / 2, 116, 0, Math.PI * 2);
        ctx.fillStyle = hover ? (accent ? "rgba(236,72,153,0.4)" : "rgba(168,85,247,0.35)") : (accent ? "rgba(236,72,153,0.16)" : "rgba(255,255,255,0.09)");
        ctx.fill();
        ctx.strokeStyle = hover ? "rgba(200,150,255,0.9)" : "rgba(255,255,255,0.28)"; ctx.lineWidth = 5; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.strokeStyle = "#fff";
        draw(ctx, w, h);
      });
    const playIcon: IconDraw = (ctx, w, h) => { ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.3); ctx.lineTo(w * 0.4, h * 0.7); ctx.lineTo(w * 0.72, h * 0.5); ctx.closePath(); ctx.fill(); };
    const pauseIcon: IconDraw = (ctx, w, h) => { ctx.fillRect(w * 0.36, h * 0.3, w * 0.1, h * 0.4); ctx.fillRect(w * 0.54, h * 0.3, w * 0.1, h * 0.4); };
    const textIcon = (label: string, size = 64): IconDraw => (ctx, w, h) => { ctx.font = `600 ${size}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, w / 2, h / 2 + 4); };
    const recenterIcon: IconDraw = (ctx, w, h) => {
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 44, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 8, 0, Math.PI * 2); ctx.fill();
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { ctx.beginPath(); ctx.moveTo(w / 2 + dx * 54, h / 2 + dy * 54); ctx.lineTo(w / 2 + dx * 80, h / 2 + dy * 80); ctx.stroke(); }
    };
    const speakerBody = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.beginPath(); ctx.moveTo(w * 0.28, h * 0.42); ctx.lineTo(w * 0.4, h * 0.42); ctx.lineTo(w * 0.53, h * 0.3); ctx.lineTo(w * 0.53, h * 0.7); ctx.lineTo(w * 0.4, h * 0.58); ctx.lineTo(w * 0.28, h * 0.58); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 9; ctx.lineCap = "round";
    };
    const soundIcon: IconDraw = (ctx, w, h) => { speakerBody(ctx, w, h); ctx.beginPath(); ctx.arc(w * 0.53, h * 0.5, w * 0.09, -Math.PI / 3, Math.PI / 3); ctx.stroke(); ctx.beginPath(); ctx.arc(w * 0.53, h * 0.5, w * 0.17, -Math.PI / 3, Math.PI / 3); ctx.stroke(); };
    const mutedIcon: IconDraw = (ctx, w, h) => { speakerBody(ctx, w, h); ctx.beginPath(); ctx.moveTo(w * 0.6, h * 0.42); ctx.lineTo(w * 0.74, h * 0.58); ctx.moveTo(w * 0.74, h * 0.42); ctx.lineTo(w * 0.6, h * 0.58); ctx.stroke(); };
    const exitIcon: IconDraw = (ctx, w, h) => {
      ctx.lineWidth = 10; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.3); ctx.lineTo(w * 0.32, h * 0.3); ctx.lineTo(w * 0.32, h * 0.7); ctx.lineTo(w * 0.5, h * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w * 0.46, h * 0.5); ctx.lineTo(w * 0.74, h * 0.5); ctx.moveTo(w * 0.64, h * 0.4); ctx.lineTo(w * 0.74, h * 0.5); ctx.lineTo(w * 0.64, h * 0.6); ctx.stroke();
    };

    const makeIconButton = (draw: IconDraw, x: number, action: () => void, size = 0.13, accent = false) => {
      const normalTex = iconTexture(draw, false, accent);
      const hoverTex = iconTexture(draw, true, accent);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: normalTex, transparent: true }));
      mesh.position.set(x, -0.135, 0.006);
      mesh.userData = { action, normalTex, hoverTex, button: true };
      panel.add(mesh);
      interactives.push(mesh);
      return mesh;
    };
    const swapButtonIcon = (mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>, normalTex: THREE.Texture, hoverTex: THREE.Texture) => {
      mesh.userData.normalTex = normalTex; mesh.userData.hoverTex = hoverTex;
      mesh.material.map = normalTex; mesh.material.needsUpdate = true;
    };

    const muteBtn = makeIconButton(soundIcon, -0.72, () => { video.muted = !video.muted; }, 0.12);
    makeIconButton(textIcon("⟲", 88), -0.5, () => { seekTo(0); userPlay(); });
    makeIconButton(textIcon("−10", 58), -0.27, () => skipBy(-SKIP_SECONDS));
    const playBtn = makeIconButton(playIcon, -0.02, userToggle, 0.17);
    makeIconButton(textIcon("+10", 58), 0.23, () => skipBy(SKIP_SECONDS));
    makeIconButton(recenterIcon, 0.46, startRecenterCountdown);
    makeIconButton(exitIcon, 0.7, () => { renderer.xr.getSession()?.end().catch(() => {}); }, 0.12, true);

    const playTexes = { playN: iconTexture(playIcon, false), playH: iconTexture(playIcon, true), pauseN: iconTexture(pauseIcon, false), pauseH: iconTexture(pauseIcon, true) };
    const muteTexes = { onN: iconTexture(soundIcon, false), onH: iconTexture(soundIcon, true), offN: iconTexture(mutedIcon, false), offH: iconTexture(mutedIcon, true) };
    const refreshPlayButton = () => (video.paused ? swapButtonIcon(playBtn, playTexes.playN, playTexes.playH) : swapButtonIcon(playBtn, playTexes.pauseN, playTexes.pauseH));
    const refreshMuteButton = () => (video.muted ? swapButtonIcon(muteBtn, muteTexes.offN, muteTexes.offH) : swapButtonIcon(muteBtn, muteTexes.onN, muteTexes.onH));

    const SEEK_W = PW - 0.2;
    const seekTrack = new THREE.Mesh(
      new THREE.PlaneGeometry(SEEK_W, 0.075),
      new THREE.MeshBasicMaterial({ map: canvasTexture(1024, 64, (ctx, w, h) => { rounded(ctx, 2, 14, w - 4, h - 28, 18); ctx.fillStyle = "rgba(255,255,255,0.16)"; ctx.fill(); }), transparent: true, color: 0xffffff })
    );
    seekTrack.position.set(0, 0.015, 0.005);
    seekTrack.userData = { seekBar: true, baseColor: 0xffffff, hoverColor: 0xccaaff };
    panel.add(seekTrack);
    interactives.push(seekTrack);

    const seekFill = new THREE.Mesh(
      new THREE.PlaneGeometry(SEEK_W, 0.075),
      new THREE.MeshBasicMaterial({ map: canvasTexture(1024, 64, (ctx, w, h) => { rounded(ctx, 2, 14, w - 4, h - 28, 18); const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, "#a855f7"); g.addColorStop(1, "#ec4899"); ctx.fillStyle = g; ctx.fill(); }), transparent: true })
    );
    seekFill.position.set(0, 0.015, 0.007);
    seekFill.scale.x = 0.001;
    panel.add(seekFill);

    const knob = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    knob.position.set(-SEEK_W / 2, 0.015, 0.009);
    panel.add(knob);

    const timeCanvas = document.createElement("canvas");
    timeCanvas.width = 512; timeCanvas.height = 80;
    const timeCtx = timeCanvas.getContext("2d")!;
    const timeTex = new THREE.CanvasTexture(timeCanvas);
    timeTex.colorSpace = THREE.SRGBColorSpace;
    const timeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.097), new THREE.MeshBasicMaterial({ map: timeTex, transparent: true }));
    timeMesh.position.set(0, 0.108, 0.005);
    panel.add(timeMesh);

    const dragState = new Map<THREE.Object3D, boolean>();
    const panelTicker = window.setInterval(() => {
      if (!panel.visible) return;
      if (renderer.xr.isPresenting && wantPlayingRef.current && dragState.size === 0 && recenterCountdown === 0 && !video.ended &&
          performance.now() - lastPanelActivity > VR_PANEL_HIDE_MS) {
        panel.visible = false;
        return;
      }
      timeCtx.clearRect(0, 0, 512, 80);
      timeCtx.font = "600 42px sans-serif"; timeCtx.textAlign = "center"; timeCtx.textBaseline = "middle";
      let status: string;
      if (recenterCountdown > 0) { timeCtx.fillStyle = "#c084fc"; status = `⌖ Look at the new center… ${recenterCountdown}`; }
      else if (video.ended) { timeCtx.fillStyle = "#c084fc"; status = "Finished · ⟲ to replay"; }
      else if (video.readyState < 3 && wantPlayingRef.current) { timeCtx.fillStyle = "#ffb84d"; status = "⏳ Buffering…"; }
      else { timeCtx.fillStyle = "rgba(255,255,255,0.85)"; status = `${fmtTime(video.currentTime)}  /  ${fmtTime(video.duration)}`; }
      timeCtx.fillText(status, 256, 42);
      timeTex.needsUpdate = true;
      if (video.duration) {
        const f = video.currentTime / video.duration;
        seekFill.scale.x = Math.max(f, 0.001);
        seekFill.position.x = -SEEK_W / 2 + (SEEK_W * f) / 2;
        knob.position.x = -SEEK_W / 2 + SEEK_W * f;
      }
    }, 250);

    // ---- hover helpers (controllers + gaze) ----
    const resetHover = () => {
      for (const obj of interactives) {
        if (obj.userData.button && obj.material.map !== obj.userData.normalTex) { obj.material.map = obj.userData.normalTex; obj.material.needsUpdate = true; }
        if (obj.userData.baseColor !== undefined) obj.material.color.setHex(obj.userData.baseColor);
        obj.scale.setScalar(1);
      }
    };
    const applyHover = (obj: (typeof interactives)[number]) => {
      lastPanelActivity = performance.now();
      if (obj.userData.button) { obj.material.map = obj.userData.hoverTex; obj.material.needsUpdate = true; obj.scale.setScalar(1.12); }
      if (obj.userData.hoverColor !== undefined) obj.material.color.setHex(obj.userData.hoverColor);
    };
    const activate = (hit: THREE.Intersection) => {
      const ud = hit.object.userData;
      if (ud.seekBar) { if (video.duration && hit.uv) seekTo(hit.uv.x * video.duration); }
      else if (ud.action) ud.action();
    };

    // ---- controllers: lasers, hover, click, drag, A/X instant recenter ----
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();
    const intersectPanel = (controller: THREE.Object3D) => {
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
      return panel.visible ? raycaster.intersectObjects(interactives, false) : [];
    };
    const onSelectStart = (controller: THREE.Object3D) => {
      if (!panel.visible) { showPanel(); return; }
      lastPanelActivity = performance.now();
      const hits = intersectPanel(controller);
      if (!hits.length) return;
      if (hits[0].object.userData.handle) { controller.attach(panel); dragState.set(controller, true); }
      else activate(hits[0]);
    };
    const onSelectEnd = (controller: THREE.Object3D) => {
      if (dragState.get(controller)) { scene.attach(panel); dragState.delete(controller); lastPanelActivity = performance.now(); }
    };
    const controllers: THREE.Object3D[] = [];
    for (const i of [0, 1]) {
      const c = renderer.xr.getController(i);
      c.addEventListener("selectstart", () => onSelectStart(c));
      c.addEventListener("selectend", () => onSelectEnd(c));
      c.addEventListener("squeezestart", () => { if (panel.visible) panel.visible = false; else showPanel(); });
      const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3)]);
      c.add(new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })));
      c.add(new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })));
      scene.add(c);
      controllers.push(c);
    }
    const recenterBtnPrev = new WeakMap<object, boolean>();
    const pollRecenterButtons = () => {
      const session = renderer.xr.getSession();
      if (!session) return;
      for (const s of session.inputSources) {
        const gp = s.gamepad;
        if (!gp || !gp.buttons[4]) continue;
        const pressed = gp.buttons[4].pressed; // A (right) / X (left)
        if (pressed && !recenterBtnPrev.get(s)) recenter();
        recenterBtnPrev.set(s, pressed);
      }
    };

    // ---- gaze reticle for controller-less headsets (Cardboard-class WebXR, GearVR…) ----
    const reticle = new THREE.Group();
    reticle.position.set(0, 0, -1.5);
    reticle.visible = false;
    camera.add(reticle);
    const reticleRing = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.018, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }));
    const reticleProgress = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.03, 32, 1, Math.PI / 2, 0.001), new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.95, depthTest: false }));
    reticleRing.renderOrder = 999; reticleProgress.renderOrder = 999;
    reticle.add(reticleRing, reticleProgress);
    let gazeSteps = -1;
    const setGazeProgress = (f: number) => {
      const steps = Math.round(Math.max(0, Math.min(1, f)) * 24);
      if (steps === gazeSteps) return;
      gazeSteps = steps;
      reticleProgress.geometry.dispose();
      reticleProgress.geometry = new THREE.RingGeometry(0.02, 0.03, 32, 1, Math.PI / 2, Math.max(0.001, (steps / 24) * Math.PI * 2));
    };
    let gazeTarget: THREE.Object3D | null = null;
    let gazeStart = 0;
    let lookDownStart = 0;
    const gazeRay = new THREE.Raycaster();
    const camDir = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const updateGaze = () => {
      const session = renderer.xr.getSession();
      const hasPointer = !!session && Array.from(session.inputSources).some((s) => s.targetRayMode === "tracked-pointer");
      const useGaze = renderer.xr.isPresenting && !hasPointer;
      reticle.visible = useGaze;
      if (!useGaze) { gazeTarget = null; setGazeProgress(0); return; }
      camera.getWorldDirection(camDir);
      camera.getWorldPosition(camPos);
      if (!panel.visible) {
        // look down for a second to open the panel
        if (camDir.y < -0.5) {
          if (!lookDownStart) lookDownStart = performance.now();
          else if (performance.now() - lookDownStart > 1000) { showPanel(); lookDownStart = 0; }
        } else lookDownStart = 0;
        setGazeProgress(lookDownStart ? (performance.now() - lookDownStart) / 1000 : 0);
        return;
      }
      gazeRay.set(camPos, camDir);
      const hits = gazeRay.intersectObjects(interactives, false);
      const obj = (hits[0]?.object as (typeof interactives)[number] | undefined) ?? null;
      if (obj !== gazeTarget) { gazeTarget = obj; gazeStart = performance.now(); }
      if (!obj) { setGazeProgress(0); return; }
      applyHover(obj);
      if (obj.userData.handle) { setGazeProgress(0); return; } // can't drag by gaze
      const frac = (performance.now() - gazeStart) / GAZE_DWELL_MS;
      setGazeProgress(frac);
      if (frac >= 1) { activate(hits[0]); gazeTarget = null; gazeStart = performance.now(); }
    };

    const updateHover = () => {
      resetHover();
      if (renderer.xr.isPresenting && panel.visible) {
        for (const c of controllers) {
          const hits = intersectPanel(c);
          if (hits.length) applyHover(hits[0].object as (typeof interactives)[number]);
        }
      }
      updateGaze();
    };

    const onSessionStart = () => { setInXR(true); showPanel(); userPlay(); window.setTimeout(placePanelInFront, 300); };
    const onSessionEnd = () => { setInXR(false); panel.visible = false; reticle.visible = false; onResize(); };
    renderer.xr.addEventListener("sessionstart", onSessionStart);
    renderer.xr.addEventListener("sessionend", onSessionEnd);
    const enterVR = async () => {
      const xr = (navigator as any).xr;
      if (!xr) return;
      const session = await xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "bounded-floor", "layers"] });
      await renderer.xr.setSession(session);
    };
    const exitVR = () => { renderer.xr.getSession()?.end().catch(() => {}); };

    // ---- flat-mode look: drag, wheel/pinch zoom, gyroscope, Cardboard split-screen ----
    const view = { lon: 0, lat: 0, fov: DEFAULT_FOV, gyro: false, hasGyroData: false, cardboard: false };
    const baseFov = () => (formatRef.current === "FLAT" ? FLAT_FOV : DEFAULT_FOV);
    const deviceQuat = new THREE.Quaternion();
    const yawQuat = new THREE.Quaternion();
    const _euler = new THREE.Euler();
    const _q0 = new THREE.Quaternion();
    const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    const _zee = new THREE.Vector3(0, 0, 1);
    const _yAxis = new THREE.Vector3(0, 1, 0);
    const _fwd = new THREE.Vector3();
    const screenAngle = () => {
      const a = (screen.orientation && typeof screen.orientation.angle === "number") ? screen.orientation.angle
        : (typeof (window as any).orientation === "number" ? (window as any).orientation : 0);
      return THREE.MathUtils.degToRad(a);
    };
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null || e.gamma == null) return;
      _euler.set(THREE.MathUtils.degToRad(e.beta), THREE.MathUtils.degToRad(e.alpha), -THREE.MathUtils.degToRad(e.gamma), "YXZ");
      deviceQuat.setFromEuler(_euler);
      deviceQuat.multiply(_q1);
      deviceQuat.multiply(_q0.setFromAxisAngle(_zee, -screenAngle()));
      view.hasGyroData = true;
    };
    const setGyro = async (on: boolean): Promise<boolean> => {
      if (!on) {
        window.removeEventListener("deviceorientation", onDeviceOrientation);
        view.gyro = false; view.hasGyroData = false;
        setGyroOn(false);
        return false;
      }
      const DOE = (window as any).DeviceOrientationEvent;
      if (!DOE) return false;
      try {
        if (typeof DOE.requestPermission === "function") {
          const res = await DOE.requestPermission();
          if (res !== "granted") return false;
        }
      } catch { return false; }
      window.addEventListener("deviceorientation", onDeviceOrientation);
      view.gyro = true; view.lon = 0; view.lat = 0;
      setGyroOn(true);
      return true;
    };
    const resetView = () => {
      view.fov = baseFov();
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
      if (view.gyro && view.hasGyroData) {
        _fwd.set(0, 0, -1).applyQuaternion(deviceQuat);
        view.lon = -THREE.MathUtils.radToDeg(Math.atan2(_fwd.x, -_fwd.z));
        view.lat = 0;
      } else { view.lon = 0; view.lat = 0; }
    };
    const zoom = (delta: number) => {
      view.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, view.fov + delta));
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
    };
    const setFormat = (f: VRFormat) => {
      formatRef.current = f;
      buildProjection(f);
      view.fov = baseFov();
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
    };
    const enterCardboard = async () => {
      await setGyro(true);
      const el = wrapperRef.current as any;
      try { await (el?.requestFullscreen || el?.webkitRequestFullscreen)?.call(el); } catch { /* not required */ }
      try { await (screen.orientation as any)?.lock?.("landscape"); } catch { /* unsupported */ }
      view.cardboard = true;
      setCardboard(true);
      resetView();
      userPlay();
    };
    const exitCardboard = () => {
      if (!view.cardboard) return;
      view.cardboard = false;
      setCardboard(false);
      try { (screen.orientation as any)?.unlock?.(); } catch { /* ignore */ }
      camera.layers.set(0); camera.layers.enable(1);
      onResize();
    };

    const el = renderer.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let dragging = false, px = 0, py = 0, downX = 0, downY = 0, downAt = 0, moved = false, pinchDist = 0;
    const onPointerDown = (e: PointerEvent) => {
      setHintVisible(false);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        dragging = false;
        return;
      }
      dragging = true; moved = false;
      px = downX = e.clientX; py = downY = e.clientY; downAt = performance.now();
      try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) zoom((pinchDist - d) * 0.15);
        pinchDist = d;
        return;
      }
      if (!dragging || view.cardboard) return;
      const dx = e.clientX - px, dy = e.clientY - py;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) moved = true;
      const sens = 0.18 * (view.fov / DEFAULT_FOV);
      view.lon -= dx * sens;
      if (!view.gyro) view.lat = Math.max(-85, Math.min(85, view.lat + dy * sens));
      px = e.clientX; py = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (!dragging) return;
      dragging = false;
      const quick = performance.now() - downAt < 350;
      if (!moved && quick) {
        if (e.pointerType === "mouse" && !view.cardboard) userToggle();
        else setControlsVisible((v) => { if (v && wantPlayingRef.current) return false; showControls(); return true; });
      }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoom(Math.sign(e.deltaY) * 4); };
    const onDblClick = () => { if (!view.cardboard) toggleFullscreenRef.current(); };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDblClick);

    // ---- React state sync ----
    const updateBuffered = () => {
      const t = video.currentTime;
      let end = 0;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= t + 0.5 && video.buffered.end(i) >= t) end = Math.max(end, video.buffered.end(i));
      }
      setBufferedEnd(end);
    };
    const onPlay = () => { setPlaying(true); setEnded(false); refreshPlayButton(); };
    const onPause = () => { setPlaying(false); refreshPlayButton(); };
    const onEnded = () => { wantPlayingRef.current = false; setPlaying(false); setEnded(true); refreshPlayButton(); if (renderer.xr.isPresenting) showPanel(); };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setBuffering(false); setHasFrame(true); };
    const onLoadedMeta = () => {
      if (!formatExplicitRef.current && video.videoWidth && video.videoHeight) {
        const g = guessFormat(video.videoWidth, video.videoHeight);
        if (g !== formatRef.current) { setViewFormat(g); setFormat(g); }
      } else if (formatRef.current === "FLAT") {
        buildProjection("FLAT"); // now that the aspect ratio is known
      }
    };
    const onLoadedData = () => setHasFrame(true);
    const onTime = () => {
      setProgress(video.currentTime);
      if (video.duration && isFinite(video.duration)) setDuration(video.duration);
      updateBuffered();
    };
    const onVolume = () => { setMuted(video.muted); setVolume(video.volume); refreshMuteButton(); };
    const onRate = () => setRate(video.playbackRate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadedmetadata", onLoadedMeta);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onTime);
    video.addEventListener("progress", updateBuffered);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("ratechange", onRate);
    onVolume();

    const onResize = () => {
      if (renderer.xr.isPresenting) return;
      camera.aspect = (view.cardboard ? container.clientWidth / 2 : container.clientWidth) / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    renderer.setAnimationLoop(() => {
      if (!renderer.xr.isPresenting) {
        if (view.gyro && view.hasGyroData) {
          yawQuat.setFromAxisAngle(_yAxis, -THREE.MathUtils.degToRad(view.lon));
          camera.quaternion.copy(yawQuat).multiply(deviceQuat);
        } else {
          const phi = THREE.MathUtils.degToRad(90 - view.lat);
          const theta = THREE.MathUtils.degToRad(view.lon);
          camera.lookAt(Math.sin(phi) * Math.sin(theta), Math.cos(phi), -Math.sin(phi) * Math.cos(theta));
        }
        if (view.cardboard) {
          // side-by-side stereo for a phone in a Cardboard-style viewer
          const w = container.clientWidth, h = container.clientHeight;
          renderer.setScissorTest(true);
          for (const eye of [0, 1]) {
            renderer.setViewport(eye * (w / 2), 0, w / 2, h);
            renderer.setScissor(eye * (w / 2), 0, w / 2, h);
            camera.layers.set(0);
            camera.layers.enable(eye === 0 ? 1 : 2);
            renderer.render(scene, camera);
          }
          renderer.setScissorTest(false);
          renderer.setViewport(0, 0, w, h);
          camera.layers.set(0); camera.layers.enable(1);
          return;
        }
      }
      pollRecenterButtons();
      updateHover();
      renderer.render(scene, camera);
    });

    apiRef.current = {
      play: userPlay, pause: userPause, toggle: userToggle, seek: seekTo, skip: skipBy,
      resetView, zoom, setGyro, enterVR, exitVR, enterCardboard, exitCardboard, setFormat,
    };

    return () => {
      apiRef.current = null;
      wantPlayingRef.current = false;
      window.clearInterval(watchdog);
      window.clearInterval(panelTicker);
      if (countdownTimer) window.clearTimeout(countdownTimer);
      renderer.setAnimationLoop(null);
      renderer.xr.removeEventListener("sessionstart", onSessionStart);
      renderer.xr.removeEventListener("sessionend", onSessionEnd);
      renderer.xr.getSession()?.end().catch(() => {});
      window.removeEventListener("deviceorientation", onDeviceOrientation);
      try { (screen.orientation as any)?.unlock?.(); } catch { /* ignore */ }
      video.pause();
      for (const [ev, fn] of [["play", onPlay], ["pause", onPause], ["ended", onEnded], ["waiting", onWaiting], ["playing", onPlaying], ["loadedmetadata", onLoadedMeta], ["loadeddata", onLoadedData], ["timeupdate", onTime], ["durationchange", onTime], ["progress", updateBuffered], ["volumechange", onVolume], ["ratechange", onRate]] as const) {
        video.removeEventListener(ev, fn as EventListener);
      }
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDblClick);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.MeshBasicMaterial | undefined;
        if (mat) { mat.map?.dispose(); mat.dispose(); }
      });
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [src, showControls]);

  // ---------- up-next countdown ----------
  useEffect(() => {
    if (!ended || inXR || cardboard || related.length === 0 || !onSelectRelated) { setUpNextIn(null); return; }
    setUpNextIn(UP_NEXT_SECONDS);
    const t = window.setInterval(() => {
      setUpNextIn((n) => {
        if (n === null) return null;
        if (n <= 1) { window.clearInterval(t); onSelectRelated(related[0].id); return null; }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [ended, inXR, cardboard, related, onSelectRelated]);

  // ---------- fullscreen ----------
  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current as any;
    const doc = document as any;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
    else if (el) (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }, []);
  const toggleFullscreenRef = useRef(toggleFullscreen);
  toggleFullscreenRef.current = toggleFullscreen;
  const fullscreenAvailable = typeof document !== "undefined" && !!((document as any).fullscreenEnabled || (document as any).webkitFullscreenEnabled);

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const api = apiRef.current;
      const video = videoRef.current;
      if (!api || !video) return;
      let handled = true;
      switch (e.key) {
        case " ": case "k": case "K": api.toggle(); break;
        case "ArrowLeft": case "j": case "J": api.skip(-SKIP_SECONDS); break;
        case "ArrowRight": case "l": case "L": api.skip(SKIP_SECONDS); break;
        case "ArrowUp": video.muted = false; video.volume = Math.min(1, video.volume + 0.1); break;
        case "ArrowDown": video.volume = Math.max(0, video.volume - 0.1); break;
        case "m": case "M": video.muted = !video.muted; break;
        case "f": case "F": toggleFullscreen(); break;
        case "r": case "R": api.resetView(); break;
        case "Home": api.seek(0); break;
        case "Escape": api.exitCardboard(); handled = false; break;
        default: handled = false;
      }
      if (handled) { e.preventDefault(); showControls(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showControls, toggleFullscreen]);

  // ---------- seek bar ----------
  const fracFromEvent = (e: React.PointerEvent | PointerEvent) => {
    const el = seekRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };
  const onSeekDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    seekDragRef.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const f = fracFromEvent(e);
    setHoverFrac(f);
    apiRef.current?.seek(f * duration);
  };
  const onSeekMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const f = fracFromEvent(e);
    setHoverFrac(f);
    if (seekDragRef.current) apiRef.current?.seek(f * duration);
    showControls();
  };
  const onSeekUp = (e: React.PointerEvent<HTMLDivElement>) => {
    seekDragRef.current = false;
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (e.pointerType !== "mouse") setHoverFrac(null);
  };

  const changeFormat = (f: VRFormat) => { setViewFormat(f); apiRef.current?.setFormat(f); };
  const changeRate = (r: number) => { const v = videoRef.current; if (v) v.playbackRate = r; };
  const replay = () => { apiRef.current?.seek(0); apiRef.current?.play(); };

  const playedPct = duration ? (progress / duration) * 100 : 0;
  const bufferedPct = duration ? Math.min(100, (bufferedEnd / duration) * 100) : 0;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const overlayVisible = (controlsVisible || !playing) && !cardboard && !ended;
  const selectedLabel = selectedLevel === -1 ? "Auto" : (() => { const l = levels.find((x) => x.index === selectedLevel); return l ? levelLabel(l) : ""; })();
  const btn = "rounded-full text-white hover:bg-white/10 hover:text-white";

  return (
    <div
      ref={wrapperRef}
      className={cn("relative w-full h-full bg-black select-none overflow-hidden", !overlayVisible && !ended && "cursor-none")}
      onPointerMove={() => showControls()}
      onPointerDown={() => showControls()}
    >
      <video ref={videoRef} poster={poster} crossOrigin="anonymous" playsInline preload="auto" className="hidden" />
      <div ref={containerRef} className="absolute inset-0" />

      {!hasFrame && poster && (
        <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none" />
      )}

      {/* Center state */}
      {!inXR && !cardboard && !ended && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          {buffering && playing ? (
            <div className="h-16 w-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          ) : !playing ? (
            <button type="button" onClick={() => apiRef.current?.play()} aria-label="Play"
              className="pointer-events-auto h-20 w-20 rounded-full bg-gradient-purple glow-purple flex items-center justify-center text-primary-foreground hover:scale-105 active:scale-95 transition-transform">
              <Play className="h-9 w-9 ml-1" fill="currentColor" />
            </button>
          ) : null}
        </div>
      )}

      {/* Hint */}
      <div className={cn("absolute left-1/2 -translate-x-1/2 top-20 z-10 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur text-[11px] text-white/85 border border-white/10 pointer-events-none transition-opacity duration-500",
        hintVisible && !inXR && !cardboard ? "opacity-100" : "opacity-0")}>
        {viewFormat === "FLAT"
          ? "Virtual cinema · drag to look around the screen"
          : coarsePointer
            ? (gyroAvailable ? "Drag to look around · pinch to zoom · Cardboard button for a headset" : "Drag to look around · pinch to zoom")
            : "Drag to look around · scroll to zoom · space to play"}
      </div>

      {/* Cardboard overlay */}
      {cardboard && (
        <div className="absolute inset-0 z-30 pointer-events-none">
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
          <div className={cn("absolute top-3 right-3 flex gap-2 pointer-events-auto transition-opacity", controlsVisible ? "opacity-100" : "opacity-0")}>
            <Button size="sm" variant="ghost" className={btn + " bg-black/50"} onClick={() => apiRef.current?.toggle()}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
            <Button size="sm" variant="ghost" className={btn + " bg-black/50"} onClick={() => apiRef.current?.resetView()} title="Recenter"><Crosshair className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" className={btn + " bg-black/50"} onClick={() => { apiRef.current?.exitCardboard(); if (document.fullscreenElement) toggleFullscreen(); }}><X className="h-4 w-4 mr-1" /> Exit</Button>
          </div>
          <div className={cn("absolute bottom-4 inset-x-0 text-center text-[11px] text-white/60 transition-opacity", controlsVisible ? "opacity-100" : "opacity-0")}>
            Put your phone in the viewer · tap the screen for controls
          </div>
        </div>
      )}

      {/* End screen */}
      {ended && !inXR && !cardboard && (
        <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 gap-5 overflow-y-auto">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-white/50 mb-1">That's a wrap</div>
            {title && <div className="text-lg md:text-2xl font-black text-white">{title}</div>}
          </div>
          <div className="flex gap-3">
            <Button onClick={replay} className="rounded-full bg-gradient-purple text-primary-foreground font-bold px-6 glow-purple">
              <RotateCcw className="h-4 w-4 mr-2" /> Replay
            </Button>
            {onBack && (
              <Button variant="outline" onClick={onBack} className="rounded-full border-white/20 text-white hover:bg-white/10 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            )}
          </div>
          {related.length > 0 && onSelectRelated && (
            <div className="w-full max-w-3xl">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="text-xs font-bold uppercase tracking-wider text-white/70">Up next</div>
                {upNextIn !== null && (
                  <button onClick={() => setUpNextIn(null)} className="text-[11px] text-white/60 hover:text-white">
                    Playing in {upNextIn}s · cancel
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {related.slice(0, 8).map((r, i) => (
                  <button key={r.id} onClick={() => onSelectRelated(r.id)}
                    className={cn("group relative aspect-video rounded-xl overflow-hidden border text-left", i === 0 && upNextIn !== null ? "border-primary" : "border-white/10 hover:border-primary/60")}>
                    {r.thumbnail_url ? <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      : <div className="w-full h-full bg-white/5 flex items-center justify-center"><Headset className="h-6 w-6 text-white/40" /></div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
                    <div className="absolute bottom-1.5 left-2 right-2 text-[11px] font-semibold text-white truncate">{r.title}</div>
                    {i === 0 && upNextIn !== null && (
                      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary transition-all" style={{ width: `${((UP_NEXT_SECONDS - upNextIn) / UP_NEXT_SECONDS) * 100}%` }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top bar */}
      <div className={cn("absolute top-0 left-0 right-0 z-20 flex items-center gap-3 p-3 md:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300",
        overlayVisible ? "opacity-100" : "opacity-0 pointer-events-none")}>
        {onBack && (
          <Button size="icon" variant="ghost" className={btn + " shrink-0"} onClick={onBack} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
        )}
        <div className="min-w-0 flex-1">
          {title && <h1 className="text-sm md:text-base font-bold truncate flex items-center gap-2 text-white"><Headset className="h-4 w-4 text-primary shrink-0" /> {title}</h1>}
          {subtitle && <p className="text-[11px] text-white/60 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur border border-white/10 text-[11px] text-white/85">{formatLabel(viewFormat)}</div>
          {activeQuality && <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur border border-white/10 text-[11px] font-mono text-white/85">{activeQuality}</div>}
        </div>
      </div>

      {/* Bottom controls */}
      <div className={cn("absolute bottom-0 left-0 right-0 z-20 px-3 pb-3 md:px-5 md:pb-4 pt-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent transition-opacity duration-300",
        overlayVisible ? "opacity-100" : "opacity-0 pointer-events-none")}>
        <div ref={seekRef} className="group relative h-6 flex items-center cursor-pointer touch-none"
          onPointerDown={onSeekDown} onPointerMove={onSeekMove} onPointerUp={onSeekUp} onPointerCancel={onSeekUp}
          onPointerLeave={() => { if (!seekDragRef.current) setHoverFrac(null); }}
          role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(progress)}>
          <div className="relative w-full h-1 group-hover:h-1.5 rounded-full bg-white/20 transition-all overflow-visible">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#a855f7] to-[#ec4899]" style={{ width: `${playedPct}%` }} />
            {hoverFrac !== null && <div className="absolute inset-y-0 left-0 rounded-full bg-white/25 pointer-events-none" style={{ width: `${hoverFrac * 100}%` }} />}
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_0_4px_rgba(168,85,247,0.35)] opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${playedPct}%`, opacity: seekDragRef.current ? 1 : undefined }} />
          </div>
          {hoverFrac !== null && duration > 0 && (
            <div className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white pointer-events-none" style={{ left: `${hoverFrac * 100}%` }}>
              {fmtTime(hoverFrac * duration)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 md:gap-2 mt-1">
          <Button size="icon" variant="ghost" className={btn} onClick={() => apiRef.current?.toggle()} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
          </Button>
          <Button size="icon" variant="ghost" className={btn + " relative"} onClick={() => apiRef.current?.skip(-SKIP_SECONDS)} aria-label="Back 10 seconds">
            <RotateCcw className="h-5 w-5" /><span className="absolute text-[8px] font-bold top-[13px]">10</span>
          </Button>
          <Button size="icon" variant="ghost" className={btn + " relative"} onClick={() => apiRef.current?.skip(SKIP_SECONDS)} aria-label="Forward 10 seconds">
            <RotateCw className="h-5 w-5" /><span className="absolute text-[8px] font-bold top-[13px]">10</span>
          </Button>

          <div className="group/vol flex items-center">
            <Button size="icon" variant="ghost" className={btn} onClick={() => { const v = videoRef.current; if (v) v.muted = !v.muted; }} aria-label={muted ? "Unmute" : "Mute"}>
              <VolumeIcon className="h-5 w-5" />
            </Button>
            <input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume}
              onChange={(e) => { const v = videoRef.current; if (!v) return; v.volume = Number(e.target.value); v.muted = v.volume === 0; }}
              className="hidden md:block w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 focus:w-20 focus:opacity-100 transition-all duration-200 h-1 accent-[#a855f7] cursor-pointer" aria-label="Volume" />
          </div>

          <span className="text-[11px] md:text-xs text-white/85 tabular-nums font-mono ml-1 whitespace-nowrap">
            {fmtTime(progress)} <span className="text-white/45">/ {fmtTime(duration)}</span>
          </span>

          <div className="flex-1" />

          {gyroAvailable && (
            <Button size="icon" variant="ghost" className={cn("rounded-full hover:bg-white/10 hover:text-white", gyroOn ? "text-primary" : "text-white")}
              onClick={() => apiRef.current?.setGyro(!gyroOn)} aria-label={gyroOn ? "Disable motion look" : "Enable motion look"} title="Motion look (gyroscope)">
              <Compass className={cn("h-5 w-5", gyroOn && "animate-pulse")} />
            </Button>
          )}

          <Button size="icon" variant="ghost" className={btn} onClick={() => apiRef.current?.resetView()} aria-label="Reset view" title="Reset view (R)">
            <Crosshair className="h-5 w-5" />
          </Button>

          <DropdownMenu onOpenChange={(o) => { menuOpenRef.current = o; showControls(); }}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={btn + " h-9 px-2.5 gap-1.5"} aria-label="Settings">
                <Settings2 className="h-5 w-5" />
                {levels.length > 1 && <span className="hidden sm:inline text-xs font-semibold">{selectedLabel}</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              {levels.length > 1 && (
                <>
                  <DropdownMenuLabel className="text-xs">Quality</DropdownMenuLabel>
                  {[...levels].reverse().map((l) => (
                    <DropdownMenuItem key={l.index} onClick={() => chooseLevel(l.index)} className="flex items-center justify-between gap-4">
                      <span>{levelLabel(l)} <span className="text-muted-foreground text-xs">{l.width}×{l.height}</span></span>
                      {selectedLevel === l.index && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onClick={() => chooseLevel(-1)} className="flex items-center justify-between gap-4">
                    <span>Auto <span className="text-muted-foreground text-xs">adaptive</span></span>
                    {selectedLevel === -1 && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2"><Gauge className="h-4 w-4" /> Speed <span className="ml-auto text-xs text-muted-foreground">{rate}×</span></DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {SPEEDS.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => changeRate(s)} className="flex items-center justify-between gap-4">
                      <span>{s === 1 ? "Normal" : `${s}×`}</span>{rate === s && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2"><Orbit className="h-4 w-4" /> Projection</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[14rem]">
                  {VR_FORMATS.map((f) => (
                    <DropdownMenuItem key={f.value} onClick={() => changeFormat(f.value)} className="flex items-center justify-between gap-4">
                      <span>{f.label}</span>{viewFormat === f.value && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          {coarsePointer && gyroAvailable && !inXR && (
            <Button variant="ghost" className={btn + " h-9 px-3 gap-1.5"} onClick={() => apiRef.current?.enterCardboard()} title="Split-screen for a phone VR viewer">
              <Glasses className="h-4 w-4" /> <span className="text-xs font-semibold hidden sm:inline">Cardboard</span>
            </Button>
          )}

          {xrSupported && (
            inXR ? (
              <Button variant="ghost" className={btn + " h-9 px-3 gap-1.5"} onClick={() => apiRef.current?.exitVR()}>
                <LogOut className="h-4 w-4" /> <span className="text-xs font-semibold">Exit VR</span>
              </Button>
            ) : (
              <Button className="rounded-full bg-gradient-purple text-primary-foreground font-bold h-9 px-3 md:px-4 gap-1.5 glow-purple hover:opacity-90" onClick={() => apiRef.current?.enterVR().catch(() => {})}>
                <Headset className="h-4 w-4" /> <span className="text-xs">Enter VR</span>
              </Button>
            )
          )}

          {fullscreenAvailable && (
            <Button size="icon" variant="ghost" className={btn} onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} title="Fullscreen (F)">
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VR180WebXRPlayer;
