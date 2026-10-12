-- =============================================================================
-- Back office parity with Scrile Connect: site settings, pricing options,
-- categories, CMS pages, announcements, payout requests, post verification,
-- admin user listing, configurable creator share, feature toggles, tips.
-- =============================================================================

-- ---------- helper: read a numeric platform setting with a default ----------
CREATE OR REPLACE FUNCTION public.setting_num(p_key text, p_field text, p_default numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (value->>p_field)::numeric FROM public.platform_settings WHERE key = p_key), p_default);
$$;

-- ---------- platform_settings: admin insert policy + seeded keys ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='platform_settings' AND policyname='Admins can insert settings') THEN
    CREATE POLICY "Admins can insert settings" ON public.platform_settings FOR INSERT
    WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

INSERT INTO public.platform_settings (key, value) VALUES
  ('site', '{"site_name":"Dope Chicks","company_name":"","company_address":"","meta_description":"The premium platform for exclusive content and AI-powered creation.","support_email":"","logo_url":"","favicon_url":"","watermark_enabled":false,"watermark_format":"site_name","ga_code":""}'),
  ('design', '{"primary":"#a855f7","secondary":"#e6b422","menu_type":"popup","sidebar":"left"}'),
  ('payouts', '{"creator_share_pct":80,"referral_pct":5,"payout_commission_pct":0,"request_fee_credits":0,"min_request_credits":100,"methods":["paypal","bank","crypto"]}'),
  ('currency', '{"main":"USD","symbol":"$","credit_name":"BREAD","rate_per_credit":0.10,"available":["USD"]}'),
  ('smtp', '{"host":"","port":587,"login":"","password":"","from_email":""}'),
  ('domain', '{"custom_domain":""}'),
  ('features', '{}')
ON CONFLICT (key) DO NOTHING;

-- ---------- price options ----------
CREATE TABLE IF NOT EXISTS public.price_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('deposit','post','message','subscription','attachment','call_minute','video_call','vr_video')),
  label text,
  credits numeric NOT NULL CHECK (credits >= 0),
  price_cents integer,
  stripe_price_id text,
  is_popular boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.price_options ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.price_options TO anon, authenticated;
GRANT ALL ON public.price_options TO authenticated;
CREATE POLICY "Price options are public" ON public.price_options FOR SELECT USING (true);
CREATE POLICY "Admins manage price options" ON public.price_options FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.price_options (kind, label, credits, price_cents, stripe_price_id, is_popular, sort) VALUES
  ('deposit','50 BREAD',50,499,'price_1SyE9VKb1BapFa4iRNnwQbdY',false,1),
  ('deposit','100 BREAD',100,1000,'price_1SyEAVKb1BapFa4iRdbLTQ7L',false,2),
  ('deposit','250 BREAD',250,2000,'price_1SyEAlKb1BapFa4iQRsEOzVT',false,3),
  ('deposit','500 BREAD',500,4000,'price_1SyEAvKb1BapFa4it4SG0KCJ',true,4),
  ('deposit','1,000 BREAD',1000,7500,'price_1SyEB7Kb1BapFa4iSthPX9Cb',false,5),
  ('deposit','2,500 BREAD',2500,17500,'price_1SyEBHKb1BapFa4iDE4O5ujE',false,6),
  ('post','Basic',20,NULL,NULL,false,1),('post','Plus',30,NULL,NULL,false,2),('post','Ultra',50,NULL,NULL,false,3),
  ('message',NULL,1,NULL,NULL,false,1),('message',NULL,2,NULL,NULL,false,2),('message',NULL,3,NULL,NULL,false,3),
  ('subscription',NULL,10,NULL,NULL,false,1),('subscription',NULL,15,NULL,NULL,false,2),('subscription',NULL,20,NULL,NULL,false,3),
  ('subscription',NULL,25,NULL,NULL,false,4),('subscription',NULL,40,NULL,NULL,false,5),('subscription',NULL,50,NULL,NULL,false,6),
  ('attachment',NULL,10,NULL,NULL,false,1),('attachment',NULL,20,NULL,NULL,false,2),('attachment',NULL,30,NULL,NULL,false,3),('attachment',NULL,50,NULL,NULL,false,4),
  ('call_minute',NULL,1,NULL,NULL,false,1),('call_minute',NULL,2,NULL,NULL,false,2),('call_minute',NULL,3,NULL,NULL,false,3),('call_minute',NULL,5,NULL,NULL,false,4),('call_minute',NULL,10,NULL,NULL,false,5),
  ('video_call',NULL,50,NULL,NULL,false,1),('video_call',NULL,100,NULL,NULL,false,2),('video_call',NULL,200,NULL,NULL,false,3),('video_call',NULL,500,NULL,NULL,false,4),
  ('vr_video',NULL,10,NULL,NULL,false,1),('vr_video',NULL,25,NULL,NULL,false,2),('vr_video',NULL,50,NULL,NULL,false,3),('vr_video',NULL,100,NULL,NULL,false,4);

