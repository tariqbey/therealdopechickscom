-- Add api_cost_cents column to ai_generations to track actual API costs
ALTER TABLE public.ai_generations ADD COLUMN IF NOT EXISTS api_cost_cents integer NOT NULL DEFAULT 0;

-- Add platform_fee_cents column to track surcharge
ALTER TABLE public.ai_generations ADD COLUMN IF NOT EXISTS platform_fee_cents integer NOT NULL DEFAULT 15;