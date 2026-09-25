CREATE TABLE public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug text NOT NULL,
  creator_wallet text NOT NULL,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  payout text NOT NULL DEFAULT 'winner',
  token text NOT NULL DEFAULT 'nim',
  pool numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leagues TO anon, authenticated;
GRANT ALL ON public.leagues TO service_role;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leagues readable" ON public.leagues FOR SELECT TO anon, authenticated USING (status <> 'draft');

CREATE TABLE public.league_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  amount numeric NOT NULL,
  tx_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.league_deposits TO service_role;
ALTER TABLE public.league_deposits ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.league_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  best numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, wallet)
);
GRANT SELECT ON public.league_scores TO anon, authenticated;
GRANT ALL ON public.league_scores TO service_role;
ALTER TABLE public.league_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "league scores readable" ON public.league_scores FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.league_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  ranks integer[] NOT NULL DEFAULT '{}',
  amount numeric NOT NULL,
  to_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, wallet)
);
GRANT ALL ON public.league_payouts TO service_role;
ALTER TABLE public.league_payouts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.game_run_sessions ADD COLUMN IF NOT EXISTS league_id uuid;

CREATE OR REPLACE FUNCTION public.leagues_lock_terms()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'draft' AND (
    NEW.game_slug IS DISTINCT FROM OLD.game_slug OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR
    NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.payout IS DISTINCT FROM OLD.payout OR
    NEW.token IS DISTINCT FROM OLD.token OR NEW.creator_wallet IS DISTINCT FROM OLD.creator_wallet OR
    NEW.pool < OLD.pool
  ) THEN
    RAISE EXCEPTION 'League terms are locked';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leagues_lock_terms BEFORE UPDATE ON public.leagues FOR EACH ROW EXECUTE FUNCTION public.leagues_lock_terms();

CREATE OR REPLACE FUNCTION public.add_league_deposit(p_league uuid, p_wallet text, p_amount numeric, p_tx text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pool numeric;
BEGIN
  INSERT INTO public.league_deposits (league_id, wallet, amount, tx_hash) VALUES (p_league, p_wallet, p_amount, p_tx);
  UPDATE public.leagues SET pool = pool + p_amount, status = 'active' WHERE id = p_league RETURNING pool INTO _pool;
  RETURN _pool;
END $$;
REVOKE ALL ON FUNCTION public.add_league_deposit(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_league_deposit(uuid, text, numeric, text) TO service_role;