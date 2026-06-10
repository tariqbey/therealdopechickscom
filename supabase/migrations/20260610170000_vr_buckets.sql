-- VR storage buckets. The vr_videos tables, RLS, storage policies, and
-- unlock_vr_video() were already applied (migrations 20260610164545 and
-- 20260610164638) — this creates the buckets those policies refer to.
-- vr-videos is PRIVATE: playback requires a signed URL, which storage RLS
-- only grants to the creator, admins, free videos, or fans who unlocked.

INSERT INTO storage.buckets (id, name, public)
VALUES ('vr-videos', 'vr-videos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('vr-thumbnails', 'vr-thumbnails', true)
ON CONFLICT (id) DO NOTHING;
