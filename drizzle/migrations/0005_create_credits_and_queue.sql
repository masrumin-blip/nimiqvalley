CREATE TABLE public.wallet_credits (
  wallet TEXT PRIMARY KEY,
  chat_credits INTEGER NOT NULL DEFAULT 0,
  room_credits INTEGER NOT NULL DEFAULT 0,
  free_chats_date DATE,
  free_chats_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_credits TO anon, authenticated;
GRANT ALL ON public.wallet_credits TO service_role;
ALTER TABLE public.wallet_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet credits are publicly readable" ON public.wallet_credits FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.nim_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash TEXT NOT NULL UNIQUE,
  wallet TEXT NOT NULL,
  kind TEXT NOT NULL,
  nim NUMERIC NOT NULL,
  chat_credits INTEGER NOT NULL DEFAULT 0,
  room_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nim_payments TO anon, authenticated;
GRANT ALL ON public.nim_payments TO service_role;
ALTER TABLE public.nim_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nim payments are publicly readable" ON public.nim_payments FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.daily_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  claim_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet, claim_date)
);
GRANT SELECT ON public.daily_claims TO anon, authenticated;
GRANT ALL ON public.daily_claims TO service_role;
ALTER TABLE public.daily_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily claims are publicly readable" ON public.daily_claims FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.mp_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug TEXT NOT NULL,
  wallet TEXT NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 2,
  rank_hint INTEGER NOT NULL DEFAULT 0,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  room_id UUID,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_slug, wallet)
);
CREATE INDEX mp_queue_game_joined_idx ON public.mp_queue (game_slug, joined_at);
GRANT SELECT ON public.mp_queue TO anon, authenticated;
GRANT ALL ON public.mp_queue TO service_role;
ALTER TABLE public.mp_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp queue is publicly readable" ON public.mp_queue FOR SELECT TO anon, authenticated USING (true);