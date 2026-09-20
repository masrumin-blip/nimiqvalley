ALTER TABLE public.wallet_credits
  ADD COLUMN IF NOT EXISTS free_keys_date date;