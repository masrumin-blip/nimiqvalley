CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 240),
  kind text NOT NULL DEFAULT 'user' CHECK (kind IN ('user','system')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_created_at_idx ON public.chat_messages (created_at DESC);

CREATE TABLE public.chat_presence (
  wallet text PRIMARY KEY,
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_profiles (
  wallet text PRIMARY KEY,
  bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 140),
  twitter text NOT NULL DEFAULT '',
  instagram text NOT NULL DEFAULT '',
  discord text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  dm_policy text NOT NULL DEFAULT 'everyone' CHECK (dm_policy IN ('everyone','friends')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wallet text NOT NULL,
  to_wallet text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_wallet <> to_wallet),
  UNIQUE (from_wallet, to_wallet)
);
CREATE INDEX chat_friends_to_idx ON public.chat_friends (to_wallet, status);
CREATE INDEX chat_friends_from_idx ON public.chat_friends (from_wallet, status);

CREATE TABLE public.chat_dms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_key text NOT NULL,
  from_wallet text NOT NULL,
  to_wallet text NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 240),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_dms_pair_idx ON public.chat_dms (pair_key, created_at DESC);

GRANT SELECT ON public.chat_messages TO anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;
GRANT SELECT ON public.chat_presence TO anon, authenticated;
GRANT ALL ON public.chat_presence TO service_role;
GRANT SELECT ON public.chat_profiles TO anon, authenticated;
GRANT ALL ON public.chat_profiles TO service_role;
GRANT SELECT ON public.chat_friends TO anon, authenticated;
GRANT ALL ON public.chat_friends TO service_role;
GRANT ALL ON public.chat_dms TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_dms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat messages are publicly readable" ON public.chat_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "chat presence is publicly readable" ON public.chat_presence FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "chat profiles are publicly readable" ON public.chat_profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "chat friends are publicly readable" ON public.chat_friends FOR SELECT TO anon, authenticated USING (true);