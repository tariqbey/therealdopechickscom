-- Swap the free VR sample to "DOPE CHICKS DEMO 1" (3 min, 4096x2048 VR180 3D SBS),
-- served as adaptive HLS (4K + 1440p) from Vercel Blob.
UPDATE public.vr_videos
SET title = 'Dope Chicks VR Demo',
    description = 'Free VR180 3D demo. Drag to look around, use Cardboard on your phone, or put on a headset and hit Enter VR.',
    thumbnail_url = '/vr-samples/demo1-thumb.jpg',
    format = 'STEREO_180_LR', width = 4096, height = 2048, duration_seconds = 186,
    price_bread = 0, is_published = true
WHERE id = '8f3c2a10-5e1b-4d7a-9c21-0d0a1f5b2e01';

UPDATE public.vr_video_sources
SET blob_url = 'https://vvsfw1qbut7osqhn.public.blob.vercel-storage.com/vr-samples/demo1/master.m3u8'
WHERE video_id = '8f3c2a10-5e1b-4d7a-9c21-0d0a1f5b2e01';
