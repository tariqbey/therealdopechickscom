-- Seed: free VR180 sample ("Lisa") under creator tbey2026 so the VR player has
-- something to play. Source is a public Vercel Blob MP4 (4096x2048 side-by-side).
INSERT INTO public.vr_videos (id, creator_id, title, description, video_path, thumbnail_url, price_bread, is_published)
VALUES (
  '8f3c2a10-5e1b-4d7a-9c21-0d0a1f5b2e01',
  '45171c62-87ce-4b74-88ba-d9a824b59689',
  'Dope Chicks VR180 Sample',
  'Free VR180 demo. Drag to look around, or put on a headset and hit Enter VR.',
  NULL,
  '/vr-samples/lisa-vr180-thumb.jpg',
  0,
  true
)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
  thumbnail_url = EXCLUDED.thumbnail_url, price_bread = EXCLUDED.price_bread, is_published = true;

INSERT INTO public.vr_video_sources (video_id, blob_url)
VALUES ('8f3c2a10-5e1b-4d7a-9c21-0d0a1f5b2e01', 'https://vvsfw1qbut7osqhn.public.blob.vercel-storage.com/vr-samples/lisa-vr180-4k-Pe288Bhnx7phzGaEqfzDFTmSyyERw4.mp4')
ON CONFLICT (video_id) DO UPDATE SET blob_url = EXCLUDED.blob_url;
