-- Match data is only read through server code with the service role, so the
-- public read access is unnecessary and leaks opponents' moves.
DROP POLICY IF EXISTS "mp rooms are publicly readable" ON public.mp_rooms;
DROP POLICY IF EXISTS "mp room players are publicly readable" ON public.mp_room_players;
DROP POLICY IF EXISTS "mp moves are publicly readable" ON public.mp_moves;
DROP POLICY IF EXISTS "mp ticks are publicly readable" ON public.mp_ticks;
DROP POLICY IF EXISTS "mp queue is publicly readable" ON public.mp_queue;
DROP POLICY IF EXISTS "mp tickets are publicly readable" ON public.mp_tickets;

REVOKE ALL ON public.mp_rooms FROM anon, authenticated;
REVOKE ALL ON public.mp_room_players FROM anon, authenticated;
REVOKE ALL ON public.mp_moves FROM anon, authenticated;
REVOKE ALL ON public.mp_ticks FROM anon, authenticated;
REVOKE ALL ON public.mp_queue FROM anon, authenticated;
REVOKE ALL ON public.mp_tickets FROM anon, authenticated;

GRANT ALL ON public.mp_rooms TO service_role;
GRANT ALL ON public.mp_room_players TO service_role;
GRANT ALL ON public.mp_moves TO service_role;
GRANT ALL ON public.mp_ticks TO service_role;
GRANT ALL ON public.mp_queue TO service_role;
GRANT ALL ON public.mp_tickets TO service_role;

-- Server-recorded proof that the daily reward links were actually opened.
CREATE TABLE public.daily_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  link_id text NOT NULL,
  visit_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet, link_id, visit_date)
);

GRANT ALL ON public.daily_visits TO service_role;
ALTER TABLE public.daily_visits ENABLE ROW LEVEL SECURITY;