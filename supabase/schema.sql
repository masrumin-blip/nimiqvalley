-- NimiqValley — Lovable Cloud (Supabase) schema export
-- Generated: 2026-09-25 03:38 UTC
-- Note: values marked REDACTED_FILL_IN must be re-filled by the project owner.
-- The pg_cron job in arm_league_deposit_checker posts to this app's cron URL with its apikey.

CREATE TABLE public.ai_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  character_id text NOT NULL,
  role text NOT NULL DEFAULT 'user'::text,
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.chat_dms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pair_key text NOT NULL,
  from_wallet text NOT NULL,
  to_wallet text NOT NULL,
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.chat_friends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_wallet text NOT NULL,
  to_wallet text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  text text NOT NULL,
  kind text NOT NULL DEFAULT 'user'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.chat_moderation (
  wallet text NOT NULL,
  profanity_count integer NOT NULL DEFAULT 0,
  warning_window_started_at timestamp with time zone,
  muted_until timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  submission_times timestamp with time zone[] NOT NULL DEFAULT '{}'::timestamp with time zone[],
  last_normalized_text text,
  last_message_at timestamp with time zone
);
CREATE TABLE public.chat_presence (
  wallet text NOT NULL,
  last_seen timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.chat_profiles (
  wallet text NOT NULL,
  bio text NOT NULL DEFAULT ''::text,
  twitter text NOT NULL DEFAULT ''::text,
  instagram text NOT NULL DEFAULT ''::text,
  discord text NOT NULL DEFAULT ''::text,
  visibility text NOT NULL DEFAULT 'public'::text,
  dm_policy text NOT NULL DEFAULT 'everyone'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.credit_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  kind text NOT NULL,
  pack_id text,
  chats integer NOT NULL DEFAULT 0,
  keys integer NOT NULL DEFAULT 0,
  rooms integer NOT NULL DEFAULT 0,
  token text NOT NULL,
  amount numeric NOT NULL,
  memo text NOT NULL,
  tx_hash text,
  status text NOT NULL DEFAULT 'quoted'::text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.daily_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  claim_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.daily_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  link_id text NOT NULL,
  visit_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc'::text))::date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.game_run_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  game_slug text NOT NULL,
  seed integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  league_id uuid
);
CREATE TABLE public.league_deposits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  wallet text NOT NULL,
  amount numeric NOT NULL,
  tx_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.league_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  wallet text NOT NULL,
  ranks integer[] NOT NULL DEFAULT '{}'::integer[],
  amount numeric NOT NULL,
  to_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  tx_hash text,
  claimed_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.league_pending_deposits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  wallet text NOT NULL,
  amount numeric NOT NULL,
  token text NOT NULL DEFAULT 'nim'::text,
  tx_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.league_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  wallet text NOT NULL,
  best numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.leagues (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_slug text NOT NULL,
  creator_wallet text NOT NULL,
  title text NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  payout text NOT NULL DEFAULT 'winner'::text,
  token text NOT NULL DEFAULT 'nim'::text,
  pool numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.mp_moves (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  turn_no integer NOT NULL,
  wallet text NOT NULL,
  kind text NOT NULL DEFAULT 'move'::text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.mp_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_slug text NOT NULL,
  wallet text NOT NULL,
  max_players integer NOT NULL DEFAULT 2,
  rank_hint integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  room_id uuid,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  heartbeat_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.mp_room_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  wallet text NOT NULL,
  seat integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'joined'::text,
  score numeric NOT NULL DEFAULT 0,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.mp_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_slug text NOT NULL,
  code text,
  kind text NOT NULL DEFAULT 'quick'::text,
  host_wallet text NOT NULL,
  status text NOT NULL DEFAULT 'waiting'::text,
  max_players integer NOT NULL DEFAULT 2,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  turn_no integer NOT NULL DEFAULT 0,
  turn_wallet text,
  turn_started_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  ends_at timestamp with time zone,
  winner_wallet text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.mp_ticks (
  room_id uuid NOT NULL,
  wallet text NOT NULL,
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  dir integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  alive boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.nim_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tx_hash text NOT NULL,
  wallet text NOT NULL,
  kind text NOT NULL,
  nim numeric NOT NULL,
  chat_credits integer NOT NULL DEFAULT 0,
  room_credits integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  key_credits integer NOT NULL DEFAULT 0
);
CREATE TABLE public.player_sessions (
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  token_hash text
);
CREATE TABLE public.profiles (
  wallet text NOT NULL,
  display_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  game_slug text NOT NULL,
  value numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.soccer_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text,
  kind text NOT NULL DEFAULT 'quick'::text,
  host_wallet text NOT NULL,
  guest_wallet text,
  status text NOT NULL DEFAULT 'waiting'::text,
  target_goals integer NOT NULL DEFAULT 2,
  turn_no integer NOT NULL DEFAULT 0,
  turn_wallet text,
  turn_started_at timestamp with time zone NOT NULL DEFAULT now(),
  winner_wallet text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  entry_cost text NOT NULL DEFAULT 'key'::text,
  host_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  guest_seen_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.soccer_moves (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  turn_no integer NOT NULL,
  wallet text NOT NULL,
  kind text NOT NULL DEFAULT 'shot'::text,
  piece integer NOT NULL DEFAULT 0,
  vx double precision NOT NULL DEFAULT 0,
  vy double precision NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.village_letters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_wallet text NOT NULL,
  to_address text NOT NULL,
  to_chain text NOT NULL DEFAULT 'nim'::text,
  message text NOT NULL,
  token text NOT NULL DEFAULT 'none'::text,
  amount numeric NOT NULL DEFAULT 0,
  tx_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  opened_at timestamp with time zone,
  usdt_to text
);
CREATE TABLE public.wallet_credits (
  wallet text NOT NULL,
  chat_credits integer NOT NULL DEFAULT 0,
  room_credits integer NOT NULL DEFAULT 0,
  free_chats_date date,
  free_chats_used integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  match_keys integer NOT NULL DEFAULT 0,
  free_keys_date date
);
CREATE TABLE public.wallet_login_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  challenge text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ===== CONSTRAINTS =====

ALTER TABLE public.ai_chat_messages ADD CONSTRAINT ai_chat_messages_pkey PRIMARY KEY (id);

ALTER TABLE public.chat_dms ADD CONSTRAINT chat_dms_pkey PRIMARY KEY (id);

ALTER TABLE public.chat_dms ADD CONSTRAINT chat_dms_text_check CHECK (((char_length(text) >= 1) AND (char_length(text) <= 240)));

ALTER TABLE public.chat_friends ADD CONSTRAINT chat_friends_check CHECK ((from_wallet <> to_wallet));

ALTER TABLE public.chat_friends ADD CONSTRAINT chat_friends_from_wallet_to_wallet_key UNIQUE (from_wallet, to_wallet);

ALTER TABLE public.chat_friends ADD CONSTRAINT chat_friends_pkey PRIMARY KEY (id);

ALTER TABLE public.chat_friends ADD CONSTRAINT chat_friends_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text])));

ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_kind_check CHECK ((kind = ANY (ARRAY['user'::text, 'system'::text])));

ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);

ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_text_check CHECK (((char_length(text) >= 1) AND (char_length(text) <= 240)));

