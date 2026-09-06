-- Demo video now streams from our own R2 bucket (copied from Vercel Blob).
UPDATE public.vr_video_sources SET blob_url = 'r2:8f3c2a10-5e1b-4d7a-9c21-0d0a1f5b2e01:hls'
WHERE video_id = '8f3c2a10-5e1b-4d7a-9c21-0d0a1f5b2e01';

-- Hidden row used to exercise the transcoder end to end (unpublished; never shown to fans).
INSERT INTO public.vr_videos (id, creator_id, title, description, video_path, thumbnail_url, price_bread, is_published, format, status, progress)
VALUES ('0f0f0f0f-1111-4222-8333-444444444444', '45171c62-87ce-4b74-88ba-d9a824b59689', 'Pipeline test clip', 'internal', NULL, NULL, 0, false, 'STEREO_180_LR', 'processing', 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.vr_video_sources (video_id, blob_url)
VALUES ('0f0f0f0f-1111-4222-8333-444444444444', 'r2:0f0f0f0f-1111-4222-8333-444444444444:source')
ON CONFLICT (video_id) DO NOTHING;
