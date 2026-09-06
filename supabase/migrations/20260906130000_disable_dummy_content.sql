-- Homepage: stop showing demo creators (Jasmine Luxe etc.) and feature the real ones.
-- show_dummy_content=false makes FeaturedCreators fall back to real creator profiles.
UPDATE public.platform_settings
SET value = '{"enabled": false}'::jsonb, updated_at = now()
WHERE key = 'show_dummy_content';

-- Feature every approved creator that exists today (admin can re-order later in Admin → Featured).
INSERT INTO public.platform_settings (key, value)
SELECT 'featured_creators',
       jsonb_build_object('user_ids', COALESCE(jsonb_agg(user_id ORDER BY created_at), '[]'::jsonb))
FROM public.profiles
WHERE is_creator = true AND approval_status = 'approved'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