-- ---------- categories ----------
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO authenticated;
CREATE POLICY "Categories are public" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
INSERT INTO public.categories (name, slug, sort) VALUES
  ('Glamour','glamour',1),('Fitness','fitness',2),('Cosplay','cosplay',3),('Fantasy','fantasy',4),('Artistic','artistic',5),
  ('Lifestyle','lifestyle',6),('AI Generated','ai-generated',7),('Exclusive','exclusive',8),('VR','vr',9),
  ('Beauty','beauty',10),('Fashion','fashion',11),('Music','music',12),('Dance','dance',13),('Travel','travel',14),
  ('Gaming','gaming',15),('Luxury','luxury',16),('Streetwear','streetwear',17),('Plus Size','plus-size',18),('Podcasts','podcasts',19)
ON CONFLICT (slug) DO NOTHING;

-- ---------- CMS pages ----------
CREATE TABLE IF NOT EXISTS public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT true,
  footer_group text CHECK (footer_group IS NULL OR footer_group IN ('platform','company','legal')),
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.site_pages TO anon, authenticated;
GRANT ALL ON public.site_pages TO authenticated;
CREATE POLICY "Published pages are public" ON public.site_pages FOR SELECT
USING (is_published = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage pages" ON public.site_pages FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_site_pages_updated_at BEFORE UPDATE ON public.site_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.site_pages (slug, title, content, footer_group, sort) VALUES
  ('about','About','# About Dope Chicks\n\nThe premium platform for exclusive content and AI-powered creation.','company',1),
  ('contact','Contact','# Contact\n\nEmail us at support@dopechicks.com.','company',2),
  ('terms','Terms of Service','# Terms of Service\n\n_Replace this with your terms._','legal',1),
  ('privacy','Privacy Policy','# Privacy Policy\n\n_Replace this with your privacy policy._','legal',2),
  ('content-guidelines','Content Guidelines','# Content Guidelines\n\nAll creators must be 18+. _Replace with your guidelines._','legal',3),
  ('dmca','DMCA','# DMCA\n\nSend takedown notices to the support email. _Replace with your DMCA policy._','legal',4)
ON CONFLICT (slug) DO NOTHING;

-- ---------- announcements ----------
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','creators','members')),
  style text NOT NULL DEFAULT 'info' CHECK (style IN ('info','success','warning')),
  link_url text,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcements TO authenticated;
CREATE POLICY "Active announcements are public" ON public.announcements FOR SELECT
USING ((is_active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------- payout requests ----------
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_credits integer NOT NULL CHECK (amount_credits > 0),
  fee_credits integer NOT NULL DEFAULT 0,
  commission_pct numeric NOT NULL DEFAULT 0,
  payout_amount_cents integer NOT NULL DEFAULT 0,
  method text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected','cancelled')),
  admin_note text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payout_requests_creator ON public.payout_requests (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.payout_requests (status, created_at DESC);
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
CREATE POLICY "Creators see own payout requests" ON public.payout_requests FOR SELECT
USING (auth.uid() = creator_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.request_payout(p_amount integer, p_method text, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance integer;
  v_min integer := public.setting_num('payouts','min_request_credits',100)::integer;
  v_fee integer := public.setting_num('payouts','request_fee_credits',0)::integer;
  v_comm numeric := public.setting_num('payouts','payout_commission_pct',0);
  v_rate numeric := public.setting_num('currency','rate_per_credit',0.10);
  v_net integer;
  v_req public.payout_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_uid AND is_creator) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Creator account required');
  END IF;
  IF p_amount < v_min THEN RETURN jsonb_build_object('success', false, 'error', 'Minimum payout is ' || v_min || ' credits'); END IF;
  IF EXISTS (SELECT 1 FROM public.payout_requests WHERE creator_id = v_uid AND status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending request');
  END IF;
  SELECT balance INTO v_balance FROM public.credit_wallets WHERE user_id = v_uid FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount + v_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient earnings balance', 'balance', COALESCE(v_balance, 0));
  END IF;
  v_net := FLOOR(p_amount * (100 - v_comm) / 100);
  UPDATE public.credit_wallets SET balance = balance - (p_amount + v_fee), updated_at = now() WHERE user_id = v_uid;
  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (v_uid, -(p_amount + v_fee), 'payout', 'Payout request (' || p_method || ')');
  INSERT INTO public.payout_requests (creator_id, amount_credits, fee_credits, commission_pct, payout_amount_cents, method, details)
  VALUES (v_uid, p_amount, v_fee, v_comm, ROUND(v_net * v_rate * 100)::integer, p_method, COALESCE(p_details, '{}'::jsonb))
  RETURNING * INTO v_req;
  RETURN jsonb_build_object('success', true, 'id', v_req.id, 'payout_amount_cents', v_req.payout_amount_cents);
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_payout_request(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.payout_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.payout_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.creator_id <> auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'Not found'); END IF;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'Already processed'); END IF;
  UPDATE public.payout_requests SET status = 'cancelled', processed_at = now() WHERE id = p_id;
  UPDATE public.credit_wallets SET balance = balance + r.amount_credits + r.fee_credits, updated_at = now() WHERE user_id = r.creator_id;
  INSERT INTO public.credit_transactions (user_id, amount, type, description, reference_id)
  VALUES (r.creator_id, r.amount_credits + r.fee_credits, 'refund', 'Payout request cancelled', p_id::text);
  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_process_payout(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.payout_requests%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN jsonb_build_object('success', false, 'error', 'Admin only'); END IF;
  IF p_status NOT IN ('approved','paid','rejected') THEN RETURN jsonb_build_object('success', false, 'error', 'Bad status'); END IF;
  SELECT * INTO r FROM public.payout_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Not found'); END IF;
  IF r.status IN ('rejected','cancelled','paid') THEN RETURN jsonb_build_object('success', false, 'error', 'Already ' || r.status); END IF;
  UPDATE public.payout_requests SET status = p_status, admin_note = COALESCE(p_note, admin_note), processed_by = auth.uid(), processed_at = now() WHERE id = p_id;
  IF p_status = 'rejected' THEN
    UPDATE public.credit_wallets SET balance = balance + r.amount_credits + r.fee_credits, updated_at = now() WHERE user_id = r.creator_id;
    INSERT INTO public.credit_transactions (user_id, amount, type, description, reference_id)
    VALUES (r.creator_id, r.amount_credits + r.fee_credits, 'refund', 'Payout rejected: ' || COALESCE(p_note, ''), p_id::text);
  END IF;
  RETURN jsonb_build_object('success', true, 'status', p_status);
END; $$;
GRANT EXECUTE ON FUNCTION public.request_payout(integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_payout_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_payout(uuid, text, text) TO authenticated;

-- ---------- post verification (admin content wall) + pinned posts ----------
ALTER TABLE public.creator_posts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='creator_posts' AND policyname='Admins manage all posts') THEN
    CREATE POLICY "Admins manage all posts" ON public.creator_posts FOR ALL
    USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- ---------- profiles: activity fields ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS referral_url text;

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_seen_at = now() WHERE user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

-- ---------- admin: users with auth info ----------
CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT NULL, p_role text DEFAULT 'all', p_sort text DEFAULT 'newest', p_limit integer DEFAULT 200, p_offset integer DEFAULT 0)
RETURNS TABLE (
  user_id uuid, email text, email_confirmed boolean, display_name text, avatar_url text, is_creator boolean,
  approval_status text, role text, created_at timestamptz, last_sign_in_at timestamptz, last_seen_at timestamptz,
  bread_balance integer, credit_balance integer, timezone text, referral_url text, total_count bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH base AS (
    SELECT p.user_id, u.email::text AS email, (u.email_confirmed_at IS NOT NULL) AS email_confirmed, p.display_name, p.avatar_url, p.is_creator,
           p.approval_status, COALESCE((SELECT string_agg(r.role::text, ',') FROM public.user_roles r WHERE r.user_id = p.user_id), 'user') AS role,
           p.created_at, u.last_sign_in_at, p.last_seen_at,
           COALESCE((SELECT w.balance FROM public.wallets w WHERE w.user_id = p.user_id), 0) AS bread_balance,
           COALESCE((SELECT c.balance FROM public.credit_wallets c WHERE c.user_id = p.user_id), 0) AS credit_balance,
           p.timezone, p.referral_url
    FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.user_id
  ), filtered AS (
    SELECT * FROM base b
    WHERE (p_search IS NULL OR p_search = '' OR b.display_name ILIKE '%' || p_search || '%' OR b.email ILIKE '%' || p_search || '%' OR b.user_id::text = p_search)
      AND (p_role = 'all'
        OR (p_role = 'creators' AND b.is_creator)
        OR (p_role = 'members' AND NOT b.is_creator AND b.role NOT LIKE '%admin%')
        OR (p_role = 'admins' AND b.role LIKE '%admin%')
        OR (p_role = 'moderators' AND b.role LIKE '%moderator%')
        OR (p_role = 'pending' AND b.approval_status = 'pending'))
  )
  SELECT f.*, (SELECT count(*) FROM filtered) AS total_count FROM filtered f
  ORDER BY CASE WHEN p_sort = 'oldest' THEN f.created_at END ASC,
           CASE WHEN p_sort = 'last_login' THEN f.last_sign_in_at END DESC NULLS LAST,
           CASE WHEN p_sort = 'name' THEN f.display_name END ASC,
           CASE WHEN p_sort = 'balance' THEN f.bread_balance END DESC,
           f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN jsonb_build_object('success', false, 'error', 'Admin only'); END IF;
  IF p_user_id = auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'You cannot delete yourself'); END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- ---------- admin dashboard aggregates ----------
CREATE OR REPLACE FUNCTION public.admin_dashboard(p_from timestamptz DEFAULT now() - interval '7 days', p_to timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rate numeric := public.setting_num('currency','rate_per_credit',0.10); res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'rate_per_credit', v_rate,
    'total_purchased_credits', COALESCE((SELECT sum(amount) FROM public.wallet_transactions WHERE type = 'purchase'), 0),
    'month_purchased_credits', COALESCE((SELECT sum(amount) FROM public.wallet_transactions WHERE type = 'purchase' AND created_at >= date_trunc('month', now())), 0),
    'prev_month_purchased_credits', COALESCE((SELECT sum(amount) FROM public.wallet_transactions WHERE type = 'purchase' AND created_at >= date_trunc('month', now()) - interval '1 month' AND created_at < date_trunc('month', now())), 0),
    'period_spent_credits', COALESCE((SELECT -sum(amount) FROM public.wallet_transactions WHERE type = 'spend' AND created_at BETWEEN p_from AND p_to), 0),
    'period_purchased_credits', COALESCE((SELECT sum(amount) FROM public.wallet_transactions WHERE type = 'purchase' AND created_at BETWEEN p_from AND p_to), 0),
    'circulating_credits', COALESCE((SELECT sum(balance) FROM public.wallets), 0),
    'creator_earnings_credits', COALESCE((SELECT sum(balance) FROM public.credit_wallets), 0),
    'pending_payouts', (SELECT count(*) FROM public.payout_requests WHERE status = 'pending'),
    'pending_posts', (SELECT count(*) FROM public.creator_posts WHERE status = 'pending'),
    'users', jsonb_build_object(
      'total', (SELECT count(*) FROM public.profiles),
      'creators', (SELECT count(*) FROM public.profiles WHERE is_creator),
      'admins', (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role = 'admin'),
      'moderators', (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role = 'moderator'),
      'members', (SELECT count(*) FROM public.profiles p WHERE NOT p.is_creator AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin')),
      'new_period', (SELECT count(*) FROM public.profiles WHERE created_at BETWEEN p_from AND p_to),
      'new_prev_period', (SELECT count(*) FROM public.profiles WHERE created_at >= p_from - (p_to - p_from) AND created_at < p_from),
      'new_month', (SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('month', now()))
    ),
    'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d.day, 'purchased', d.purchased, 'spent', d.spent, 'signups', d.signups) ORDER BY d.day)
      FROM (
        SELECT g.day,
          COALESCE((SELECT sum(amount) FROM public.wallet_transactions t WHERE type='purchase' AND t.created_at::date = g.day), 0) AS purchased,
          COALESCE((SELECT -sum(amount) FROM public.wallet_transactions t WHERE type='spend' AND t.created_at::date = g.day), 0) AS spent,
          (SELECT count(*) FROM public.profiles p WHERE p.created_at::date = g.day) AS signups
        FROM generate_series(p_from::date, p_to::date, interval '1 day') AS g(day)
      ) d), '[]'::jsonb),
    'monthly', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', to_char(m.month, 'Mon'), 'purchased', m.purchased) ORDER BY m.month)
      FROM (
        SELECT g.month, COALESCE((SELECT sum(amount) FROM public.wallet_transactions t WHERE type='purchase' AND date_trunc('month', t.created_at) = g.month), 0) AS purchased
        FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS g(month)
      ) m), '[]'::jsonb),
    'content_sales', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', s.kind, 'credits', s.credits))
      FROM (
        SELECT CASE WHEN description ILIKE 'Unlocked VR%' THEN 'VR videos'
                    WHEN description ILIKE 'Video call%' THEN 'Video calls'
                    WHEN description ILIKE 'Tip%' THEN 'Tips'
                    WHEN description ILIKE '%generat%' OR description ILIKE '%AI%' THEN 'AI Studio'
                    ELSE 'Other' END AS kind, -sum(amount) AS credits
        FROM public.wallet_transactions WHERE type='spend' AND created_at BETWEEN p_from AND p_to GROUP BY 1
      ) s), '[]'::jsonb),
    'top_sellers', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', t.user_id, 'name', p.display_name, 'avatar', p.avatar_url, 'credits', t.credits))
      FROM (SELECT user_id, sum(amount) AS credits FROM public.credit_transactions WHERE amount > 0 GROUP BY user_id ORDER BY 2 DESC LIMIT 10) t
      JOIN public.profiles p ON p.user_id = t.user_id), '[]'::jsonb),
    'top_spenders', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', t.user_id, 'name', p.display_name, 'avatar', p.avatar_url, 'credits', t.credits))
      FROM (SELECT user_id, -sum(amount) AS credits FROM public.wallet_transactions WHERE type='spend' GROUP BY user_id ORDER BY 2 DESC LIMIT 10) t
      JOIN public.profiles p ON p.user_id = t.user_id), '[]'::jsonb)
  ) INTO res;
  RETURN res;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_dashboard(timestamptz, timestamptz) TO authenticated;

