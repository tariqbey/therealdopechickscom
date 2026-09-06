-- Own VR media pipeline: Cloudflare R2 storage behind our Worker, ffmpeg on Vercel.
-- Tracks per-video transcode status and the fan-out job counter.

ALTER TABLE public.vr_videos
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading', 'processing', 'ready')),
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS transcode_error text;

CREATE TABLE IF NOT EXISTS public.vr_transcode_jobs (
  video_id uuid PRIMARY KEY REFERENCES public.vr_videos(id) ON DELETE CASCADE,
  plan jsonb NOT NULL,
  total_jobs integer NOT NULL,
  done_jobs integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
ALTER TABLE public.vr_transcode_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.vr_transcode_jobs TO authenticated;
GRANT ALL ON public.vr_transcode_jobs TO service_role;
CREATE POLICY "Creators see own transcode jobs" ON public.vr_transcode_jobs FOR SELECT
USING (EXISTS (SELECT 1 FROM public.vr_videos v WHERE v.id = video_id AND v.creator_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Atomic "one more job finished" counter used by the chunk workers.
CREATE OR REPLACE FUNCTION public.vr_job_done(p_video_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d integer; t integer;
BEGIN
  UPDATE public.vr_transcode_jobs SET done_jobs = done_jobs + 1
  WHERE video_id = p_video_id RETURNING done_jobs, total_jobs INTO d, t;
  RETURN jsonb_build_object('done_jobs', d, 'total_jobs', t);
END; $$;
REVOKE EXECUTE ON FUNCTION public.vr_job_done(uuid) FROM PUBLIC, anon, authenticated;

-- Creators need live status/progress in the Manage tab.
ALTER TABLE public.vr_videos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vr_videos;

-- Creators may create the video row with their own id (upload flow pre-assigns it).
-- (INSERT policy already allows auth.uid() = creator_id; nothing else needed.)
