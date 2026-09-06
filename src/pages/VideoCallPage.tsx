import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useWebRTCCall, type ConnState } from "@/hooks/useWebRTCCall";
import {
  cancelVideoCall, endVideoCall, fetchCallProfile, fetchVideoCall, formatDuration,
  notifyUser, respondVideoCall, startVideoCall, type CallProfile, type VideoCall,
} from "@/lib/videoCalls";
import {
  ArrowLeft, Camera, CameraOff, Check, Loader2, MessageCircle, Mic, MicOff, Phone, PhoneOff,
  RefreshCw, SwitchCamera, Video, Wifi, WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

const stateLabel: Record<ConnState, string> = {
  idle: "", media: "Starting camera…", waiting: "Waiting for the other side…", connecting: "Connecting…",
  connected: "Connected", reconnecting: "Reconnecting…", failed: "Connection failed", ended: "Call ended",
};

const Shell = ({ children, onBack }: { children: React.ReactNode; onBack: () => void }) => (
  <div className="min-h-screen bg-black text-white flex flex-col">
    <div className="flex items-center gap-3 p-4">
      <Button size="icon" variant="ghost" className="rounded-full text-white hover:bg-white/10 hover:text-white" onClick={onBack} aria-label="Back">
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="text-sm font-semibold flex items-center gap-2"><Video className="h-4 w-4 text-primary" /> Video call</div>
    </div>
    <div className="flex-1 flex items-center justify-center p-6">{children}</div>
  </div>
);

const VideoCallPage = () => {
  const { callId } = useParams<{ callId: string }>();
  const { user, loading: authLoading, refreshWallet, refreshCreditWallet } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [call, setCall] = useState<VideoCall | null>(null);
  const [other, setOther] = useState<CallProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const endingRef = useRef(false);

  const isCreator = !!(user && call && user.id === call.creator_id);
  const isFan = !!(user && call && user.id === call.fan_id);
  const inRoom = !!call && (call.status === "accepted" || call.status === "active");

  // ---------- load + realtime ----------
  useEffect(() => {
    if (authLoading || !callId) return;
    if (!user) { navigate("/auth"); return; }
    let alive = true;
    (async () => {
      const c = await fetchVideoCall(callId);
      if (!alive) return;
      if (!c) { setNotFound(true); return; }
      setCall(c);
      const otherId = c.creator_id === user.id ? c.fan_id : c.creator_id;
      setOther(await fetchCallProfile(otherId));
    })();
    const channel = supabase
      .channel(`call-row-${callId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "video_calls", filter: `id=eq.${callId}` },
        (p) => setCall(p.new as VideoCall))
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [callId, user?.id, authLoading, navigate, user]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // ---------- hang up ----------
  const hangUp = useCallback(async (silent = false) => {
    if (!call || endingRef.current) return;
    endingRef.current = true;
    setBusy(true);
    try {
      const res = await endVideoCall(call.id);
      if (!silent) toast({ title: "Call ended", description: res.duration_seconds != null ? `Duration ${formatDuration(res.duration_seconds)}` : undefined });
      refreshWallet(); refreshCreditWallet();
    } catch (e: any) {
      if (!silent) toast({ title: "Couldn't end the call", description: e.message, variant: "destructive" });
    }
    setBusy(false);
    setJoined(false);
    endingRef.current = false;
  }, [call, toast, refreshWallet, refreshCreditWallet]);

  const rtc = useWebRTCCall({
    callId: callId || "",
    userId: user?.id || "",
    isCaller: isFan,
    enabled: joined && inRoom,
    onRemoteHangup: () => hangUp(true),
  });

  // Mark active the first time both sides are connected (idempotent server-side).
  useEffect(() => {
    if (rtc.state === "connected" && call?.status === "accepted") {
      startVideoCall(call.id).catch(() => {});
    }
  }, [rtc.state, call?.status, call?.id]);

  // Attach streams
  useEffect(() => { if (localVideoRef.current) localVideoRef.current.srcObject = rtc.localStream; }, [rtc.localStream, joined, inRoom]);
  useEffect(() => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rtc.remoteStream; }, [rtc.remoteStream, joined, inRoom]);

  // ---------- timer ----------
  const deadline = useMemo(() => {
    if (!call?.started_at) return null;
    return new Date(call.started_at).getTime() + call.minutes_allowed * 60_000;
  }, [call?.started_at, call?.minutes_allowed]);
  const remaining = deadline ? Math.max(0, Math.floor((deadline - now) / 1000)) : null;
  const elapsed = call?.started_at ? Math.max(0, Math.floor((now - new Date(call.started_at).getTime()) / 1000)) : 0;

  useEffect(() => {
    if (call?.status === "active" && remaining === 0 && !endingRef.current) {
      rtc.sendBye();
      hangUp(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, call?.status]);

  // ---------- controls auto-hide during a connected call ----------
  const poke = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowControls(false), 4000);
  }, []);
  useEffect(() => {
    if (rtc.state === "connected") poke(); else setShowControls(true);
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); };
  }, [rtc.state, poke]);

  // ---------- actions ----------
  const accept = async () => {
    if (!call) return;
    setBusy(true);
    try {
      await respondVideoCall(call.id, true);
      notifyUser(call.fan_id, "📞 Call accepted", `${other?.display_name || "The creator"} accepted your video call — join now`, `/call/${call.id}`);
    } catch (e: any) { toast({ title: "Couldn't accept", description: e.message, variant: "destructive" }); }
    setBusy(false);
  };
  const decline = async () => {
    if (!call) return;
    setBusy(true);
    try { await respondVideoCall(call.id, false); }
    catch (e: any) { toast({ title: "Couldn't decline", description: e.message, variant: "destructive" }); }
    setBusy(false);
  };
  const cancel = async () => {
    if (!call) return;
    setBusy(true);
    try { await cancelVideoCall(call.id); refreshWallet(); }
    catch (e: any) { toast({ title: "Couldn't cancel", description: e.message, variant: "destructive" }); }
    setBusy(false);
  };
  const leave = () => {
    rtc.sendBye();
    hangUp();
  };
  const backToChat = () => {
    const otherId = other?.user_id || (call ? (isCreator ? call.fan_id : call.creator_id) : null);
    navigate(otherId ? `/messages?to=${otherId}` : "/messages");
  };

  // ---------- render ----------
  if (authLoading || (!call && !notFound)) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (notFound || !call || !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Video className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">This call doesn't exist or you're not part of it.</p>
        <Button onClick={() => navigate("/")}>Back home</Button>
      </div>
    );
  }
  if (!isCreator && !isFan) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">You're not a participant in this call.</p>
        <Button onClick={() => navigate("/")}>Back home</Button>
      </div>
    );
  }

  const name = other?.display_name || (isCreator ? "Fan" : "Creator");
  const avatar = other?.avatar_url ? (
    <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />
  ) : <span className="text-3xl font-black">{name[0]?.toUpperCase()}</span>;

  // -- requested --
  if (call.status === "requested") {
    const expired = new Date(call.expires_at) < new Date();
    return (
      <Shell onBack={backToChat}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <div className="relative mx-auto mb-6 h-28 w-28">
            <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
            <div className="relative h-28 w-28 rounded-full bg-muted overflow-hidden flex items-center justify-center ring-4 ring-primary/50">{avatar}</div>
          </div>
          <h1 className="text-2xl font-black mb-1">{name}</h1>
          <p className="text-sm text-white/60 mb-6">
            {isCreator ? `wants a ${call.minutes_allowed}-minute video call` : (expired ? "This request expired" : `Waiting for ${name} to accept…`)}
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-6 text-sm flex justify-around">
            <div><div className="text-white/50 text-[11px] uppercase tracking-wider">Length</div><div className="font-bold">{call.minutes_allowed} min</div></div>
            <div><div className="text-white/50 text-[11px] uppercase tracking-wider">{isCreator ? "You earn" : "Paid"}</div>
              <div className="font-bold text-gradient-gold">{isCreator ? Math.floor(call.bread_paid * 0.8) : call.bread_paid} BREAD</div></div>
          </div>
          {isCreator ? (
            <div className="flex gap-3 justify-center">
              <Button onClick={accept} disabled={busy} className="rounded-full h-14 px-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Phone className="h-5 w-5 mr-2" /> Accept</>}
              </Button>
              <Button onClick={decline} disabled={busy} variant="outline" className="rounded-full h-14 px-6 border-red-500/60 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold">
                <PhoneOff className="h-5 w-5 mr-2" /> Decline
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-white/50">You can leave this page — we'll notify you as soon as {name} accepts, and you're refunded automatically if they don't within 24 hours.</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={cancel} disabled={busy} variant="outline" className="rounded-full border-white/20 text-white hover:bg-white/10 hover:text-white">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel request"}{call.bread_paid > 0 && !busy && " · refund"}
                </Button>
                <Button onClick={backToChat} variant="ghost" className="rounded-full text-white/80 hover:bg-white/10 hover:text-white">
                  <MessageCircle className="h-4 w-4 mr-2" /> Back to chat
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </Shell>
    );
  }

  // -- ended / declined / cancelled / expired --
  if (!inRoom) {
    const duration = call.started_at && call.ended_at
      ? Math.max(0, Math.floor((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000))
      : null;
    const headline = call.status === "declined" ? "Call declined"
      : call.status === "cancelled" ? "Request cancelled"
      : call.status === "expired" ? "Request expired"
      : "Call ended";
    return (
      <Shell onBack={backToChat}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 h-24 w-24 rounded-full bg-muted overflow-hidden flex items-center justify-center ring-4 ring-white/10">{avatar}</div>
          <h1 className="text-2xl font-black mb-1">{headline}</h1>
          <p className="text-sm text-white/60 mb-6">
            with {name}
            {duration != null && <> · {formatDuration(duration)}</>}
            {call.refunded && call.bread_paid > 0 && <> · {call.bread_paid} BREAD refunded{isFan ? " to you" : ""}</>}
            {!call.refunded && call.status === "ended" && call.creator_cut > 0 && isCreator && <> · you earned {call.creator_cut} BREAD</>}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={backToChat} className="rounded-full bg-gradient-purple text-primary-foreground font-bold">
              <MessageCircle className="h-4 w-4 mr-2" /> Back to chat
            </Button>
          </div>
        </motion.div>
      </Shell>
    );
  }

  // -- accepted / active: the room --
  if (!joined) {
    return (
      <Shell onBack={backToChat}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 h-28 w-28 rounded-full bg-muted overflow-hidden flex items-center justify-center ring-4 ring-emerald-500/60">{avatar}</div>
          <h1 className="text-2xl font-black mb-1">{name}</h1>
          <p className="text-sm text-white/60 mb-6">
            {call.status === "active" ? "Call in progress — rejoin" : (isCreator ? "You accepted. Join when you're ready." : `${name} accepted your call!`)}
            <br />{call.minutes_allowed} minutes{call.started_at && remaining != null ? ` · ${formatDuration(remaining)} left` : ""}
          </p>
          <Button onClick={() => setJoined(true)} className="rounded-full h-14 px-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base">
            <Video className="h-5 w-5 mr-2" /> Join call
          </Button>
          <div className="mt-4">
            <Button onClick={leave} disabled={busy} variant="ghost" className="rounded-full text-white/60 hover:text-red-300 hover:bg-red-500/10 text-xs">
              <PhoneOff className="h-4 w-4 mr-2" /> {call.status === "active" ? "End call" : "Don't join · end call"}
            </Button>
          </div>
        </motion.div>
      </Shell>
    );
  }

  const connected = rtc.state === "connected";
  const overlayOn = showControls || !connected;
  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden" onPointerMove={poke} onPointerDown={poke}>
      {/* Remote (full screen) */}
      <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black" />
      {!connected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm">
          <div className="h-24 w-24 rounded-full bg-muted overflow-hidden flex items-center justify-center ring-4 ring-white/10">{avatar}</div>
          <div className="text-lg font-bold">{name}</div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            {rtc.state === "failed" ? <WifiOff className="h-4 w-4 text-red-400" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            {stateLabel[rtc.state]}
          </div>
          {rtc.error && <p className="text-xs text-red-300 max-w-xs text-center px-4">{rtc.error}</p>}
          {(rtc.state === "failed" || rtc.state === "reconnecting") && !rtc.error && (
            <Button size="sm" variant="outline" className="rounded-full border-white/20 text-white hover:bg-white/10 hover:text-white" onClick={rtc.retry}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry connection
            </Button>
          )}
          {rtc.error && (
            <Button size="sm" variant="outline" className="rounded-full border-white/20 text-white hover:bg-white/10 hover:text-white" onClick={() => { setJoined(false); window.setTimeout(() => setJoined(true), 50); }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Try again
            </Button>
          )}
        </div>
      )}

      {/* Local PiP */}
      <div className="absolute top-20 right-3 md:top-4 md:right-4 w-28 md:w-44 aspect-[3/4] rounded-2xl overflow-hidden ring-2 ring-white/20 shadow-2xl bg-black/60 z-10">
        <video ref={localVideoRef} autoPlay playsInline muted className={cn("w-full h-full object-cover", rtc.facing === "user" && "scale-x-[-1]", !rtc.camOn && "opacity-0")} />
        {!rtc.camOn && <div className="absolute inset-0 flex items-center justify-center"><CameraOff className="h-6 w-6 text-white/60" /></div>}
        {!rtc.micOn && <div className="absolute bottom-1.5 left-1.5 h-6 w-6 rounded-full bg-red-600 flex items-center justify-center"><MicOff className="h-3 w-3" /></div>}
      </div>

      {/* Top bar */}
      <div className={cn("absolute top-0 left-0 right-0 p-4 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent transition-opacity", overlayOn ? "opacity-100" : "opacity-0")}>
        <div className="h-9 w-9 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-bold">{avatar}</div>
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{name}</div>
          <div className="text-[11px] text-white/70 flex items-center gap-1.5">
            {connected ? <Wifi className="h-3 w-3 text-emerald-400" /> : <Loader2 className="h-3 w-3 animate-spin" />}
            {stateLabel[rtc.state]}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {call.status === "active" && remaining != null && (
            <div className={cn("px-3 py-1 rounded-full text-xs font-mono font-semibold border", remaining <= 60 ? "bg-red-600/80 border-red-400 animate-pulse" : "bg-black/50 border-white/15")}>
              {formatDuration(elapsed)} · {formatDuration(remaining)} left
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className={cn("absolute bottom-0 left-0 right-0 pb-8 pt-16 flex items-center justify-center gap-3 md:gap-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity", overlayOn ? "opacity-100" : "opacity-0")}>
        <button onClick={rtc.toggleMic} className={cn("h-14 w-14 rounded-full flex items-center justify-center transition", rtc.micOn ? "bg-white/15 hover:bg-white/25" : "bg-white text-black")} aria-label={rtc.micOn ? "Mute" : "Unmute"}>
          {rtc.micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </button>
        <button onClick={rtc.toggleCam} className={cn("h-14 w-14 rounded-full flex items-center justify-center transition", rtc.camOn ? "bg-white/15 hover:bg-white/25" : "bg-white text-black")} aria-label={rtc.camOn ? "Camera off" : "Camera on"}>
          {rtc.camOn ? <Camera className="h-6 w-6" /> : <CameraOff className="h-6 w-6" />}
        </button>
        {rtc.canFlip && (
          <button onClick={rtc.flipCamera} className="h-14 w-14 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center" aria-label="Flip camera">
            <SwitchCamera className="h-6 w-6" />
          </button>
        )}
        <button onClick={leave} disabled={busy} className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-lg shadow-red-900/50" aria-label="End call">
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <PhoneOff className="h-7 w-7" />}
        </button>
      </div>

      {connected && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/40 flex items-center gap-1 pointer-events-none">
          <Check className="h-3 w-3" /> end-to-end WebRTC
        </div>
      )}
    </div>
  );
};

export default VideoCallPage;
