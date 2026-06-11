import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Hls from "hls.js";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, Loader2 } from "lucide-react";

interface VR180WebXRPlayerProps {
  src: string;
  poster?: string;
}

/**
 * True WebXR VR180 player: renders side-by-side stereo equirectangular video
 * as one hemisphere per eye. On a headset browser (Quest etc.) an "Enter VR"
 * button appears; inside VR there's a floating laser-pointer control panel
 * (play/pause, ±10s, seek, recenter, drag-to-move). On desktop/mobile it
 * falls back to drag-to-look with the left eye's view and DOM controls.
 */
const VR180WebXRPlayer = ({ src, poster }: VR180WebXRPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const wantPlayingRef = useRef(false);

  // Load the source — adaptive HLS (Bunny .m3u8) via hls.js, or a plain MP4.
  // For HLS, the signed token query on the playlist URL must ride along on
  // every segment request too, so we append it in the loader.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const isHls = src.includes(".m3u8");
    if (!isHls) {
      video.src = src;
      return;
    }

    // Bunny's path-based directory token sits in a path prefix, so every
    // relative sub-playlist/segment URL inherits it — no per-request signing.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src; // Safari plays HLS natively
      return;
    }

    if (Hls.isSupported()) {
      // The <video> is hidden (it only feeds the 3D texture), so its size is ~0.
      // capLevelToPlayerSize:false stops hls.js from picking the lowest rendition
      // for a "tiny" element — critical for VR, which needs the full 4K stream.
      const hls = new Hls({
        capLevelToPlayerSize: false,
        startLevel: -1,
        maxBufferLength: 30,
        abrEwmaDefaultEstimate: 8_000_000, // start optimistic so it opens at high quality
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      // Prefer the highest rendition on load; ABR can still drop if bandwidth demands.
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        if (data.levels?.length) hls.nextLevel = data.levels.length - 1;
      });
      return () => hls.destroy();
    }
  }, [src]);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local");
    container.appendChild(renderer.domElement);

    const vrButton = VRButton.createButton(renderer);
    vrButton.style.bottom = "76px";
    container.appendChild(vrButton);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(
      75, container.clientWidth / container.clientHeight, 0.05, 2000
    );
    camera.layers.enable(1); // non-VR view shows the left eye

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // One hemisphere per eye; the whole dome group rotates on recenter
    const videoGroup = new THREE.Group();
    scene.add(videoGroup);
    const makeEyeDome = (uOffset: number, layer: number) => {
      const geo = new THREE.SphereGeometry(500, 80, 60, Math.PI / 2, Math.PI);
      geo.scale(-1, 1, 1);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5 + uOffset);
      uv.needsUpdate = true;
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture }));
      mesh.layers.set(layer);
      mesh.rotation.y = Math.PI;
      videoGroup.add(mesh);
    };
    makeEyeDome(0.0, 1); // left eye
    makeEyeDome(0.5, 2); // right eye

    // --- playback intent + stall recovery ---
    const userPlay = () => { wantPlayingRef.current = true; video.play().catch(() => {}); };
    const userPause = () => { wantPlayingRef.current = false; video.pause(); };
    const userToggle = () => (wantPlayingRef.current ? userPause() : userPlay());
    const watchdog = window.setInterval(() => {
      if (wantPlayingRef.current && video.paused && !video.seeking) video.play().catch(() => {});
    }, 2000);

    // --- recenter ---
    const _dir = new THREE.Vector3();
    const _pos = new THREE.Vector3();
    let recenterCountdown = 0;
    let countdownTimer: number | null = null;

    const placePanelInFront = () => {
      camera.getWorldDirection(_dir);
      camera.getWorldPosition(_pos);
      const yaw = Math.atan2(-_dir.x, -_dir.z);
      panel.position.set(
        _pos.x - Math.sin(yaw) * 1.25, _pos.y - 0.45, _pos.z - Math.cos(yaw) * 1.25
      );
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

    // --- in-VR control panel (canvas-drawn) ---
    const panel = new THREE.Group();
    panel.rotation.order = "YXZ";
    panel.position.set(0, -0.5, -1.3);
    panel.rotation.set(-0.42, 0, 0);
    scene.add(panel);

    const interactives: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];

    const canvasTexture = (
      w: number, h: number, drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
    ) => {
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

    const PW = 1.5, PH = 0.54;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(1024, 384, (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, "rgba(28,28,42,0.94)");
          g.addColorStop(1, "rgba(12,12,20,0.94)");
          rounded(ctx, 4, 4, w - 8, h - 8, 48);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = "rgba(168,85,247,0.4)";
          ctx.lineWidth = 3;
          ctx.stroke();
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
          ctx.fillStyle = "rgba(255,255,255,0.07)";
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.font = "600 38px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⠿   hold trigger here to move   ⠿", w / 2, h / 2 + 2);
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
    const iconTexture = (draw: IconDraw, hover: boolean) =>
      canvasTexture(256, 256, (ctx, w, h) => {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 116, 0, Math.PI * 2);
        ctx.fillStyle = hover ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.09)";
        ctx.fill();
        ctx.strokeStyle = hover ? "rgba(200,150,255,0.9)" : "rgba(255,255,255,0.28)";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#fff";
        draw(ctx, w, h);
      });

    const playIcon: IconDraw = (ctx, w, h) => {
      ctx.beginPath();
      ctx.moveTo(w * 0.4, h * 0.3);
      ctx.lineTo(w * 0.4, h * 0.7);
      ctx.lineTo(w * 0.72, h * 0.5);
      ctx.closePath();
      ctx.fill();
    };
    const pauseIcon: IconDraw = (ctx, w, h) => {
      ctx.fillRect(w * 0.36, h * 0.3, w * 0.1, h * 0.4);
      ctx.fillRect(w * 0.54, h * 0.3, w * 0.1, h * 0.4);
    };
    const textIcon = (label: string, size = 64): IconDraw => (ctx, w, h) => {
      ctx.font = `600 ${size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, w / 2, h / 2 + 4);
    };
    const recenterIcon: IconDraw = (ctx, w, h) => {
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 44, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 8, 0, Math.PI * 2); ctx.fill();
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + dx * 54, h / 2 + dy * 54);
        ctx.lineTo(w / 2 + dx * 80, h / 2 + dy * 80);
        ctx.stroke();
      }
    };

    const makeIconButton = (draw: IconDraw, x: number, action: () => void, size = 0.13) => {
      const normalTex = iconTexture(draw, false);
      const hoverTex = iconTexture(draw, true);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ map: normalTex, transparent: true })
      );
      mesh.position.set(x, -0.135, 0.006);
      mesh.userData = { action, normalTex, hoverTex, button: true };
      panel.add(mesh);
      interactives.push(mesh);
      return mesh;
    };

    makeIconButton(textIcon("⟲", 88), -0.5, () => { video.currentTime = 0; userPlay(); });
    makeIconButton(textIcon("−10", 58), -0.27, () => {
      video.currentTime = Math.max(0, video.currentTime - 10);
    });
    const playBtn = makeIconButton(playIcon, -0.02, userToggle, 0.17);
    makeIconButton(textIcon("+10", 58), 0.23, () => {
      if (video.duration) video.currentTime = Math.min(video.duration - 0.1, video.currentTime + 10);
    });
    makeIconButton(recenterIcon, 0.46, startRecenterCountdown);

    const playTexes = {
      playN: iconTexture(playIcon, false), playH: iconTexture(playIcon, true),
      pauseN: iconTexture(pauseIcon, false), pauseH: iconTexture(pauseIcon, true),
    };
    const refreshPlayButton = () => {
      playBtn.userData.normalTex = video.paused ? playTexes.playN : playTexes.pauseN;
      playBtn.userData.hoverTex = video.paused ? playTexes.playH : playTexes.pauseH;
      playBtn.material.map = playBtn.userData.normalTex;
      playBtn.material.needsUpdate = true;
    };

    const SEEK_W = 1.3;
    const seekTrack = new THREE.Mesh(
      new THREE.PlaneGeometry(SEEK_W, 0.075),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(1024, 64, (ctx, w, h) => {
          rounded(ctx, 2, 14, w - 4, h - 28, 18);
          ctx.fillStyle = "rgba(255,255,255,0.16)";
          ctx.fill();
        }),
        transparent: true,
        color: 0xffffff,
      })
    );
    seekTrack.position.set(0, 0.015, 0.005);
    seekTrack.userData = { seekBar: true, baseColor: 0xffffff, hoverColor: 0xccaaff };
    panel.add(seekTrack);
    interactives.push(seekTrack);

    const seekFill = new THREE.Mesh(
      new THREE.PlaneGeometry(SEEK_W, 0.075),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(1024, 64, (ctx, w, h) => {
          rounded(ctx, 2, 14, w - 4, h - 28, 18);
          const g = ctx.createLinearGradient(0, 0, w, 0);
          g.addColorStop(0, "#a855f7");
          g.addColorStop(1, "#ec4899");
          ctx.fillStyle = g;
          ctx.fill();
        }),
        transparent: true,
      })
    );
    seekFill.position.set(0, 0.015, 0.007);
    seekFill.scale.x = 0.001;
    panel.add(seekFill);

    const knob = new THREE.Mesh(
      new THREE.CircleGeometry(0.022, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    knob.position.set(-SEEK_W / 2, 0.015, 0.009);
    panel.add(knob);

    const timeCanvas = document.createElement("canvas");
    timeCanvas.width = 512; timeCanvas.height = 80;
    const timeCtx = timeCanvas.getContext("2d")!;
    const timeTex = new THREE.CanvasTexture(timeCanvas);
    timeTex.colorSpace = THREE.SRGBColorSpace;
    const timeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.097),
      new THREE.MeshBasicMaterial({ map: timeTex, transparent: true })
    );
    timeMesh.position.set(0, 0.108, 0.005);
    panel.add(timeMesh);

    const fmt = (t: number) => {
      if (!isFinite(t)) return "0:00";
      return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
    };
    const panelTicker = window.setInterval(() => {
      if (!panel.visible) return;
      timeCtx.clearRect(0, 0, 512, 80);
      timeCtx.font = "600 42px sans-serif";
      timeCtx.textAlign = "center";
      timeCtx.textBaseline = "middle";
      let status: string;
      if (recenterCountdown > 0) {
        timeCtx.fillStyle = "#c084fc";
        status = `⌖ Look at the new center… ${recenterCountdown}`;
      } else if (video.readyState < 3 && wantPlayingRef.current) {
        timeCtx.fillStyle = "#ffb84d";
        status = "⏳ Buffering…";
      } else {
        timeCtx.fillStyle = "rgba(255,255,255,0.85)";
        status = `${fmt(video.currentTime)}  /  ${fmt(video.duration)}`;
      }
      timeCtx.fillText(status, 256, 42);
      timeTex.needsUpdate = true;
      if (video.duration) {
        const f = video.currentTime / video.duration;
        seekFill.scale.x = Math.max(f, 0.001);
        seekFill.position.x = -SEEK_W / 2 + (SEEK_W * f) / 2;
        knob.position.x = -SEEK_W / 2 + SEEK_W * f;
      }
    }, 250);

    // --- controllers: lasers, hover, click, drag, A/X instant recenter ---
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();
    const intersectPanel = (controller: THREE.Object3D) => {
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
      return panel.visible ? raycaster.intersectObjects(interactives, false) : [];
    };

    const dragState = new Map<THREE.Object3D, boolean>();
    const onSelectStart = (controller: THREE.Object3D) => {
      if (!panel.visible) { panel.visible = true; placePanelInFront(); return; }
      const hits = intersectPanel(controller);
      if (!hits.length) return;
      const hit = hits[0];
      const ud = hit.object.userData;
      if (ud.handle) {
        controller.attach(panel);
        dragState.set(controller, true);
      } else if (ud.seekBar) {
        if (video.duration && hit.uv) video.currentTime = hit.uv.x * video.duration;
      } else if (ud.action) {
        ud.action();
      }
    };
    const onSelectEnd = (controller: THREE.Object3D) => {
      if (dragState.get(controller)) {
        scene.attach(panel);
        dragState.delete(controller);
      }
    };

    const controllers: THREE.Object3D[] = [];
    for (const i of [0, 1]) {
      const c = renderer.xr.getController(i);
      c.addEventListener("selectstart", () => onSelectStart(c));
      c.addEventListener("selectend", () => onSelectEnd(c));
      c.addEventListener("squeezestart", () => {
        panel.visible = !panel.visible;
        if (panel.visible) placePanelInFront();
      });
      const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3),
      ]);
      c.add(new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })));
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.008, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      c.add(tip);
      scene.add(c);
      controllers.push(c);
    }

    const recenterBtnPrev = new WeakMap<object, boolean>();
    const pollRecenterButtons = () => {
      const session = renderer.xr.getSession();
      if (!session) return;
      for (const src of session.inputSources) {
        const gp = src.gamepad;
        if (!gp || !gp.buttons[4]) continue;
        const pressed = gp.buttons[4].pressed; // A (right) / X (left)
        if (pressed && !recenterBtnPrev.get(src)) recenter();
        recenterBtnPrev.set(src, pressed);
      }
    };

    const updateHover = () => {
      for (const obj of interactives) {
        if (obj.userData.button && obj.material.map !== obj.userData.normalTex) {
          obj.material.map = obj.userData.normalTex;
          obj.material.needsUpdate = true;
        }
        if (obj.userData.baseColor !== undefined) obj.material.color.setHex(obj.userData.baseColor);
        obj.scale.setScalar(1);
      }
      if (!renderer.xr.isPresenting || !panel.visible) return;
      for (const c of controllers) {
        const hits = intersectPanel(c);
        if (!hits.length) continue;
        const obj = hits[0].object as (typeof interactives)[number];
        if (obj.userData.button) {
          obj.material.map = obj.userData.hoverTex;
          obj.material.needsUpdate = true;
          obj.scale.setScalar(1.12);
        }
        if (obj.userData.hoverColor !== undefined) obj.material.color.setHex(obj.userData.hoverColor);
      }
    };

    const onSessionStart = () => {
      panel.visible = true;
      userPlay();
      window.setTimeout(placePanelInFront, 300);
    };
    renderer.xr.addEventListener("sessionstart", onSessionStart);

    // --- desktop drag-to-look ---
    let lon = 0, lat = 0, dragging = false, px = 0, py = 0;
    const el = renderer.domElement;
    const onPointerDown = (e: PointerEvent) => { dragging = true; px = e.clientX; py = e.clientY; };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      lon -= (e.clientX - px) * 0.18;
      lat += (e.clientY - py) * 0.18;
      lat = Math.max(-85, Math.min(85, lat));
      px = e.clientX; py = e.clientY;
    };
    const onPointerUp = () => { dragging = false; };
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    // --- React state sync ---
    const onPlay = () => { setPlaying(true); refreshPlayButton(); };
    const onPause = () => { setPlaying(false); refreshPlayButton(); };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onTime = () => {
      setProgress(video.currentTime);
      if (video.duration && isFinite(video.duration)) setDuration(video.duration);
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onTime);

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    renderer.setAnimationLoop(() => {
      if (!renderer.xr.isPresenting) {
        const phi = THREE.MathUtils.degToRad(90 - lat);
        const theta = THREE.MathUtils.degToRad(lon);
        camera.lookAt(
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi),
          -Math.sin(phi) * Math.cos(theta)
        );
      }
      pollRecenterButtons();
      updateHover();
      renderer.render(scene, camera);
    });

    // expose play/pause/seek to the DOM controls
    (container as any).__vrPlayer = { userPlay, userPause, userToggle };

    return () => {
      wantPlayingRef.current = false;
      window.clearInterval(watchdog);
      window.clearInterval(panelTicker);
      if (countdownTimer) window.clearTimeout(countdownTimer);
      renderer.setAnimationLoop(null);
      renderer.xr.removeEventListener("sessionstart", onSessionStart);
      renderer.xr.getSession()?.end().catch(() => {});
      video.pause();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onTime);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.MeshBasicMaterial | undefined;
        if (mat) { mat.map?.dispose(); mat.dispose(); }
      });
      texture.dispose();
      renderer.dispose();
      vrButton.remove();
      renderer.domElement.remove();
    };
  }, [src]);

  const fmt = (t: number) =>
    `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  const player = () => (containerRef.current as any)?.__vrPlayer;

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        poster={poster}
        crossOrigin="anonymous"
        playsInline
        preload="auto"
        loop
        className="hidden"
      />
      <div ref={containerRef} className="w-full h-full" />

      {/* Desktop / mobile DOM controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-background/70 backdrop-blur border border-border z-10 w-[min(90%,560px)]">
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 rounded-full"
          onClick={() => player()?.userToggle()}
        >
          {buffering ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {fmt(progress)} / {fmt(duration)}
        </span>
        <Slider
          value={[duration ? (progress / duration) * 100 : 0]}
          onValueChange={([v]) => {
            const video = videoRef.current;
            if (video && duration) video.currentTime = (v / 100) * duration;
          }}
          max={100}
          step={0.1}
          className="flex-1"
        />
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 rounded-full"
          onClick={() => {
            const video = videoRef.current;
            if (video) { video.currentTime = 0; player()?.userPlay(); }
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default VR180WebXRPlayer;
