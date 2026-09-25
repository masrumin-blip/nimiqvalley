CREATE TABLE public.league_pending_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  amount numeric NOT NULL,
  token text NOT NULL DEFAULT 'nim',
  tx_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.league_pending_deposits TO service_role;
ALTER TABLE public.league_pending_deposits ENABLE ROW LEVEL SECURITY;
CREATE INDEX league_pending_deposits_status_idx ON public.league_pending_deposits (status, league_id);