ALTER TABLE public.wallet_credits ADD COLUMN IF NOT EXISTS free_keys_used integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.wallet_credits.match_keys IS 'Owned keys only (bought or daily-reward bonus). Never expire. Daily free keys are tracked by free_keys_used.';
UPDATE public.wallet_credits
   SET match_keys = GREATEST(0, COALESCE(match_keys,0) - 15),
       free_keys_used = 0,
       free_keys_date = (now() at time zone 'utc')::date;