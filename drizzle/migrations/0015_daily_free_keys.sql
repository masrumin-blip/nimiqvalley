-- 15 free match keys per day: date of the last automatic top-up.
ALTER TABLE public.wallet_credits
  ADD COLUMN IF NOT EXISTS free_keys_date date;
