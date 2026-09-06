-- Paid 1-on-1 video calls (FaceTime-style, WebRTC) + video messages in chat.
--
-- Flow: fan pays the creator's call price in BREAD up front (held in escrow on
-- the call row), creator accepts/declines, both join a WebRTC room signalled
-- over Supabase Realtime, and the creator is credited (80/20 split, same as VR
-- unlocks) when the call ends. Declined / cancelled / expired / never-connected
-- calls refund the fan automatically.

-- ---------- creator settings ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS video_calls_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_call_price_bread integer NOT NULL DEFAULT 100 CHECK (video_call_price_bread >= 0),
  ADD COLUMN IF NOT EXISTS video_call_minutes integer NOT NULL DEFAULT 15 CHECK (video_call_minutes BETWEEN 1 AND 180),
  ADD COLUMN IF NOT EXISTS video_messages_enabled boolean NOT NULL DEFAULT true;

-- ---------- video messages ----------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IS NULL OR media_type IN ('video', 'call')),
  ADD COLUMN IF NOT EXISTS call_id uuid;

-- Private bucket; objects live under <conversation_id>/<uuid>.webm and the
-- conversation id is "<uidA>_<uidB>", so a participant's uid appears in the
-- first folder segment. Playback uses short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-media', 'message-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Participants can upload message media" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'message-media'
  AND position(auth.uid()::text IN (storage.foldername(name))[1]) > 0
);

CREATE POLICY "Participants can read message media" ON storage.objects FOR SELECT
USING (
  bucket_id = 'message-media'
  AND (
    position(auth.uid()::text IN (storage.foldername(name))[1]) > 0
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- ---------- video calls ----------
CREATE TABLE public.video_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fan_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id text NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'accepted', 'active', 'ended', 'declined', 'cancelled', 'expired')),
  bread_paid integer NOT NULL DEFAULT 0,
  creator_cut integer NOT NULL DEFAULT 0,
  minutes_allowed integer NOT NULL DEFAULT 15,
  refunded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  accepted_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  ended_by uuid
);

CREATE INDEX idx_video_calls_creator ON public.video_calls (creator_id, status, created_at DESC);
CREATE INDEX idx_video_calls_fan ON public.video_calls (fan_id, status, created_at DESC);

GRANT SELECT ON public.video_calls TO authenticated;
GRANT ALL ON public.video_calls TO service_role;

ALTER TABLE public.video_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view own calls" ON public.video_calls FOR SELECT
USING (auth.uid() = creator_id OR auth.uid() = fan_id);

