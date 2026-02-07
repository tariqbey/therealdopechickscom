
-- Create credit wallets for creators (separate from BREAD wallets for fans)
CREATE TABLE public.credit_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit wallet" ON public.credit_wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own credit wallet" ON public.credit_wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all credit wallets" ON public.credit_wallets FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create credit transactions
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all credit transactions" ON public.credit_transactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto-create credit wallet for creators when they become creators
-- (they can also manually purchase credits to get one created)
