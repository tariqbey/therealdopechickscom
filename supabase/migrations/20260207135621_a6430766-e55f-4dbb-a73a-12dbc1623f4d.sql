
-- Add cover_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url text;

-- Create covers storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on covers
CREATE POLICY "Cover images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'covers');

-- Users can upload their own cover
CREATE POLICY "Users can upload own cover"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own cover
CREATE POLICY "Users can update own cover"
ON storage.objects FOR UPDATE
USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own cover
CREATE POLICY "Users can delete own cover"
ON storage.objects FOR DELETE
USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
