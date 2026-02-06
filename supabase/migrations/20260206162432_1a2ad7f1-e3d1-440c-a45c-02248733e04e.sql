
-- Allow admins to view all AI generations for content moderation
CREATE POLICY "Admins can view all generations"
ON public.ai_generations
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update AI generation status (for moderation)
CREATE POLICY "Admins can update all generations"
ON public.ai_generations
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete AI generations (for content removal)
CREATE POLICY "Admins can delete generations"
ON public.ai_generations
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any profile (for toggling creator status)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all wallets for analytics
CREATE POLICY "Admins can view all wallets"
ON public.wallets
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all wallet transactions for analytics
CREATE POLICY "Admins can view all transactions"
ON public.wallet_transactions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