ALTER TABLE public.chat_moderation ADD CONSTRAINT chat_moderation_pkey PRIMARY KEY (wallet);

ALTER TABLE public.chat_moderation ADD CONSTRAINT chat_moderation_profanity_count_check CHECK ((profanity_count >= 0));

ALTER TABLE public.chat_presence ADD CONSTRAINT chat_presence_pkey PRIMARY KEY (wallet);

ALTER TABLE public.chat_profiles ADD CONSTRAINT chat_profiles_bio_check CHECK ((char_length(bio) <= 140));

ALTER TABLE public.chat_profiles ADD CONSTRAINT chat_profiles_dm_policy_check CHECK ((dm_policy = ANY (ARRAY['everyone'::text, 'friends'::text])));

ALTER TABLE public.chat_profiles ADD CONSTRAINT chat_profiles_pkey PRIMARY KEY (wallet);

ALTER TABLE public.chat_profiles ADD CONSTRAINT chat_profiles_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text])));

ALTER TABLE public.credit_purchases ADD CONSTRAINT credit_purchases_kind_check CHECK ((kind = ANY (ARRAY['chat'::text, 'key'::text, 'room'::text])));

ALTER TABLE public.credit_purchases ADD CONSTRAINT credit_purchases_pkey PRIMARY KEY (id);

ALTER TABLE public.credit_purchases ADD CONSTRAINT credit_purchases_status_check CHECK ((status = ANY (ARRAY['quoted'::text, 'pending'::text, 'confirmed'::text, 'failed'::text])));

ALTER TABLE public.credit_purchases ADD CONSTRAINT credit_purchases_token_check CHECK ((token = ANY (ARRAY['nim'::text, 'usdt'::text])));

