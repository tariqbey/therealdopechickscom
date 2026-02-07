-- Create storage bucket for AI studio uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-studio', 'ai-studio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to ai-studio bucket
CREATE POLICY "Authenticated users can upload to ai-studio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ai-studio' AND auth.uid() IS NOT NULL);

-- Allow public read access
CREATE POLICY "Public read access for ai-studio"
ON storage.objects FOR SELECT
USING (bucket_id = 'ai-studio');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own ai-studio uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'ai-studio' AND auth.uid()::text = (storage.foldername(name))[1]);