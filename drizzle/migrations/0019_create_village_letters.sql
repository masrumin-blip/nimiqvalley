CREATE TABLE public.village_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wallet text NOT NULL,
  to_address text NOT NULL,
  to_chain text NOT NULL DEFAULT 'nim',
  message text NOT NULL,
  token text NOT NULL DEFAULT 'none',
  amount numeric NOT NULL DEFAULT 0,
  tx_hash text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz
);
CREATE INDEX village_letters_to_idx ON public.village_letters (to_address, created_at DESC);
CREATE INDEX village_letters_from_idx ON public.village_letters (from_wallet, created_at DESC);
GRANT ALL ON public.village_letters TO service_role;
ALTER TABLE public.village_letters ENABLE ROW LEVEL SECURITY;