ALTER TABLE public.credit_purchases ADD CONSTRAINT credit_purchases_tx_hash_key UNIQUE (tx_hash);

ALTER TABLE public.daily_claims ADD CONSTRAINT daily_claims_pkey PRIMARY KEY (id);

ALTER TABLE public.daily_claims ADD CONSTRAINT daily_claims_wallet_claim_date_key UNIQUE (wallet, claim_date);

ALTER TABLE public.daily_visits ADD CONSTRAINT daily_visits_pkey PRIMARY KEY (id);

ALTER TABLE public.daily_visits ADD CONSTRAINT daily_visits_wallet_link_id_visit_date_key UNIQUE (wallet, link_id, visit_date);

ALTER TABLE public.game_run_sessions ADD CONSTRAINT game_run_sessions_pkey PRIMARY KEY (id);

ALTER TABLE public.league_deposits ADD CONSTRAINT league_deposits_league_id_fkey FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

ALTER TABLE public.league_deposits ADD CONSTRAINT league_deposits_pkey PRIMARY KEY (id);

ALTER TABLE public.league_deposits ADD CONSTRAINT league_deposits_tx_hash_key UNIQUE (tx_hash);

ALTER TABLE public.league_payouts ADD CONSTRAINT league_payouts_league_id_fkey FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

ALTER TABLE public.league_payouts ADD CONSTRAINT league_payouts_league_id_wallet_key UNIQUE (league_id, wallet);

ALTER TABLE public.league_payouts ADD CONSTRAINT league_payouts_pkey PRIMARY KEY (id);

ALTER TABLE public.league_pending_deposits ADD CONSTRAINT league_pending_deposits_league_id_fkey FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

ALTER TABLE public.league_pending_deposits ADD CONSTRAINT league_pending_deposits_pkey PRIMARY KEY (id);

ALTER TABLE public.league_pending_deposits ADD CONSTRAINT league_pending_deposits_tx_hash_key UNIQUE (tx_hash);

ALTER TABLE public.league_scores ADD CONSTRAINT league_scores_league_id_fkey FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

ALTER TABLE public.league_scores ADD CONSTRAINT league_scores_league_id_wallet_key UNIQUE (league_id, wallet);

ALTER TABLE public.league_scores ADD CONSTRAINT league_scores_pkey PRIMARY KEY (id);

ALTER TABLE public.leagues ADD CONSTRAINT leagues_pkey PRIMARY KEY (id);

ALTER TABLE public.mp_moves ADD CONSTRAINT mp_moves_pkey PRIMARY KEY (id);

ALTER TABLE public.mp_moves ADD CONSTRAINT mp_moves_room_id_fkey FOREIGN KEY (room_id) REFERENCES mp_rooms(id) ON DELETE CASCADE;

ALTER TABLE public.mp_moves ADD CONSTRAINT mp_moves_room_id_turn_no_key UNIQUE (room_id, turn_no);

ALTER TABLE public.mp_queue ADD CONSTRAINT mp_queue_game_slug_wallet_key UNIQUE (game_slug, wallet);

ALTER TABLE public.mp_queue ADD CONSTRAINT mp_queue_pkey PRIMARY KEY (id);

ALTER TABLE public.mp_room_players ADD CONSTRAINT mp_room_players_pkey PRIMARY KEY (id);

ALTER TABLE public.mp_room_players ADD CONSTRAINT mp_room_players_room_id_fkey FOREIGN KEY (room_id) REFERENCES mp_rooms(id) ON DELETE CASCADE;

ALTER TABLE public.mp_room_players ADD CONSTRAINT mp_room_players_room_id_wallet_key UNIQUE (room_id, wallet);

ALTER TABLE public.mp_rooms ADD CONSTRAINT mp_rooms_code_key UNIQUE (code);

ALTER TABLE public.mp_rooms ADD CONSTRAINT mp_rooms_pkey PRIMARY KEY (id);

ALTER TABLE public.mp_ticks ADD CONSTRAINT mp_ticks_pkey PRIMARY KEY (room_id, wallet);

ALTER TABLE public.mp_ticks ADD CONSTRAINT mp_ticks_room_id_fkey FOREIGN KEY (room_id) REFERENCES mp_rooms(id) ON DELETE CASCADE;

ALTER TABLE public.nim_payments ADD CONSTRAINT nim_payments_pkey PRIMARY KEY (id);

ALTER TABLE public.nim_payments ADD CONSTRAINT nim_payments_tx_hash_key UNIQUE (tx_hash);

