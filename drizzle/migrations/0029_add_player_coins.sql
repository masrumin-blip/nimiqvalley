-- Player coin wallet: coins are earned in games and convert to NIM at 100:1.
ALTER TABLE public.wallet_credits
  ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_date date,
  ADD COLUMN IF NOT EXISTS coins_today integer NOT NULL DEFAULT 0;

-- Atomic coin award with a per-day cap so a compromised client cannot drain
-- the treasury. Returns the number of coins actually granted.
CREATE OR REPLACE FUNCTION public.add_player_coins(
  p_wallet text,
  p_coins integer,
  p_daily_cap integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() at time zone 'utc')::date;
  v_used integer;
  v_grant integer;
BEGIN
  IF p_coins IS NULL OR p_coins <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.wallet_credits (wallet)
  VALUES (p_wallet)
  ON CONFLICT (wallet) DO NOTHING;

  SELECT CASE WHEN coins_date = v_today THEN coins_today ELSE 0 END
    INTO v_used
    FROM public.wallet_credits
   WHERE wallet = p_wallet
   FOR UPDATE;

  v_grant := LEAST(p_coins, GREATEST(0, p_daily_cap - COALESCE(v_used, 0)));
  IF v_grant <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.wallet_credits
     SET coins = coins + v_grant,
         coins_date = v_today,
         coins_today = COALESCE(v_used, 0) + v_grant,
         updated_at = now()
   WHERE wallet = p_wallet;

  RETURN v_grant;
END;
$$;

REVOKE ALL ON FUNCTION public.add_player_coins(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_player_coins(text, integer, integer) TO service_role;