-- The transcoder (Vercel functions) updates job/video state through these
-- SECURITY DEFINER functions instead of holding the service-role key. Each call
-- must present the pipeline secret, which lives only in vr_pipeline_config (no
-- policies → unreadable by anon/authenticated) and is set once via
-- vr_pipeline_set_secret() right after this migration.

CREATE TABLE IF NOT EXISTS public.vr_pipeline_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vr_pipeline_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vr_pipeline_config FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.vr_pipeline_set_secret(p_new text, p_old text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur text;
BEGIN
  IF p_new IS NULL OR length(p_new) < 32 THEN RETURN false; END IF;
  SELECT secret INTO cur FROM public.vr_pipeline_config WHERE id = 1;
  IF cur IS NOT NULL THEN
    IF p_old IS NULL OR p_old <> cur THEN RETURN false; END IF;
    UPDATE public.vr_pipeline_config SET secret = p_new, updated_at = now() WHERE id = 1;
  ELSE
    INSERT INTO public.vr_pipeline_config (id, secret) VALUES (1, p_new);
  END IF;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.vr_pipeline_check(p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_secret IS NULL OR NOT EXISTS (SELECT 1 FROM public.vr_pipeline_config WHERE id = 1 AND secret = p_secret) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.vr_pipeline_check(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.vr_pipeline_video_get(p_secret text, p_video_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.vr_videos%ROWTYPE;
BEGIN
  PERFORM public.vr_pipeline_check(p_secret);
  SELECT * INTO v FROM public.vr_videos WHERE id = p_video_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', v.id, 'creator_id', v.creator_id, 'format', v.format, 'thumbnail_url', v.thumbnail_url, 'status', v.status);
END; $$;

CREATE OR REPLACE FUNCTION public.vr_pipeline_video_update(p_secret text, p_video_id uuid, p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.vr_pipeline_check(p_secret);
  UPDATE public.vr_videos SET
    status = COALESCE(p_patch->>'status', status),
    progress = COALESCE((p_patch->>'progress')::integer, progress),
    transcode_error = CASE WHEN p_patch ? 'transcode_error' THEN p_patch->>'transcode_error' ELSE transcode_error END,
    width = COALESCE((p_patch->>'width')::integer, width),
    height = COALESCE((p_patch->>'height')::integer, height),
    duration_seconds = COALESCE((p_patch->>'duration_seconds')::integer, duration_seconds),
    thumbnail_url = COALESCE(p_patch->>'thumbnail_url', thumbnail_url)
  WHERE id = p_video_id;
END; $$;

CREATE OR REPLACE FUNCTION public.vr_pipeline_set_source(p_secret text, p_video_id uuid, p_source text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.vr_pipeline_check(p_secret);
  INSERT INTO public.vr_video_sources (video_id, blob_url) VALUES (p_video_id, p_source)
  ON CONFLICT (video_id) DO UPDATE SET blob_url = EXCLUDED.blob_url;
END; $$;

CREATE OR REPLACE FUNCTION public.vr_pipeline_job_start(p_secret text, p_video_id uuid, p_plan jsonb, p_total integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.vr_pipeline_check(p_secret);
  INSERT INTO public.vr_transcode_jobs (video_id, plan, total_jobs, done_jobs, status, error, started_at, finished_at)
  VALUES (p_video_id, p_plan, p_total, 0, 'running', NULL, now(), NULL)
  ON CONFLICT (video_id) DO UPDATE SET plan = EXCLUDED.plan, total_jobs = EXCLUDED.total_jobs, done_jobs = 0,
    status = 'running', error = NULL, started_at = now(), finished_at = NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.vr_pipeline_job_get(p_secret text, p_video_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.vr_transcode_jobs%ROWTYPE;
BEGIN
  PERFORM public.vr_pipeline_check(p_secret);
  SELECT * INTO j FROM public.vr_transcode_jobs WHERE video_id = p_video_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('plan', j.plan, 'total_jobs', j.total_jobs, 'done_jobs', j.done_jobs, 'status', j.status);
END; $$;

CREATE OR REPLACE FUNCTION public.vr_pipeline_job_done(p_secret text, p_video_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d integer; t integer;
BEGIN
  PERFORM public.vr_pipeline_check(p_secret);
  UPDATE public.vr_transcode_jobs SET done_jobs = done_jobs + 1
  WHERE video_id = p_video_id RETURNING done_jobs, total_jobs INTO d, t;
  RETURN jsonb_build_object('done_jobs', d, 'total_jobs', t);
END; $$;

CREATE OR REPLACE FUNCTION public.vr_pipeline_job_status(p_secret text, p_video_id uuid, p_status text, p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.vr_pipeline_check(p_secret);
  UPDATE public.vr_transcode_jobs SET status = p_status, error = p_error,
    finished_at = CASE WHEN p_status IN ('done', 'failed') THEN now() ELSE finished_at END
  WHERE video_id = p_video_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.vr_pipeline_set_secret(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vr_pipeline_video_get(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vr_pipeline_video_update(text, uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vr_pipeline_set_source(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vr_pipeline_job_start(text, uuid, jsonb, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vr_pipeline_job_get(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vr_pipeline_job_done(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vr_pipeline_job_status(text, uuid, text, text) TO anon, authenticated;

-- superseded by vr_pipeline_job_done
DROP FUNCTION IF EXISTS public.vr_job_done(uuid);