ALTER TABLE public.player_sessions ADD CONSTRAINT player_sessions_pkey PRIMARY KEY (token);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (wallet);

ALTER TABLE public.scores ADD CONSTRAINT scores_pkey PRIMARY KEY (id);

ALTER TABLE public.scores ADD CONSTRAINT scores_wallet_fkey FOREIGN KEY (wallet) REFERENCES profiles(wallet) ON DELETE CASCADE;

ALTER TABLE public.scores ADD CONSTRAINT scores_wallet_game_slug_key UNIQUE (wallet, game_slug);

ALTER TABLE public.soccer_matches ADD CONSTRAINT soccer_matches_code_key UNIQUE (code);

ALTER TABLE public.soccer_matches ADD CONSTRAINT soccer_matches_pkey PRIMARY KEY (id);

ALTER TABLE public.soccer_moves ADD CONSTRAINT soccer_moves_match_id_fkey FOREIGN KEY (match_id) REFERENCES soccer_matches(id) ON DELETE CASCADE;

ALTER TABLE public.soccer_moves ADD CONSTRAINT soccer_moves_match_id_turn_no_key UNIQUE (match_id, turn_no);

ALTER TABLE public.soccer_moves ADD CONSTRAINT soccer_moves_pkey PRIMARY KEY (id);

ALTER TABLE public.village_letters ADD CONSTRAINT village_letters_pkey PRIMARY KEY (id);

ALTER TABLE public.village_letters ADD CONSTRAINT village_letters_tx_hash_key UNIQUE (tx_hash);

ALTER TABLE public.wallet_credits ADD CONSTRAINT wallet_credits_pkey PRIMARY KEY (wallet);

ALTER TABLE public.wallet_login_challenges ADD CONSTRAINT wallet_login_challenges_challenge_key UNIQUE (challenge);

ALTER TABLE public.wallet_login_challenges ADD CONSTRAINT wallet_login_challenges_pkey PRIMARY KEY (id);
-- ===== ROW LEVEL SECURITY =====

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_dms ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_friends ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_moderation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_claims ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_visits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.game_run_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.league_deposits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.league_payouts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.league_pending_deposits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.league_scores ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mp_moves ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mp_queue ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mp_room_players ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mp_rooms ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mp_ticks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.nim_payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.player_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.soccer_matches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.soccer_moves ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.village_letters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.wallet_credits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.wallet_login_challenges ENABLE ROW LEVEL SECURITY;
-- ===== GRANTS =====

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_chat_messages TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_chat_messages TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_chat_messages TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_dms TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_dms TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_dms TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_friends TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_messages TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_messages TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_messages TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_moderation TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_moderation TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_moderation TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_presence TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_presence TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_presence TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.chat_profiles TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.credit_purchases TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.credit_purchases TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.credit_purchases TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.daily_claims TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.daily_visits TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.daily_visits TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.daily_visits TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.game_run_sessions TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.game_run_sessions TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.game_run_sessions TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_deposits TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_deposits TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_deposits TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_payouts TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_payouts TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_payouts TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_pending_deposits TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_pending_deposits TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_pending_deposits TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_scores TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_scores TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.league_scores TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.leagues TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.leagues TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.leagues TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.mp_moves TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.mp_queue TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.mp_room_players TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.mp_rooms TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.mp_ticks TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.nim_payments TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.player_sessions TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.player_sessions TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.player_sessions TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.scores TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.scores TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.scores TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.soccer_matches TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.soccer_matches TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.soccer_matches TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.soccer_moves TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.soccer_moves TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.soccer_moves TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.village_letters TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.village_letters TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.village_letters TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.wallet_credits TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.wallet_login_challenges TO anon;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.wallet_login_challenges TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.wallet_login_challenges TO service_role;
-- ===== POLICIES =====

CREATE POLICY "chat messages are publicly readable" ON public.chat_messages FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "chat presence is publicly readable" ON public.chat_presence FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "league scores readable" ON public.league_scores FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "leagues readable" ON public.leagues FOR SELECT TO authenticated, anon USING ((status <> 'draft'::text));

CREATE POLICY "Profiles are publicly readable" ON public.profiles FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Scores are publicly readable" ON public.scores FOR SELECT TO authenticated, anon USING (true);
-- ===== FUNCTIONS =====

CREATE OR REPLACE FUNCTION public.add_league_deposit(p_league uuid, p_wallet text, p_amount numeric, p_tx text) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER AS $$

