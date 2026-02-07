
-- Create creator_posts table for content uploads
CREATE TABLE public.creator_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL,
  title text,
  description text,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'photo', -- 'photo' or 'video'
  is_locked boolean NOT NULL DEFAULT true,
  min_tier text DEFAULT 'Bronze',
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view unlocked posts
CREATE POLICY "Anyone can view unlocked posts"
ON public.creator_posts FOR SELECT
USING (is_locked = false);

-- Creators can view all own posts
CREATE POLICY "Creators can view own posts"
ON public.creator_posts FOR SELECT
USING (auth.uid() = creator_id);

-- Creators can insert own posts
CREATE POLICY "Creators can insert own posts"
ON public.creator_posts FOR INSERT
WITH CHECK (auth.uid() = creator_id);

-- Creators can update own posts
CREATE POLICY "Creators can update own posts"
ON public.creator_posts FOR UPDATE
USING (auth.uid() = creator_id);

-- Creators can delete own posts
CREATE POLICY "Creators can delete own posts"
ON public.creator_posts FOR DELETE
USING (auth.uid() = creator_id);

-- Admins can manage all posts
CREATE POLICY "Admins can manage all posts"
ON public.creator_posts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Subscribers can view locked posts (check via creator_subscriptions)
CREATE POLICY "Subscribers can view locked posts"
ON public.creator_posts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.creator_subscriptions cs
    WHERE cs.creator_id = creator_posts.creator_id
    AND cs.fan_user_id = auth.uid()
    AND cs.status = 'active'
  )
);

-- Create storage bucket for creator content
INSERT INTO storage.buckets (id, name, public)
VALUES ('creator-content', 'creator-content', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for creator content
CREATE POLICY "Creator content is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'creator-content');

CREATE POLICY "Creators can upload own content"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'creator-content' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Creators can update own content"
ON storage.objects FOR UPDATE
USING (bucket_id = 'creator-content' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Creators can delete own content"
ON storage.objects FOR DELETE
USING (bucket_id = 'creator-content' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updated_at
CREATE TRIGGER update_creator_posts_updated_at
BEFORE UPDATE ON public.creator_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create platform_settings table for admin toggles
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Anyone can read settings"
ON public.platform_settings FOR SELECT
USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can manage settings"
ON public.platform_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default setting for dummy content
INSERT INTO public.platform_settings (key, value)
VALUES ('show_dummy_content', '{"enabled": true}'::jsonb);
