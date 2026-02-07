
-- Add approval fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS id_photo_url text;

-- Update default for NEW users to 'pending' via trigger
-- Existing users are grandfathered as 'approved'

-- Create id-documents storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('id-documents', 'id-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Only admins can view ID documents
CREATE POLICY "Admins can view id documents" ON storage.objects FOR SELECT
USING (bucket_id = 'id-documents' AND public.has_role(auth.uid(), 'admin'));

-- Users can upload their own ID document
CREATE POLICY "Users can upload own id document" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'id-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  is_ai_reply boolean NOT NULL DEFAULT false,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON public.messages (conversation_id, created_at);
CREATE INDEX idx_messages_receiver ON public.messages (receiver_id, read);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON public.messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark messages as read" ON public.messages FOR UPDATE
USING (auth.uid() = receiver_id);

CREATE POLICY "Admins can view all messages" ON public.messages FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
