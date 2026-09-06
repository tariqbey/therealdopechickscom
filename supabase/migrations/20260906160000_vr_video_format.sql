-- Projection / stereo layout of each VR video so the player can render 180° and
-- 360°, mono and stereo (side-by-side or top-bottom), and flat "cinema" video.
ALTER TABLE public.vr_videos
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'STEREO_180_LR'
  CHECK (format IN ('MONO_180', 'STEREO_180_LR', 'STEREO_180_TB', 'MONO_360', 'STEREO_360_LR', 'STEREO_360_TB', 'FLAT'));

-- Explicit width/height help the player pick sensible defaults and the UI show a badge.
ALTER TABLE public.vr_videos
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

UPDATE public.vr_videos SET width = 4096, height = 2048, duration_seconds = 12
WHERE id = '8f3c2a10-5e1b-4d7a-9c21-0d0a1f5b2e01';
