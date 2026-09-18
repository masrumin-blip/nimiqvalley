CREATE TABLE public.player_sessions (
  token UUID PRIMARY KEY,
  wallet TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX player_sessions_wallet_idx ON public.player_sessions (wallet);

GRANT ALL ON public.player_sessions TO service_role;

ALTER TABLE public.player_sessions ENABLE ROW LEVEL SECURITY;