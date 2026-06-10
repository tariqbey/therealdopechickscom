-- VR180 videos: creators upload immersive videos with per-video BREAD pricing.

CREATE TABLE public.vr_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_path TEXT NOT NULL,
  thumbnail_url TEXT,
  price_bread INTEGER NOT NULL DEFAULT 0 CHECK (price_bread >= 0),
  is_published BOOLEAN NOT NULL DEFAULT true,
  unlocks_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vr_videos TO authenticated;
GRANT ALL ON public.vr_videos TO service_role;

ALTER TABLE public.vr_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published VR videos are viewable by everyone"
ON public.vr_videos FOR SELECT
USING (is_published = true OR auth.uid() = creator_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators can insert own VR videos"
ON public.vr_videos FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own VR videos"
ON public.vr_videos FOR UPDATE
USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete own VR videos"
ON public.vr_videos FOR DELETE
USING (auth.uid() = creator_id);

CREATE POLICY "Admins can manage all VR videos"
ON public.vr_videos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_vr_videos_updated_at
BEFORE UPDATE ON public.vr_videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-fan unlock records (pay-per-view receipts)
CREATE TABLE public.vr_video_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.vr_videos(id) ON DELETE CASCADE,
  fan_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bread_paid INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(video_id, fan_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vr_video_unlocks TO authenticated;
GRANT ALL ON public.vr_video_unlocks TO service_role;

ALTER TABLE public.vr_video_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fans can view own VR unlocks"
ON public.vr_video_unlocks FOR SELECT
USING (auth.uid() = fan_user_id);

CREATE POLICY "Creators can view unlocks of own VR videos"
ON public.vr_video_unlocks FOR SELECT
USING (EXISTS (SELECT 1 FROM public.vr_videos v WHERE v.id = video_id AND v.creator_id = auth.uid()));

CREATE POLICY "Admins can view all VR unlocks"
ON public.vr_video_unlocks FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Atomic unlock: deduct BREAD from the fan, credit the creator (80/20 split),
-- write both transaction audit rows, and record the unlock.
CREATE OR REPLACE FUNCTION public.unlock_vr_video(p_video_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_video public.vr_videos%ROWTYPE;
  v_balance INTEGER;
  v_creator_cut INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_video FROM public.vr_videos WHERE id = p_video_id AND is_published = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Video not found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.vr_video_unlocks WHERE video_id = p_video_id AND fan_user_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', true, 'already_unlocked', true);
  END IF;

  IF v_video.creator_id = auth.uid() OR v_video.price_bread = 0 THEN
    INSERT INTO public.vr_video_unlocks (video_id, fan_user_id, bread_paid)
    VALUES (p_video_id, auth.uid(), 0);
    RETURN jsonb_build_object('success', true, 'bread_paid', 0);
  END IF;

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_video.price_bread THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient BREAD',
      'needed', v_video.price_bread, 'balance', COALESCE(v_balance, 0));
  END IF;

  UPDATE public.wallets SET balance = balance - v_video.price_bread, updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_id)
  VALUES (auth.uid(), -v_video.price_bread, 'spend', 'Unlocked VR video: ' || v_video.title, p_video_id::text);

  v_creator_cut := FLOOR(v_video.price_bread * 0.8);

  INSERT INTO public.credit_wallets (user_id, balance)
  VALUES (v_video.creator_id, v_creator_cut)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_wallets.balance + v_creator_cut, updated_at = now();

  INSERT INTO public.credit_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_video.creator_id, v_creator_cut, 'earning', 'VR video unlock: ' || v_video.title, p_video_id::text);

  INSERT INTO public.vr_video_unlocks (video_id, fan_user_id, bread_paid)
  VALUES (p_video_id, auth.uid(), v_video.price_bread);

  UPDATE public.vr_videos SET unlocks_count = unlocks_count + 1 WHERE id = p_video_id;

  RETURN jsonb_build_object('success', true, 'bread_paid', v_video.price_bread);
END;
$$;