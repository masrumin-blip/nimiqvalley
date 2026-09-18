CREATE TABLE public.wallet_login_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  challenge TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.wallet_login_challenges TO service_role;
ALTER TABLE public.wallet_login_challenges ENABLE ROW LEVEL SECURITY;
CREATE INDEX wallet_login_challenges_wallet_created_idx
  ON public.wallet_login_challenges (wallet, created_at DESC);