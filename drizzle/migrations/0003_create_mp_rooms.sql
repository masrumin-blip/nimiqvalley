CREATE TABLE public.mp_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug text NOT NULL,
  code text UNIQUE,
  kind text NOT NULL DEFAULT 'quick',
  host_wallet text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  max_players integer NOT NULL DEFAULT 2,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  turn_no integer NOT NULL DEFAULT 0,
  turn_wallet text,
  turn_started_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ends_at timestamptz,
  winner_wallet text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mp_room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.mp_rooms(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  seat integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'joined',
  score numeric NOT NULL DEFAULT 0,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, wallet)
);

CREATE TABLE public.mp_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.mp_rooms(id) ON DELETE CASCADE,
  turn_no integer NOT NULL,
  wallet text NOT NULL,
  kind text NOT NULL DEFAULT 'move',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, turn_no)
);

CREATE TABLE public.mp_ticks (
  room_id uuid NOT NULL REFERENCES public.mp_rooms(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  dir integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  alive boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, wallet)
);

CREATE INDEX mp_rooms_lookup_idx ON public.mp_rooms (game_slug, status, created_at DESC);
CREATE INDEX mp_room_players_room_idx ON public.mp_room_players (room_id);
CREATE INDEX mp_room_players_wallet_idx ON public.mp_room_players (wallet);
CREATE INDEX mp_moves_room_idx ON public.mp_moves (room_id, turn_no);

GRANT SELECT ON public.mp_rooms TO anon, authenticated;
GRANT SELECT ON public.mp_room_players TO anon, authenticated;
GRANT SELECT ON public.mp_moves TO anon, authenticated;
GRANT SELECT ON public.mp_ticks TO anon, authenticated;
GRANT ALL ON public.mp_rooms TO service_role;
GRANT ALL ON public.mp_room_players TO service_role;
GRANT ALL ON public.mp_moves TO service_role;
GRANT ALL ON public.mp_ticks TO service_role;

ALTER TABLE public.mp_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_ticks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp rooms are publicly readable" ON public.mp_rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "mp room players are publicly readable" ON public.mp_room_players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "mp moves are publicly readable" ON public.mp_moves FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "mp ticks are publicly readable" ON public.mp_ticks FOR SELECT TO anon, authenticated USING (true);
