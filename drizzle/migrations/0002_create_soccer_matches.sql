CREATE TABLE public.soccer_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  kind text NOT NULL DEFAULT 'quick',
  host_wallet text NOT NULL,
  guest_wallet text,
  status text NOT NULL DEFAULT 'waiting',
  target_goals integer NOT NULL DEFAULT 2,
  turn_no integer NOT NULL DEFAULT 0,
  turn_wallet text,
  turn_started_at timestamptz NOT NULL DEFAULT now(),
  winner_wallet text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX soccer_matches_status_idx ON public.soccer_matches (status, kind, created_at);
CREATE INDEX soccer_matches_host_idx ON public.soccer_matches (host_wallet, status);
CREATE INDEX soccer_matches_guest_idx ON public.soccer_matches (guest_wallet, status);

GRANT ALL ON public.soccer_matches TO service_role;
ALTER TABLE public.soccer_matches ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.soccer_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.soccer_matches(id) ON DELETE CASCADE,
  turn_no integer NOT NULL,
  wallet text NOT NULL,
  kind text NOT NULL DEFAULT 'shot',
  piece integer NOT NULL DEFAULT 0,
  vx double precision NOT NULL DEFAULT 0,
  vy double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, turn_no)
);

CREATE INDEX soccer_moves_match_idx ON public.soccer_moves (match_id, turn_no);

GRANT ALL ON public.soccer_moves TO service_role;
ALTER TABLE public.soccer_moves ENABLE ROW LEVEL SECURITY;