ALTER TABLE public.wallet_credits ADD COLUMN IF NOT EXISTS nim_balance NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.mp_rooms ADD COLUMN IF NOT EXISTS stake NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.mp_rooms ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

ALTER TABLE public.mp_queue ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'casual';

CREATE TABLE IF NOT EXISTS public.mp_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  delta NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pass',
  reason TEXT NOT NULL,
  room_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mp_tickets_wallet_idx ON public.mp_tickets (wallet, created_at DESC);

GRANT SELECT ON public.mp_tickets TO anon;
GRANT SELECT ON public.mp_tickets TO authenticated;
GRANT ALL ON public.mp_tickets TO service_role;

ALTER TABLE public.mp_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp tickets are publicly readable"
  ON public.mp_tickets FOR SELECT
  TO anon, authenticated
  USING (true);