-- ---------- admin: unified transaction ledger ----------
CREATE OR REPLACE FUNCTION public.admin_transactions(p_search text DEFAULT NULL, p_kind text DEFAULT 'all', p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_limit integer DEFAULT 200, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, ledger text, user_id uuid, display_name text, amount numeric, type text, description text, reference_id text, created_at timestamptz, total_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH all_tx AS (
    SELECT t.id, 'bread'::text AS ledger, t.user_id, t.amount::numeric, t.type, t.description, t.reference_id, t.created_at FROM public.wallet_transactions t
    UNION ALL
    SELECT c.id, 'earnings'::text, c.user_id, c.amount::numeric, c.type, c.description, c.reference_id, c.created_at FROM public.credit_transactions c
  ), joined AS (
    SELECT a.*, p.display_name FROM all_tx a LEFT JOIN public.profiles p ON p.user_id = a.user_id
    WHERE (p_search IS NULL OR p_search = '' OR p.display_name ILIKE '%' || p_search || '%' OR a.user_id::text = p_search OR a.description ILIKE '%' || p_search || '%')
      AND (p_kind = 'all' OR a.ledger = p_kind OR a.type = p_kind)
      AND (p_from IS NULL OR a.created_at >= p_from) AND (p_to IS NULL OR a.created_at <= p_to)
  )
  SELECT j.id, j.ledger, j.user_id, j.display_name, j.amount, j.type, j.description, j.reference_id, j.created_at, (SELECT count(*) FROM joined) AS total_count
  FROM joined j ORDER BY j.created_at DESC LIMIT p_limit OFFSET p_offset;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_transactions(text, text, timestamptz, timestamptz, integer, integer) TO authenticated;

-- ---------- configurable creator share (was hardcoded 80%) ----------
CREATE OR REPLACE FUNCTION public.unlock_vr_video(p_video_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_video public.vr_videos%ROWTYPE;
  v_balance INTEGER;
  v_creator_cut INTEGER;
  v_share numeric := public.setting_num('payouts','creator_share_pct',80);
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT * INTO v_video FROM public.vr_videos WHERE id = p_video_id AND is_published = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Video not found'); END IF;
  IF EXISTS (SELECT 1 FROM public.vr_video_unlocks WHERE video_id = p_video_id AND fan_user_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', true, 'already_unlocked', true);
  END IF;
  IF v_video.creator_id = auth.uid() OR v_video.price_bread = 0 THEN
    INSERT INTO public.vr_video_unlocks (video_id, fan_user_id, bread_paid) VALUES (p_video_id, auth.uid(), 0);
    RETURN jsonb_build_object('success', true, 'bread_paid', 0);
  END IF;
  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_video.price_bread THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient BREAD', 'needed', v_video.price_bread, 'balance', COALESCE(v_balance, 0));
  END IF;
  UPDATE public.wallets SET balance = balance - v_video.price_bread, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_id)
  VALUES (auth.uid(), -v_video.price_bread, 'spend', 'Unlocked VR video: ' || v_video.title, p_video_id::text);
  v_creator_cut := FLOOR(v_video.price_bread * v_share / 100);
  INSERT INTO public.credit_wallets (user_id, balance) VALUES (v_video.creator_id, v_creator_cut)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_wallets.balance + v_creator_cut, updated_at = now();
  INSERT INTO public.credit_transactions (user_id, amount, type, description, reference_id)
  VALUES (v_video.creator_id, v_creator_cut, 'earning', 'VR video unlock: ' || v_video.title, p_video_id::text);
  INSERT INTO public.vr_video_unlocks (video_id, fan_user_id, bread_paid) VALUES (p_video_id, auth.uid(), v_video.price_bread);
  UPDATE public.vr_videos SET unlocks_count = unlocks_count + 1 WHERE id = p_video_id;
  RETURN jsonb_build_object('success', true, 'bread_paid', v_video.price_bread);
END; $$;

CREATE OR REPLACE FUNCTION public.end_video_call(p_call_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.video_calls%ROWTYPE;
  v_secs integer;
  v_cut integer;
  v_share numeric := public.setting_num('payouts','creator_share_pct',80);
BEGIN
  SELECT * INTO v FROM public.video_calls WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Call not found'); END IF;
  IF auth.uid() NOT IN (v.fan_id, v.creator_id) AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a participant');
  END IF;
  IF v.status = 'requested' THEN
    IF auth.uid() = v.fan_id THEN RETURN public.cancel_video_call(p_call_id);
    ELSE RETURN public.respond_video_call(p_call_id, false); END IF;
  END IF;
  IF v.status = 'accepted' THEN
    UPDATE public.video_calls SET status = 'ended', ended_at = now(), ended_by = auth.uid() WHERE id = v.id RETURNING * INTO v;
    PERFORM public.refund_video_call_internal(v.id);
    PERFORM public.video_call_system_message(v, '📞 Call ended before connecting' || CASE WHEN v.bread_paid > 0 THEN ' · ' || v.bread_paid || ' BREAD refunded' ELSE '' END);
    RETURN jsonb_build_object('success', true, 'status', 'ended', 'refunded', true);
  END IF;
  IF v.status = 'active' THEN
    v_cut := FLOOR(v.bread_paid * v_share / 100);
    UPDATE public.video_calls SET status = 'ended', ended_at = now(), ended_by = auth.uid(), creator_cut = v_cut WHERE id = v.id RETURNING * INTO v;
    IF v_cut > 0 THEN
      INSERT INTO public.credit_wallets (user_id, balance) VALUES (v.creator_id, v_cut)
      ON CONFLICT (user_id) DO UPDATE SET balance = credit_wallets.balance + v_cut, updated_at = now();
      INSERT INTO public.credit_transactions (user_id, amount, type, description, reference_id)
      VALUES (v.creator_id, v_cut, 'earning', 'Video call', v.id::text);
    END IF;
    v_secs := GREATEST(0, EXTRACT(EPOCH FROM (v.ended_at - v.started_at))::integer);
    PERFORM public.video_call_system_message(v, '📞 Video call · ' || (v_secs / 60) || ':' || LPAD((v_secs % 60)::text, 2, '0'));
    RETURN jsonb_build_object('success', true, 'status', 'ended', 'duration_seconds', v_secs, 'creator_cut', v_cut);
  END IF;
  RETURN jsonb_build_object('success', true, 'status', v.status, 'already', true);
END; $$;

-- ---------- tips ----------
CREATE TABLE IF NOT EXISTS public.tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid,
  amount_credits integer NOT NULL CHECK (amount_credits > 0),
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tips TO authenticated;
CREATE POLICY "Tip participants can view tips" ON public.tips FOR SELECT
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.send_tip(p_to uuid, p_amount integer, p_post_id uuid DEFAULT NULL, p_message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_balance integer; v_cut integer; v_share numeric := public.setting_num('payouts','creator_share_pct',80); v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF p_to = auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'You cannot tip yourself'); END IF;
  IF p_amount < 1 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid amount'); END IF;
  SELECT display_name INTO v_name FROM public.profiles WHERE user_id = p_to AND is_creator;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Creator not found'); END IF;
  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient BREAD', 'needed', p_amount, 'balance', COALESCE(v_balance,0)); END IF;
  UPDATE public.wallets SET balance = balance - p_amount, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_id)
  VALUES (auth.uid(), -p_amount, 'spend', 'Tip to ' || COALESCE(v_name, 'creator'), p_post_id::text);
  v_cut := FLOOR(p_amount * v_share / 100);
  INSERT INTO public.credit_wallets (user_id, balance) VALUES (p_to, v_cut)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_wallets.balance + v_cut, updated_at = now();
  INSERT INTO public.credit_transactions (user_id, amount, type, description, reference_id) VALUES (p_to, v_cut, 'earning', 'Tip received', p_post_id::text);
  INSERT INTO public.tips (from_user_id, to_user_id, post_id, amount_credits, message) VALUES (auth.uid(), p_to, p_post_id, p_amount, p_message);
  RETURN jsonb_build_object('success', true, 'creator_cut', v_cut);
END; $$;
GRANT EXECUTE ON FUNCTION public.send_tip(uuid, integer, uuid, text) TO authenticated;
