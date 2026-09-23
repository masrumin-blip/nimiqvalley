CREATE TABLE public.game_run_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  game_slug TEXT NOT NULL,
  seed INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);
CREATE INDEX game_run_sessions_wallet_slug_idx
  ON public.game_run_sessions (wallet, game_slug, created_at DESC);
GRANT ALL ON public.game_run_sessions TO service_role;
ALTER TABLE public.game_run_sessions ENABLE ROW LEVEL SECURITY;