CREATE POLICY "Admins can view all calls" ON public.video_calls FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- All writes go through the RPCs below (SECURITY DEFINER).
ALTER TABLE public.video_calls REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_calls;

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION public.video_call_system_message(
  p_call public.video_calls, p_text text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, media_type, call_id, read)
  VALUES (
    p_call.conversation_id,
    COALESCE(auth.uid(), p_call.fan_id),
    CASE WHEN COALESCE(auth.uid(), p_call.fan_id) = p_call.fan_id THEN p_call.creator_id ELSE p_call.fan_id END,
    p_text, 'call', p_call.id, false
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.video_call_system_message(public.video_calls, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refund_video_call_internal(p_call_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.video_calls%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.video_calls WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND OR v.refunded OR v.bread_paid = 0 THEN RETURN; END IF;
  UPDATE public.wallets SET balance = balance + v.bread_paid, updated_at = now() WHERE user_id = v.fan_id;
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_id)
  VALUES (v.fan_id, v.bread_paid, 'refund', 'Video call refund', v.id::text);
  UPDATE public.video_calls SET refunded = true WHERE id = v.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refund_video_call_internal(uuid) FROM PUBLIC, anon, authenticated;

-- ---------- fan: request + pay ----------
CREATE OR REPLACE FUNCTION public.request_video_call(p_creator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fan uuid := auth.uid();
  v_profile record;
  v_balance integer;
  v_existing public.video_calls%ROWTYPE;
  v_call public.video_calls%ROWTYPE;
  v_conv text;
BEGIN
  IF v_fan IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_fan = p_creator_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot call yourself');
  END IF;

  SELECT is_creator, video_calls_enabled, video_call_price_bread, video_call_minutes, display_name
  INTO v_profile FROM public.profiles WHERE user_id = p_creator_id;
  IF NOT FOUND OR NOT v_profile.is_creator OR NOT v_profile.video_calls_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'This creator is not accepting video calls');
  END IF;

  v_conv := CASE WHEN v_fan::text < p_creator_id::text
    THEN v_fan::text || '_' || p_creator_id::text
    ELSE p_creator_id::text || '_' || v_fan::text END;

  -- Reuse an open request instead of double-charging
  SELECT * INTO v_existing FROM public.video_calls
  WHERE fan_id = v_fan AND creator_id = p_creator_id
    AND status IN ('requested', 'accepted', 'active')
    AND (status <> 'requested' OR expires_at > now())
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'call_id', v_existing.id, 'existing', true, 'status', v_existing.status);
  END IF;

  IF v_profile.video_call_price_bread > 0 THEN
    SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_fan FOR UPDATE;
    IF v_balance IS NULL OR v_balance < v_profile.video_call_price_bread THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient BREAD',
        'needed', v_profile.video_call_price_bread, 'balance', COALESCE(v_balance, 0));
    END IF;
    UPDATE public.wallets SET balance = balance - v_profile.video_call_price_bread, updated_at = now()
    WHERE user_id = v_fan;
  END IF;

  INSERT INTO public.video_calls (creator_id, fan_id, conversation_id, bread_paid, minutes_allowed)
  VALUES (p_creator_id, v_fan, v_conv, v_profile.video_call_price_bread, v_profile.video_call_minutes)
  RETURNING * INTO v_call;

  IF v_call.bread_paid > 0 THEN
    INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_id)
    VALUES (v_fan, -v_call.bread_paid, 'spend',
      'Video call with ' || COALESCE(v_profile.display_name, 'creator'), v_call.id::text);
  END IF;

  PERFORM public.video_call_system_message(v_call,
    '📞 Requested a ' || v_call.minutes_allowed || '-minute video call' ||
    CASE WHEN v_call.bread_paid > 0 THEN ' · ' || v_call.bread_paid || ' BREAD' ELSE '' END);

  RETURN jsonb_build_object('success', true, 'call_id', v_call.id, 'bread_paid', v_call.bread_paid);
END;
$$;

