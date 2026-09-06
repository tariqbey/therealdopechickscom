import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type ConnState =
  | "idle" | "media" | "waiting" | "connecting" | "connected" | "reconnecting" | "failed" | "ended";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

interface Options {
  callId: string;
  userId: string;
  /** The fan always makes the offer; the creator answers. */
  isCaller: boolean;
  enabled: boolean;
  onRemoteHangup?: () => void;
}

/**
 * 1:1 WebRTC call signalled over a Supabase Realtime broadcast channel
 * (`call:<id>`), with presence to know when the other side is in the room.
 * Handles the other side reloading (fresh peer + re-offer), ICE restart on
 * retry, mic/cam toggles and front/back camera flip.
 */
export function useWebRTCCall({ callId, userId, isCaller, enabled, onRemoteHangup }: Options) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<ConnState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [canFlip, setCanFlip] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const remotePresentRef = useRef(false);
  const offerSentRef = useRef(false);
  const everConnectedRef = useRef(false);
  const facingRef = useRef<"user" | "environment">("user");
  const camOnRef = useRef(true);
  const onRemoteHangupRef = useRef(onRemoteHangup);
  onRemoteHangupRef.current = onRemoteHangup;
  const actionsRef = useRef<{ makeOffer: (r?: boolean) => Promise<void>; createPeer: () => RTCPeerConnection; send: (e: string, p?: any) => void } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const send = (event: string, payload: any = {}) => {
      channelRef.current?.send({ type: "broadcast", event, payload: { ...payload, from: userId } });
    };

    const createPeer = () => {
      pcRef.current?.close();
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      pendingIce.current = [];
      offerSentRef.current = false;
      const local = localRef.current;
      if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));
      pc.ontrack = (e) => { if (e.streams[0]) setRemoteStream(e.streams[0]); };
      pc.onicecandidate = (e) => { if (e.candidate) send("ice", { candidate: e.candidate.toJSON() }); };
      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case "connected": everConnectedRef.current = true; setState("connected"); break;
          case "connecting": setState(everConnectedRef.current ? "reconnecting" : "connecting"); break;
          case "disconnected": setState("reconnecting"); break;
          case "failed": setState("failed"); break;
          default: break;
        }
      };
      return pc;
    };

    const flushIce = async (pc: RTCPeerConnection) => {
      for (const c of pendingIce.current) { try { await pc.addIceCandidate(c); } catch { /* stale */ } }
      pendingIce.current = [];
    };

    const makeOffer = async (iceRestart = false) => {
      const pc = pcRef.current;
      if (!pc) return;
      offerSentRef.current = true;
      setState(everConnectedRef.current ? "reconnecting" : "connecting");
      const offer = await pc.createOffer({ iceRestart });
      await pc.setLocalDescription(offer);
      send("offer", { sdp: pc.localDescription });
    };
    actionsRef.current = { makeOffer, createPeer, send };

    (async () => {
      setState("media");
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingRef.current, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localRef.current = stream;
        setLocalStream(stream);
        setMicOn(true); setCamOn(true); camOnRef.current = true;
        try {
          const devs = await navigator.mediaDevices.enumerateDevices();
          setCanFlip(devs.filter((d) => d.kind === "videoinput").length > 1);
        } catch { /* ignore */ }
      } catch (e: any) {
        setError(
          e?.name === "NotAllowedError" || e?.name === "SecurityError"
            ? "Camera and microphone access was blocked. Allow access in your browser settings, then try again."
            : e?.name === "NotFoundError"
              ? "No camera or microphone was found on this device."
              : "Could not access your camera or microphone."
        );
        setState("failed");
        return;
      }

      createPeer();
      setState("waiting");

      const channel = supabase.channel(`call:${callId}`, {
        config: { broadcast: { self: false }, presence: { key: userId } },
      });
      channelRef.current = channel;
      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (isCaller || payload.from === userId) return;
          // Every (re)offer gets a fresh peer so a reload on the other side reconnects cleanly.
          const pc = createPeer();
          setState(everConnectedRef.current ? "reconnecting" : "connecting");
          try {
            await pc.setRemoteDescription(payload.sdp);
            await flushIce(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send("answer", { sdp: pc.localDescription });
          } catch { setState("failed"); }
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          const pc = pcRef.current;
          if (!isCaller || !pc || payload.from === userId) return;
          if (pc.signalingState !== "have-local-offer") return;
          try { await pc.setRemoteDescription(payload.sdp); await flushIce(pc); } catch { setState("failed"); }
        })
        .on("broadcast", { event: "ice" }, async ({ payload }) => {
          const pc = pcRef.current;
          if (!pc || payload.from === userId) return;
          if (pc.remoteDescription) { try { await pc.addIceCandidate(payload.candidate); } catch { /* stale */ } }
          else pendingIce.current.push(payload.candidate);
        })
        .on("broadcast", { event: "renegotiate" }, () => {
          if (!isCaller) return;
          createPeer();
          makeOffer().catch(() => setState("failed"));
        })
        .on("broadcast", { event: "bye" }, ({ payload }) => {
          if (payload.from === userId) return;
          setState("ended");
          onRemoteHangupRef.current?.();
        })
        .on("presence", { event: "sync" }, () => {
          const present = Object.keys(channel.presenceState()).some((k) => k !== userId);
          const was = remotePresentRef.current;
          remotePresentRef.current = present;
          if (present && !was) {
            if (isCaller) {
              if (offerSentRef.current) createPeer();
              makeOffer().catch(() => setState("failed"));
            }
          } else if (!present && was) {
            setState((s) => (s === "ended" ? s : "waiting"));
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") await channel.track({ user: userId, at: Date.now() });
        });
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      pcRef.current?.close();
      pcRef.current = null;
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      setLocalStream(null);
      setRemoteStream(null);
      remotePresentRef.current = false;
      offerSentRef.current = false;
      everConnectedRef.current = false;
      actionsRef.current = null;
    };
  }, [enabled, callId, userId, isCaller]);

  const toggleMic = useCallback(() => {
    const t = localRef.current?.getAudioTracks() ?? [];
    const next = !(t[0]?.enabled ?? true);
    t.forEach((x) => (x.enabled = next));
    setMicOn(next);
  }, []);

  const toggleCam = useCallback(() => {
    const t = localRef.current?.getVideoTracks() ?? [];
    const next = !(t[0]?.enabled ?? true);
    t.forEach((x) => (x.enabled = next));
    camOnRef.current = next;
    setCamOn(next);
  }, []);

  const flipCamera = useCallback(async () => {
    const nextFacing = facingRef.current === "user" ? "environment" : "user";
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: nextFacing } } });
    } catch {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacing } }); }
      catch { return; }
    }
    const newTrack = stream.getVideoTracks()[0];
    if (!newTrack) return;
    newTrack.enabled = camOnRef.current;
    const local = localRef.current;
    const old = local?.getVideoTracks()[0];
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
    try { await sender?.replaceTrack(newTrack); } catch { /* ignore */ }
    if (local) {
      if (old) { local.removeTrack(old); old.stop(); }
      local.addTrack(newTrack);
      setLocalStream(new MediaStream(local.getTracks()));
    }
    facingRef.current = nextFacing;
    setFacing(nextFacing);
  }, []);

  /** Tell the other side we're leaving (the caller then ends the call server-side). */
  const sendBye = useCallback(() => { actionsRef.current?.send("bye"); }, []);

  /** Rebuild the connection: the caller re-offers, the callee asks the caller to. */
  const retry = useCallback(() => {
    const a = actionsRef.current;
    if (!a) return;
    everConnectedRef.current = false;
    if (isCaller) { a.createPeer(); a.makeOffer().catch(() => setState("failed")); }
    else { a.createPeer(); a.send("renegotiate"); setState("connecting"); }
  }, [isCaller]);

  return { localStream, remoteStream, state, error, micOn, camOn, canFlip, facing, toggleMic, toggleCam, flipCamera, sendBye, retry };
}
