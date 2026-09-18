ALTER TABLE public.wallet_credits ADD COLUMN IF NOT EXISTS match_keys integer NOT NULL DEFAULT 0;
ALTER TABLE public.nim_payments ADD COLUMN IF NOT EXISTS key_credits integer NOT NULL DEFAULT 0;