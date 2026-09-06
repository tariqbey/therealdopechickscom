import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  expireStaleVideoCalls, fetchCallProfile, notifyUser, respondVideoCall,
  type CallProfile, type VideoCall,
} from "@/lib/videoCalls";
import { Loader2, Phone, PhoneOff, Video } from "lucide-react";

interface Alert {
  call: VideoCall;
  other: CallProfile | null;
  kind: "incoming" | "accepted";
}

/** Simple ring using WebAudio (no asset needed). Stops after ~30s. */
const useRinger = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const start = () => {
    try {
      stopRef.current?.();
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx: AudioContext = ctxRef.current || new AC();
      ctxRef.current = ctx;
      ctx.resume().catch(() => {});
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      const o1 = ctx.createOscillator(); o1.frequency.value = 440; o1.connect(gain);
      const o2 = ctx.createOscillator(); o2.frequency.value = 480; o2.connect(gain);
      o1.start(); o2.start();
      const t0 = ctx.currentTime;
      for (let i = 0; i < 8; i++) {
        const t = t0 + i * 4;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.08, t + 0.05);
        gain.gain.setValueAtTime(0.08, t + 1.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 2);
      }
      const stopAt = window.setTimeout(() => stopRef.current?.(), 32000);
      stopRef.current = () => {
        window.clearTimeout(stopAt);
        try { o1.stop(); o2.stop(); } catch { /* already stopped */ }
        gain.disconnect();
        stopRef.current = null;
      };
    } catch { /* audio blocked until a gesture; fine */ }
  };
  const stop = () => stopRef.current?.();
  return { start, stop };
};

/**
 * Global banner for video calls: creators see incoming paid requests (with
 * Accept / Decline right there), fans see when a creator accepts. Hidden while
 * you're already on that call's page.
 */
const CallNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const ringer = useRinger();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const seen = useRef(new Set<string>());

  const upsert = async (call: VideoCall, kind: Alert["kind"]) => {
    const otherId = kind === "incoming" ? call.fan_id : call.creator_id;
    const other = await fetchCallProfile(otherId);
    setAlerts((prev) => {
      const rest = prev.filter((a) => a.call.id !== call.id);
      return [{ call, other, kind }, ...rest];
    });
    const key = `${call.id}:${kind}`;
    if (!seen.current.has(key)) {
      seen.current.add(key);
      if (kind === "incoming") ringer.start();
    }
  };
  const remove = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.call.id !== id));
    ringer.stop();
  };

  useEffect(() => {
    if (!user) { setAlerts([]); return; }
    const uid = user.id;
    let alive = true;

    (async () => {
      await expireStaleVideoCalls();
      const { data } = await (supabase as any)
        .from("video_calls")
        .select("*")
        .or(`creator_id.eq.${uid},fan_id.eq.${uid}`)
        .in("status", ["requested", "accepted"])
        .order("created_at", { ascending: false });
      if (!alive || !data) return;
      for (const c of data as VideoCall[]) {
        if (c.status === "requested" && c.creator_id === uid && new Date(c.expires_at) > new Date()) await upsert(c, "incoming");
        else if (c.status === "accepted" && c.fan_id === uid) await upsert(c, "accepted");
      }
    })();

    const handle = (row: VideoCall) => {
      if (row.status === "requested" && row.creator_id === uid) upsert(row, "incoming");
      else if (row.status === "accepted" && row.fan_id === uid) upsert(row, "accepted");
      else remove(row.id);
    };
    const channel = supabase
      .channel(`video-calls-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "video_calls", filter: `creator_id=eq.${uid}` }, (p) => handle(p.new as VideoCall))
      .on("postgres_changes", { event: "*", schema: "public", table: "video_calls", filter: `fan_id=eq.${uid}` }, (p) => handle(p.new as VideoCall))
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); ringer.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const respond = async (a: Alert, accept: boolean) => {
    setBusy(a.call.id);
    try {
      await respondVideoCall(a.call.id, accept);
      remove(a.call.id);
      if (accept) {
        notifyUser(a.call.fan_id, "📞 Call accepted", `${a.other?.display_name || "The creator"} accepted your video call — join now`, `/call/${a.call.id}`);
        navigate(`/call/${a.call.id}`);
      } else {
        toast({ title: "Call declined", description: a.call.bread_paid ? `${a.call.bread_paid} BREAD refunded to the fan.` : undefined });
      }
    } catch (e: any) {
      toast({ title: "Couldn't respond", description: e.message, variant: "destructive" });
    }
    setBusy(null);
  };

  const visible = alerts.filter((a) => !location.pathname.startsWith(`/call/${a.call.id}`));
  if (!user || visible.length === 0) return null;

  return (
    <div className="fixed z-[60] inset-x-3 bottom-3 md:inset-x-auto md:right-4 md:top-20 md:bottom-auto md:w-[380px] space-y-2 pointer-events-none">
      <AnimatePresence>
        {visible.map((a) => {
          const name = a.other?.display_name || (a.kind === "incoming" ? "A fan" : "The creator");
          return (
            <motion.div
              key={a.call.id}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              className="pointer-events-auto rounded-2xl border border-primary/40 bg-background/95 backdrop-blur shadow-2xl shadow-primary/20 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center font-bold">
                  {a.other?.avatar_url ? <img src={a.other.avatar_url} alt="" className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
                  <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
                    <Video className="h-3 w-3 text-primary-foreground" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">
                    {a.kind === "incoming" ? `${name} wants a video call` : `${name} accepted your call`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.call.minutes_allowed} min
                    {a.call.bread_paid > 0 && <> · <span className="text-gradient-gold font-semibold">{a.call.bread_paid} BREAD</span></>}
                    {a.kind === "incoming" && a.call.bread_paid > 0 && <> · you earn {Math.floor(a.call.bread_paid * 0.8)}</>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {a.kind === "incoming" ? (
                  <>
                    <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold" disabled={busy === a.call.id} onClick={() => respond(a, true)}>
                      {busy === a.call.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Phone className="h-4 w-4 mr-1.5" /> Accept</>}
                    </Button>
                    <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" disabled={busy === a.call.id} onClick={() => respond(a, false)}>
                      <PhoneOff className="h-4 w-4 mr-1.5" /> Decline
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" className="flex-1 bg-gradient-purple text-primary-foreground font-bold" onClick={() => { remove(a.call.id); navigate(`/call/${a.call.id}`); }}>
                      <Video className="h-4 w-4 mr-1.5" /> Join call
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(a.call.id)}>Later</Button>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default CallNotifications;
