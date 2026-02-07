
-- Creator subscription tiers (Bronze, Silver, Gold per creator)
CREATE TABLE public.creator_subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  tier_name TEXT NOT NULL DEFAULT 'Bronze',
  price_cents INTEGER NOT NULL DEFAULT 499,
  description TEXT,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id, tier_name)
);

ALTER TABLE public.creator_subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active tiers
CREATE POLICY "Anyone can view active tiers"
  ON public.creator_subscription_tiers FOR SELECT
  USING (is_active = true);

-- Creators can manage their own tiers
CREATE POLICY "Creators can insert own tiers"
  ON public.creator_subscription_tiers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own tiers"
  ON public.creator_subscription_tiers FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id);

-- Admins can manage all tiers
CREATE POLICY "Admins can manage all tiers"
  ON public.creator_subscription_tiers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fan subscriptions to creators
CREATE TABLE public.creator_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_user_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  tier_id UUID NOT NULL REFERENCES public.creator_subscription_tiers(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(fan_user_id, creator_id)
);

ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;

-- Fans can view their own subscriptions
CREATE POLICY "Fans can view own subscriptions"
  ON public.creator_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = fan_user_id);

-- Creators can view subscriptions to them
CREATE POLICY "Creators can view their subscribers"
  ON public.creator_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = creator_id);

-- Admins can manage all
CREATE POLICY "Admins can manage all subscriptions"
  ON public.creator_subscriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_creator_subscription_tiers_updated_at
  BEFORE UPDATE ON public.creator_subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creator_subscriptions_updated_at
  BEFORE UPDATE ON public.creator_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
