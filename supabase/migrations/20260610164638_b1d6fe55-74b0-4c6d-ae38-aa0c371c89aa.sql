-- VR thumbnails: readable by any authenticated user (no paywall on thumbs)
CREATE POLICY "VR thumbnails readable by authenticated users"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'vr-thumbnails');

CREATE POLICY "Creators can upload own VR thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vr-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Creators can delete own VR thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vr-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Creators can upload own VR videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vr-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Creators can delete own VR video files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vr-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Paywall: a fan can only read (and sign a URL for) a VR video object if
-- they own it, are admin, it's free, or they've unlocked it.
CREATE POLICY "VR videos readable by owner, admin, free, or unlocked"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vr-videos' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.vr_videos v
      WHERE v.video_path = name AND v.is_published = true AND v.price_bread = 0
    )
    OR EXISTS (
      SELECT 1 FROM public.vr_videos v
      JOIN public.vr_video_unlocks u ON u.video_id = v.id
      WHERE v.video_path = name AND u.fan_user_id = auth.uid()
    )
  )
);