-- ---------- creator: accept / decline ----------
CREATE OR REPLACE FUNCTION public.respond_video_call(p_call_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.video_calls%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.video_calls WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Call not found'); END IF;
  IF auth.uid() IS DISTINCT FROM v.creator_id AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the creator can respond');
  END IF;
  IF v.status <> 'requested' THEN
    RETURN jsonb_build_object('success', true, 'status', v.status, 'already', true);
  END IF;

  IF v.expires_at < now() THEN
    UPDATE public.video_calls SET status = 'expired' WHERE id = v.id;
    PERFORM public.refund_video_call_internal(v.id);
    RETURN jsonb_build_object('success', false, 'error', 'This request expired', 'status', 'expired');
  END IF;

  IF p_accept THEN
    UPDATE public.video_calls SET status = 'accepted', accepted_at = now() WHERE id = v.id RETURNING * INTO v;
    PERFORM public.video_call_system_message(v, '📞 Call accepted — join now');
  ELSE
    UPDATE public.video_calls SET status = 'declined', ended_at = now(), ended_by = auth.uid() WHERE id = v.id RETURNING * INTO v;
    PERFORM public.refund_video_call_internal(v.id);
    PERFORM public.video_call_system_message(v,
      '📞 Call declined' || CASE WHEN v.bread_paid > 0 THEN ' · ' || v.bread_paid || ' BREAD refunded' ELSE '' END);
  END IF;
  RETURN jsonb_build_object('success', true, 'status', v.status);
END;
$$;

-- ---------- fan: cancel a pending request ----------
CREATE OR REPLACE FUNCTION public.cancel_video_call(p_call_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.video_calls%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.video_calls WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Call not found'); END IF;
  IF auth.uid() IS DISTINCT FROM v.fan_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the requester can cancel');
  END IF;
  IF v.status <> 'requested' THEN
    RETURN jsonb_build_object('success', true, 'status', v.status, 'already', true);
  END IF;
  UPDATE public.video_calls SET status = 'cancelled', ended_at = now(), ended_by = auth.uid() WHERE id = v.id RETURNING * INTO v;
  PERFORM public.refund_video_call_internal(v.id);
  PERFORM public.video_call_system_message(v,
    '📞 Call request cancelled' || CASE WHEN v.bread_paid > 0 THEN ' · ' || v.bread_paid || ' BREAD refunded' ELSE '' END);
  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

-- ---------- either side: mark connected ----------
CREATE OR REPLACE FUNCTION public.start_video_call(p_call_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.video_calls%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.video_calls WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Call not found'); END IF;
  IF auth.uid() NOT IN (v.fan_id, v.creator_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a participant');
  END IF;
  IF v.status = 'accepted' THEN
    UPDATE public.video_calls SET status = 'active', started_at = now() WHERE id = v.id RETURNING * INTO v;
  END IF;
  RETURN jsonb_build_object('success', v.status = 'active', 'status', v.status, 'started_at', v.started_at);
END;
$$;

-- ---------- either side: hang up (pays the creator if the call connected) ----------
CREATE OR REPLACE FUNCTION public.end_video_call(p_call_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.video_calls%ROWTYPE;
  v_secs integer;
  v_cut integer;
BEGIN
  SELECT * INTO v FROM public.video_calls WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Call not found'); END IF;
  IF auth.uid() NOT IN (v.fan_id, v.creator_id) AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a participant');
  END IF;

  IF v.status = 'requested' THEN
    IF auth.uid() = v.fan_id THEN RETURN public.cancel_video_call(p_call_id);
    ELSE RETURN public.respond_video_call(p_call_id, false); END IF;
  END IF;

  IF v.status = 'accepted' THEN
    -- accepted but never connected: no charge
    UPDATE public.video_calls SET status = 'ended', ended_at = now(), ended_by = auth.uid() WHERE id = v.id RETURNING * INTO v;
    PERFORM public.refund_video_call_internal(v.id);
    PERFORM public.video_call_system_message(v,
      '📞 Call ended before connecting' || CASE WHEN v.bread_paid > 0 THEN ' · ' || v.bread_paid || ' BREAD refunded' ELSE '' END);
    RETURN jsonb_build_object('success', true, 'status', 'ended', 'refunded', true);
  END IF;

  IF v.status = 'active' THEN
    v_cut := FLOOR(v.bread_paid * 0.8);
    UPDATE public.video_calls
    SET status = 'ended', ended_at = now(), ended_by = auth.uid(), creator_cut = v_cut
    WHERE id = v.id RETURNING * INTO v;

    IF v_cut > 0 THEN
      INSERT INTO public.credit_wallets (user_id, balance)
      VALUES (v.creator_id, v_cut)
      ON CONFLICT (user_id) DO UPDATE SET balance = credit_wallets.balance + v_cut, updated_at = now();
      INSERT INTO public.credit_transactions (user_id, amount, type, description, reference_id)
      VALUES (v.creator_id, v_cut, 'earning', 'Video call', v.id::text);
    END IF;

    v_secs := GREATEST(0, EXTRACT(EPOCH FROM (v.ended_at - v.started_at))::integer);
    PERFORM public.video_call_system_message(v,
      '📞 Video call · ' || (v_secs / 60) || ':' || LPAD((v_secs % 60)::text, 2, '0'));
    RETURN jsonb_build_object('success', true, 'status', 'ended', 'duration_seconds', v_secs, 'creator_cut', v_cut);
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v.status, 'already', true);
END;
$$;

-- ---------- housekeeping: refund the caller's expired requests ----------
CREATE OR REPLACE FUNCTION public.expire_stale_video_calls()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  FOR r IN
    SELECT id FROM public.video_calls
    WHERE status = 'requested' AND expires_at < now()
      AND (fan_id = auth.uid() OR creator_id = auth.uid())
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.video_calls SET status = 'expired', ended_at = now() WHERE id = r.id;
    PERFORM public.refund_video_call_internal(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_video_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_video_call(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_video_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_video_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_video_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_video_calls() TO authenticated;