DECLARE _pool numeric;
BEGIN
  INSERT INTO public.league_deposits (league_id, wallet, amount, tx_hash) VALUES (p_league, p_wallet, p_amount, p_tx);
  UPDATE public.leagues SET pool = pool + p_amount, status = 'active' WHERE id = p_league RETURNING pool INTO _pool;
  RETURN _pool;
END 
$$;

CREATE OR REPLACE FUNCTION public.arm_league_deposit_checker() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$

begin
  if not exists (select 1 from cron.job where jobname = 'league-deposits-check') then
    perform cron.schedule('league-deposits-check', '*/2 * * * *', $job$
      select net.http_post(
        url:='https://project--7603a760-67d6-423b-9d7f-956918d5a40a.lovable.app/api/public/cron/league-deposits',
        headers:='{"Content-Type":"application/json","apikey":'REDACTED_FILL_IN'}'::jsonb,
        body:='{}'::jsonb);
    $job$);
  end if;
  return new;
end 
$$;

CREATE OR REPLACE FUNCTION public.confirm_credit_purchase(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$

declare r public.credit_purchases%rowtype;
begin
  select * into r from public.credit_purchases where id = p_id for update;
  if not found then raise exception 'purchase not found'; end if;
  if r.status = 'confirmed' then return 'confirmed'; end if;
  if r.status <> 'pending' then raise exception 'purchase not pending'; end if;
  insert into public.wallet_credits(wallet) values (r.wallet) on conflict (wallet) do nothing;
  update public.wallet_credits
     set chat_credits = chat_credits + r.chats,
         match_keys = coalesce(match_keys,0) + r.keys,
         room_credits = room_credits + r.rooms,
         updated_at = now()
   where wallet = r.wallet;
  update public.credit_purchases set status = 'confirmed', updated_at = now() where id = p_id;
  return 'confirmed';
end 
$$;

CREATE OR REPLACE FUNCTION public.confirm_league_deposit(p_pending uuid) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER AS $$

DECLARE
  _pending public.league_pending_deposits%ROWTYPE;
  _pool numeric;
BEGIN
  SELECT * INTO _pending
  FROM public.league_pending_deposits
  WHERE id = p_pending
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending deposit not found';
  END IF;

  IF _pending.status = 'confirmed' THEN
    SELECT pool INTO _pool FROM public.leagues WHERE id = _pending.league_id;
    RETURN _pool;
  END IF;

  IF _pending.status <> 'pending' THEN
    RAISE EXCEPTION 'Deposit is not pending';
  END IF;

  INSERT INTO public.league_deposits (league_id, wallet, amount, tx_hash)
  VALUES (_pending.league_id, _pending.wallet, _pending.amount, _pending.tx_hash)
  ON CONFLICT (tx_hash) DO NOTHING;

  IF FOUND THEN
    UPDATE public.leagues
    SET pool = pool + _pending.amount,
        status = 'active'
    WHERE id = _pending.league_id
    RETURNING pool INTO _pool;
  ELSE
    SELECT pool INTO _pool FROM public.leagues WHERE id = _pending.league_id;
  END IF;

  UPDATE public.league_pending_deposits
  SET status = 'confirmed', updated_at = now()
  WHERE id = _pending.id;

  RETURN _pool;
END

$$;

CREATE OR REPLACE FUNCTION public.disarm_league_deposit_checker() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$

begin
  if not exists (select 1 from public.league_pending_deposits where status = 'pending')
     and not exists (select 1 from public.credit_purchases where status = 'pending')
     and exists (select 1 from cron.job where jobname = 'league-deposits-check') then
    perform cron.unschedule('league-deposits-check');
  end if;
end 
$$;

CREATE OR REPLACE FUNCTION public.leagues_lock_terms() RETURNS trigger
LANGUAGE plpgsql AS $$

BEGIN
  IF OLD.status <> 'draft' AND (
    NEW.game_slug IS DISTINCT FROM OLD.game_slug OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR
    NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.payout IS DISTINCT FROM OLD.payout OR
    NEW.token IS DISTINCT FROM OLD.token OR NEW.creator_wallet IS DISTINCT FROM OLD.creator_wallet OR
    NEW.pool < OLD.pool
  ) THEN
    RAISE EXCEPTION 'League terms are locked';
  END IF;
  RETURN NEW;
END 
$$;

CREATE OR REPLACE FUNCTION public.moderate_chat_submission(_wallet text, _normalized_text text, _is_profane boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$

DECLARE
  _state public.chat_moderation%ROWTYPE;
  _now timestamptz := now();
  _recent_times timestamptz[];
  _new_count integer := 0;
  _mute_until timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_wallet));

  INSERT INTO public.chat_moderation (wallet)
  VALUES (_wallet)
  ON CONFLICT (wallet) DO NOTHING;

  SELECT * INTO _state
  FROM public.chat_moderation
  WHERE wallet = _wallet
  FOR UPDATE;

  IF _state.muted_until IS NOT NULL AND _state.muted_until > _now THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'muted', 'mutedUntil', _state.muted_until);
  END IF;

  IF _is_profane THEN
    IF _state.warning_window_started_at IS NULL
       OR _state.warning_window_started_at <= _now - interval '24 hours' THEN
      _new_count := 1;
    ELSE
      _new_count := _state.profanity_count + 1;
    END IF;

    _mute_until := CASE
      WHEN _new_count >= 3 THEN _now + interval '1 hour'
      WHEN _new_count = 2 THEN _now + interval '5 minutes'
      ELSE NULL
    END;

    UPDATE public.chat_moderation
    SET profanity_count = _new_count,
        warning_window_started_at = CASE
          WHEN _state.warning_window_started_at IS NULL
            OR _state.warning_window_started_at <= _now - interval '24 hours'
          THEN _now ELSE _state.warning_window_started_at END,
        muted_until = _mute_until,
        updated_at = _now
    WHERE wallet = _wallet;

    RETURN jsonb_build_object('allowed', false, 'reason', 'profanity', 'warningCount', _new_count, 'mutedUntil', _mute_until);
  END IF;

  SELECT coalesce(array_agg(sent_at ORDER BY sent_at), '{}')
  INTO _recent_times
  FROM unnest(_state.submission_times) AS sent_at
  WHERE sent_at > _now - interval '10 seconds';

  IF _state.last_normalized_text = _normalized_text
     AND _state.last_message_at IS NOT NULL
     AND _state.last_message_at > _now - interval '2 minutes' THEN
    _mute_until := _now + interval '5 minutes';
    UPDATE public.chat_moderation
    SET muted_until = _mute_until, updated_at = _now
    WHERE wallet = _wallet;
    RETURN jsonb_build_object('allowed', false, 'reason', 'duplicate', 'mutedUntil', _mute_until);
  END IF;

  IF cardinality(_recent_times) >= 3 THEN
    _mute_until := _now + interval '5 minutes';
    UPDATE public.chat_moderation
    SET submission_times = _recent_times, muted_until = _mute_until, updated_at = _now
    WHERE wallet = _wallet;
    RETURN jsonb_build_object('allowed', false, 'reason', 'spam', 'mutedUntil', _mute_until);
  END IF;

  UPDATE public.chat_moderation
  SET submission_times = array_append(_recent_times, _now),
      last_normalized_text = _normalized_text,
      last_message_at = _now,
      muted_until = NULL,
      updated_at = _now
  WHERE wallet = _wallet;

  RETURN jsonb_build_object('allowed', true);
