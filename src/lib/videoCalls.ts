import { supabase } from "@/integrations/supabase/client";

export type CallStatus =
  | "requested" | "accepted" | "active" | "ended" | "declined" | "cancelled" | "expired";

export interface VideoCall {
  id: string;
  creator_id: string;
  fan_id: string;
  conversation_id: string;
  status: CallStatus;
  bread_paid: number;
  creator_cut: number;
  minutes_allowed: number;
  refunded: boolean;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  ended_by: string | null;
}

export interface CallProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator?: boolean;
  video_calls_enabled?: boolean;
  video_call_price_bread?: number;
  video_call_minutes?: number;
  video_messages_enabled?: boolean;
}

export const CREATOR_SHARE = 0.8;

export const conversationIdFor = (a: string, b: string) => [a, b].sort().join("_");
export const isOpenCall = (s: CallStatus) => s === "requested" || s === "accepted" || s === "active";

export const formatDuration = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

const rpc = async <T = any>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabase as any).rpc(fn, args ?? {});
  if (error) throw new Error(error.message);
  const r = data as any;
  if (r && typeof r === "object" && r.success === false) throw new Error(r.error || "Request failed");
  return r as T;
};

export const requestVideoCall = (creatorId: string) =>
  rpc<{ success: true; call_id: string; bread_paid?: number; existing?: boolean; status?: CallStatus }>(
    "request_video_call", { p_creator_id: creatorId }
  );
export const respondVideoCall = (callId: string, accept: boolean) =>
  rpc<{ success: true; status: CallStatus }>("respond_video_call", { p_call_id: callId, p_accept: accept });
export const cancelVideoCall = (callId: string) =>
  rpc<{ success: true; status: CallStatus }>("cancel_video_call", { p_call_id: callId });
export const startVideoCall = (callId: string) =>
  rpc<{ success: boolean; status: CallStatus; started_at: string | null }>("start_video_call", { p_call_id: callId });
export const endVideoCall = (callId: string) =>
  rpc<{ success: true; status: CallStatus; duration_seconds?: number }>("end_video_call", { p_call_id: callId });
export const expireStaleVideoCalls = () =>
  (supabase as any).rpc("expire_stale_video_calls").then(() => undefined).catch(() => undefined);

export const fetchVideoCall = async (id: string): Promise<VideoCall | null> => {
  const { data } = await (supabase as any).from("video_calls").select("*").eq("id", id).maybeSingle();
  return (data as VideoCall) || null;
};

export const fetchCallProfile = async (userId: string): Promise<CallProfile | null> => {
  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url, is_creator, video_calls_enabled, video_call_price_bread, video_call_minutes, video_messages_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as unknown as CallProfile) || null;
};

/** Fire-and-forget web push to a user (uses the existing send-push-notification function). */
export const notifyUser = (userId: string, title: string, body: string, url?: string) => {
  supabase.functions
    .invoke("send-push-notification", { body: { user_id: userId, payload: { title, body, url } } })
    .catch(() => {});
};
