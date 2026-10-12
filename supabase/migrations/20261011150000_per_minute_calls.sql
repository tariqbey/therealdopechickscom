-- Pay-per-minute video calls (Scrile parity). Creators choose flat "per call" or
-- "per minute". Per-minute: the fan picks a length, pays price × minutes up front
-- (escrow), the creator is paid only for minutes actually used, the rest is refunded.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS video_call_billing text NOT NULL DEFAULT 'per_call' CHECK (video_call_billing IN ('per_call','per_minute')),
  ADD COLUMN IF NOT EXISTS video_call_min_minutes integer NOT NULL DEFAULT 5 CHECK (video_call_min_minutes BETWEEN 1 AND 180),
  ADD COLUMN IF NOT EXISTS video_call_max_minutes integer NOT NULL DEFAULT 60 CHECK (video_call_max_minutes BETWEEN 1 AND 180);

ALTER TABLE public.video_calls
  ADD COLUMN IF NOT EXISTS billing text NOT NULL DEFAULT 'per_call' CHECK (billing IN ('per_call','per_minute')),
  ADD COLUMN IF NOT EXISTS price_per_minute integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billed_minutes integer,
  ADD COLUMN IF NOT EXISTS refunded_credits integer NOT NULL DEFAULT 0;

-- ---------- fan: request + pay (now takes an optional length for per-minute creators) ----------
DROP FUNCTION IF EXISTS public.request_video_call(uuid);
CREATE OR REPLACE FUNCTION public.request_video_call(p_creator_id uuid, p_minutes integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fan uuid := auth.uid();
  v_profile record;
  v_balance integer;
  v_existing public.video_calls%ROWTYPE;
  v_call public.video_calls%ROWTYPE;
  v_conv text;
  v_minutes integer;
  v_price integer;
  v_billing text;
BEGIN
  IF v_fan IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF v_fan = p_creator_id THEN RETURN jsonb_build_object('success', false, 'error', 'You cannot call yourself'); END IF;

  SELECT is_creator, video_calls_enabled, video_call_price_bread, video_call_minutes, display_name,
         video_call_billing, video_call_min_minutes, video_call_max_minutes
  INTO v_profile FROM public.profiles WHERE user_id = p_creator_id;
  IF NOT FOUND OR NOT v_profile.is_creator OR NOT v_profile.video_calls_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'This creator is not accepting video calls');
  END IF;

  v_billing := COALESCE(v_profile.video_call_billing, 'per_call');
  IF v_billing = 'per_minute' THEN
    v_minutes := COALESCE(p_minutes, v_profile.video_call_min_minutes);
    IF v_minutes < v_profile.video_call_min_minutes OR v_minutes > v_profile.video_call_max_minutes THEN
      RETURN jsonb_build_object('success', false, 'error', 'Choose between ' || v_profile.video_call_min_minutes || ' and ' || v_profile.video_call_max_minutes || ' minutes');
    END IF;
    v_price := v_profile.video_call_price_bread * v_minutes;
  ELSE
    v_minutes := v_profile.video_call_minutes;
    v_price := v_profile.video_call_price_bread;
  END IF;

  v_conv := CASE WHEN v_fan::text < p_creator_id::text THEN v_fan::text || '_' || p_creator_id::text ELSE p_creator_id::text || '_' || v_fan::text END;

  SELECT * INTO v_existing FROM public.video_calls
  WHERE fan_id = v_fan AND creator_id = p_creator_id AND status IN ('requested','accepted','active')
    AND (status <> 'requested' OR expires_at > now()) ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'call_id', v_existing.id, 'existing', true, 'status', v_existing.status);
  END IF;

  IF v_price > 0 THEN
    SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_fan FOR UPDATE;
    IF v_balance IS NULL OR v_balance < v_price THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient BREAD', 'needed', v_price, 'balance', COALESCE(v_balance, 0));
    END IF;
    UPDATE public.wallets SET balance = balance - v_price, updated_at = now() WHERE user_id = v_fan;
  END IF;

  INSERT INTO public.video_calls (creator_id, fan_id, conversation_id, bread_paid, minutes_allowed, billing, price_per_minute)
  VALUES (p_creator_id, v_fan, v_conv, v_price, v_minutes, v_billing, CASE WHEN v_billing = 'per_minute' THEN v_profile.video_call_price_bread ELSE 0 END)
  RETURNING * INTO v_call;

  IF v_call.bread_paid > 0 THEN
    INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_id)
    VALUES (v_fan, -v_call.bread_paid, 'spend', 'Video call with ' || COALESCE(v_profile.display_name, 'creator'), v_call.id::text);
  END IF;

  PERFORM public.video_call_system_message(v_call,
    '📞 Requested a ' || v_call.minutes_allowed || '-minute video call' ||
    CASE WHEN v_call.bread_paid > 0 THEN ' · ' || v_call.bread_paid || ' BREAD' || CASE WHEN v_billing = 'per_minute' THEN ' (' || v_call.price_per_minute || '/min)' ELSE '' END ELSE '' END);

  RETURN jsonb_build_object('success', true, 'call_id', v_call.id, 'bread_paid', v_call.bread_paid, 'minutes', v_call.minutes_allowed);