END;

$$;

CREATE OR REPLACE FUNCTION public.spend_match_key(p_wallet text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$

DECLARE _hit integer;
BEGIN
  UPDATE public.wallet_credits wc
  SET match_keys = wc.match_keys - 1, updated_at = now()
  WHERE wc.wallet = p_wallet AND wc.match_keys > 0
  RETURNING 1 INTO _hit;
  RETURN _hit IS NOT NULL;
END;

$$;

CREATE OR REPLACE FUNCTION public.spend_room_credit(p_wallet text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$

DECLARE _hit integer;
BEGIN
  UPDATE public.wallet_credits wc
  SET room_credits = wc.room_credits - 1, updated_at = now()
  WHERE wc.wallet = p_wallet AND wc.room_credits > 0
  RETURNING 1 INTO _hit;
  RETURN _hit IS NOT NULL;
END;

$$;
-- ===== TRIGGERS =====

CREATE TRIGGER credit_purchase_arm AFTER INSERT OR UPDATE OF status ON public.credit_purchases FOR EACH ROW WHEN ((new.status = 'pending'::text)) EXECUTE FUNCTION arm_league_deposit_checker();

CREATE TRIGGER league_pending_arm AFTER INSERT ON public.league_pending_deposits FOR EACH ROW WHEN ((new.status = 'pending'::text)) EXECUTE FUNCTION arm_league_deposit_checker();

CREATE TRIGGER leagues_lock_terms BEFORE UPDATE ON public.leagues FOR EACH ROW EXECUTE FUNCTION leagues_lock_terms();
