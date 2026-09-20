ALTER TABLE public.player_sessions
  ALTER COLUMN token SET DEFAULT gen_random_uuid();

ALTER TABLE public.player_sessions
  ADD COLUMN IF NOT EXISTS token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS player_sessions_token_hash_idx
  ON public.player_sessions (token_hash);

ALTER TABLE public.soccer_matches
  ADD COLUMN IF NOT EXISTS host_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS guest_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.spend_match_key(p_wallet text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _hit integer;
BEGIN
  UPDATE public.wallet_credits wc
  SET match_keys = wc.match_keys - 1, updated_at = now()
  WHERE wc.wallet = p_wallet AND wc.match_keys > 0
  RETURNING 1 INTO _hit;
  RETURN _hit IS NOT NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.spend_room_credit(p_wallet text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _hit integer;
BEGIN
  UPDATE public.wallet_credits wc
  SET room_credits = wc.room_credits - 1, updated_at = now()
  WHERE wc.wallet = p_wallet AND wc.room_credits > 0
  RETURNING 1 INTO _hit;
  RETURN _hit IS NOT NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.spend_match_key(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.spend_room_credit(text) FROM anon, authenticated;