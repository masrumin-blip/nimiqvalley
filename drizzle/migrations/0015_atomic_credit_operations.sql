CREATE OR REPLACE FUNCTION public.spend_chat_credit(p_wallet TEXT, p_free_limit INTEGER)
RETURNS TABLE(
  source TEXT,
  wallet TEXT,
  chat_credits INTEGER,
  room_credits INTEGER,
  match_keys INTEGER,
  free_chats_date DATE,
  free_chats_used INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.wallet_credits%ROWTYPE;
BEGIN
  INSERT INTO public.wallet_credits (wallet, updated_at)
  VALUES (p_wallet, now())
  ON CONFLICT (wallet) DO NOTHING;

  UPDATE public.wallet_credits wc
  SET free_chats_date = CURRENT_DATE,
      free_chats_used = CASE
        WHEN wc.free_chats_date = CURRENT_DATE THEN wc.free_chats_used + 1
        ELSE 1
      END,
      updated_at = now()
  WHERE wc.wallet = p_wallet
    AND (wc.free_chats_date IS DISTINCT FROM CURRENT_DATE OR wc.free_chats_used < p_free_limit)
  RETURNING * INTO r;
  IF FOUND THEN
    source := 'free';
    wallet := r.wallet;
    chat_credits := r.chat_credits;
    room_credits := r.room_credits;
    match_keys := r.match_keys;
    free_chats_date := r.free_chats_date;
    free_chats_used := r.free_chats_used;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.wallet_credits wc
  SET chat_credits = wc.chat_credits - 1,
      updated_at = now()
  WHERE wc.wallet = p_wallet AND wc.chat_credits > 0
  RETURNING * INTO r;
  IF FOUND THEN
    source := 'paid';
    wallet := r.wallet;
    chat_credits := r.chat_credits;
    room_credits := r.room_credits;
    match_keys := r.match_keys;
    free_chats_date := r.free_chats_date;
    free_chats_used := r.free_chats_used;
    RETURN NEXT;
    RETURN;
  END IF;

  RAISE EXCEPTION 'NO_CHAT_CREDIT';
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_chat_credit(p_wallet TEXT, p_source TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_source = 'free' THEN
    UPDATE public.wallet_credits wc
    SET free_chats_used = GREATEST(0, wc.free_chats_used - 1), updated_at = now()
    WHERE wc.wallet = p_wallet AND wc.free_chats_date = CURRENT_DATE;
  ELSE
    UPDATE public.wallet_credits wc
    SET chat_credits = wc.chat_credits + 1, updated_at = now()
    WHERE wc.wallet = p_wallet;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_room_credit(p_wallet TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    WITH updated AS (
      UPDATE public.wallet_credits wc
      SET room_credits = wc.room_credits - 1, updated_at = now()
      WHERE wc.wallet = p_wallet AND wc.room_credits > 0
      RETURNING wc.wallet
    )
    SELECT 1 FROM updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_match_key(p_wallet TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    WITH updated AS (
      UPDATE public.wallet_credits wc
      SET match_keys = wc.match_keys - 1, updated_at = now()
      WHERE wc.wallet = p_wallet AND wc.match_keys > 0
      RETURNING wc.wallet
    )
    SELECT 1 FROM updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_room_entry(p_wallet TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.spend_match_key(p_wallet) THEN
    RETURN 'key';
  END IF;
  IF public.spend_room_credit(p_wallet) THEN
    RETURN 'room';
  END IF;
  RAISE EXCEPTION 'NO_ROOM_ENTRY';
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_credits(
  p_wallet TEXT,
  p_chat INTEGER DEFAULT 0,
  p_room INTEGER DEFAULT 0,
  p_key INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallet_credits (wallet, chat_credits, room_credits, match_keys, updated_at)
  VALUES (p_wallet, GREATEST(0, p_chat), GREATEST(0, p_room), GREATEST(0, p_key), now())
  ON CONFLICT (wallet) DO UPDATE
  SET chat_credits = GREATEST(0, public.wallet_credits.chat_credits + p_chat),
      room_credits = GREATEST(0, public.wallet_credits.room_credits + p_room),
      match_keys = GREATEST(0, public.wallet_credits.match_keys + p_key),
      updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_nim_payment(
  p_tx_hash TEXT,
  p_wallet TEXT,
  p_kind TEXT,
  p_nim NUMERIC,
  p_chat INTEGER DEFAULT 0,
  p_room INTEGER DEFAULT 0,
  p_key INTEGER DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.nim_payments (tx_hash, wallet, kind, nim, chat_credits, room_credits, key_credits)
  VALUES (p_tx_hash, p_wallet, p_kind, p_nim, COALESCE(p_chat, 0), COALESCE(p_room, 0), COALESCE(p_key, 0));

  INSERT INTO public.wallet_credits (wallet, updated_at)
  VALUES (p_wallet, now())
  ON CONFLICT (wallet) DO NOTHING;

  UPDATE public.wallet_credits
  SET chat_credits = chat_credits + COALESCE(p_chat, 0),
      room_credits = room_credits + COALESCE(p_room, 0),
      match_keys = match_keys + COALESCE(p_key, 0),
      updated_at = now()
  WHERE wallet = p_wallet;

  RETURN TRUE;
EXCEPTION
  WHEN unique_violation THEN
    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_chat_credit(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_chat_credit(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spend_room_credit(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spend_match_key(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spend_room_entry(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_credits(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_nim_payment(TEXT, TEXT, TEXT, NUMERIC, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.spend_chat_credit(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_chat_credit(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_room_credit(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_match_key(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_room_entry(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_nim_payment(TEXT, TEXT, TEXT, NUMERIC, INTEGER, INTEGER, INTEGER) TO service_role;