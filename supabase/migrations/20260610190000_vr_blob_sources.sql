-- Move VR video files to Vercel Blob. The playable URL lives in a SEPARATE,
-- locked-down table (vr_video_sources) that fans can NEVER select directly —
-- the only way to read it is the get_vr_video_url() function below, which
-- enforces the paywall. vr_videos keeps only safe public metadata.

-- Blob videos don't use Supabase storage paths anymore.
ALTER TABLE public.vr_videos ALTER COLUMN video_path DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.vr_video_sources (
  video_id UUID PRIMARY KEY REFERENCES public.vr_videos(id) ON DELETE CASCADE,
  blob_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vr_video_sources ENABLE ROW LEVEL SECURITY;

-- Only the creator (and admins) can read/manage the raw URL directly. No anon,
-- no other authenticated user. Fans get it solely through the RPC.
CREATE POLICY "Creator can read own VR source"
ON public.vr_video_sources FOR SELECT
USING (EXISTS (SELECT 1 FROM public.vr_videos v WHERE v.id = video_id AND v.creator_id = auth.uid()));

CREATE POLICY "Admins can read all VR sources"
ON public.vr_video_sources FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creator can insert own VR source"
ON public.vr_video_sources FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.vr_videos v WHERE v.id = video_id AND v.creator_id = auth.uid()));

CREATE POLICY "Creator can update own VR source"
ON public.vr_video_sources FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.vr_videos v WHERE v.id = video_id AND v.creator_id = auth.uid()));

CREATE POLICY "Creator can delete own VR source"
ON public.vr_video_sources FOR DELETE
USING (EXISTS (SELECT 1 FROM public.vr_videos v WHERE v.id = video_id AND v.creator_id = auth.uid()));

CREATE POLICY "Admins manage all VR sources"
ON public.vr_video_sources FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- The paywall gate: returns the Blob URL only to the creator, admins, for free
-- videos, or to fans who have an unlock receipt. Returns NULL otherwise.
CREATE OR REPLACE FUNCTION public.get_vr_video_url(p_video_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_video public.vr_videos%ROWTYPE;
  v_url TEXT;
BEGIN
  SELECT * INTO v_video FROM public.vr_videos WHERE id = p_video_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Must be published unless the caller owns it or is admin
  IF NOT v_video.is_published
     AND v_video.creator_id <> auth.uid()
     AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NULL;
  END IF;

  IF v_video.creator_id = auth.uid()
     OR has_role(auth.uid(), 'admin'::app_role)
     OR v_video.price_bread = 0
     OR EXISTS (SELECT 1 FROM public.vr_video_unlocks u
                WHERE u.video_id = p_video_id AND u.fan_user_id = auth.uid()) THEN
    SELECT blob_url INTO v_url FROM public.vr_video_sources WHERE video_id = p_video_id;
    RETURN v_url;
  END IF;

  RETURN NULL;  -- locked
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vr_video_url(UUID) TO authenticated, anon;