END; $$;
GRANT EXECUTE ON FUNCTION public.request_video_call(uuid, integer) TO authenticated;

-- ---------- hang up: per-minute calls pay for used minutes only ----------
CREATE OR REPLACE FUNCTION public.end_video_call(p_call_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.video_calls%ROWTYPE;
  v_secs integer;
  v_used integer;
  v_charge integer;
  v_refund integer := 0;
  v_cut integer;
  v_share numeric := public.setting_num('payouts','creator_share_pct',80);
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
    UPDATE public.video_calls SET status = 'ended', ended_at = now(), ended_by = auth.uid() WHERE id = v.id RETURNING * INTO v;
    PERFORM public.refund_video_call_internal(v.id);
    PERFORM public.video_call_system_message(v, '📞 Call ended before connecting' || CASE WHEN v.bread_paid > 0 THEN ' · ' || v.bread_paid || ' BREAD refunded' ELSE '' END);
    RETURN jsonb_build_object('success', true, 'status', 'ended', 'refunded', true);
  END IF;
  IF v.status = 'active' THEN
    v_secs := GREATEST(0, EXTRACT(EPOCH FROM (now() - v.started_at))::integer);
    IF v.billing = 'per_minute' THEN
      v_used := LEAST(v.minutes_allowed, GREATEST(1, CEIL(v_secs / 60.0)::integer));
      v_charge := v_used * v.price_per_minute;
      v_refund := GREATEST(0, v.bread_paid - v_charge);
    ELSE
      v_used := v.minutes_allowed;
      v_charge := v.bread_paid;
    END IF;
    v_cut := FLOOR(v_charge * v_share / 100);
    UPDATE public.video_calls
    SET status = 'ended', ended_at = now(), ended_by = auth.uid(), creator_cut = v_cut, billed_minutes = v_used, refunded_credits = v_refund
    WHERE id = v.id RETURNING * INTO v;
    IF v_cut > 0 THEN
      INSERT INTO public.credit_wallets (user_id, balance) VALUES (v.creator_id, v_cut)
      ON CONFLICT (user_id) DO UPDATE SET balance = credit_wallets.balance + v_cut, updated_at = now();
      INSERT INTO public.credit_transactions (user_id, amount, type, description, reference_id)
      VALUES (v.creator_id, v_cut, 'earning', 'Video call' || CASE WHEN v.billing = 'per_minute' THEN ' · ' || v_used || ' min' ELSE '' END, v.id::text);
    END IF;
    IF v_refund > 0 THEN
      UPDATE public.wallets SET balance = balance + v_refund, updated_at = now() WHERE user_id = v.fan_id;
      INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_id)
      VALUES (v.fan_id, v_refund, 'refund', 'Unused call minutes refunded', v.id::text);
    END IF;
    PERFORM public.video_call_system_message(v,
      '📞 Video call · ' || (v_secs / 60) || ':' || LPAD((v_secs % 60)::text, 2, '0') ||
      CASE WHEN v.billing = 'per_minute' THEN ' · ' || v_charge || ' BREAD for ' || v_used || ' min' || CASE WHEN v_refund > 0 THEN ' · ' || v_refund || ' refunded' ELSE '' END ELSE '' END);
    RETURN jsonb_build_object('success', true, 'status', 'ended', 'duration_seconds', v_secs, 'creator_cut', v_cut, 'billed_minutes', v_used, 'refunded', v_refund);
  END IF;
  RETURN jsonb_build_object('success', true, 'status', v.status, 'already', true);
END; $$;
