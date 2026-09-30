CREATE TABLE public.coin_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  coins integer NOT NULL,
  nim_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

GRANT ALL ON public.coin_redemptions TO service_role;

ALTER TABLE public.coin_redemptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX coin_redemptions_wallet_idx ON public.coin_redemptions (wallet, created_at DESC);

-- Atomically spends coins and files a payout request. Returns the new row id,
-- or NULL when the wallet does not have enough coins.
CREATE OR REPLACE FUNCTION public.redeem_player_coins(p_wallet text, p_coins integer, p_rate integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_left integer;
  v_id uuid;
BEGIN
  IF p_coins IS NULL OR p_coins <= 0 OR p_rate IS NULL OR p_rate <= 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.wallet_credits
     SET coins = coins - p_coins
   WHERE wallet = p_wallet
     AND coins >= p_coins
  RETURNING coins INTO v_left;

  IF v_left IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.coin_redemptions (wallet, coins, nim_amount)
  VALUES (p_wallet, p_coins, p_coins::numeric / p_rate)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_player_coins(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_player_coins(text, integer, integer) TO service_role;