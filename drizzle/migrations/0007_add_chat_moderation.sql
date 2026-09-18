CREATE TABLE public.chat_moderation (
  wallet text PRIMARY KEY,
  profanity_count integer NOT NULL DEFAULT 0 CHECK (profanity_count >= 0),
  warning_window_started_at timestamptz,
  muted_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.chat_moderation TO service_role;

ALTER TABLE public.chat_moderation ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.moderate_chat_submission(
  _wallet text,
  _normalized_text text,
  _is_profane boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _state public.chat_moderation%ROWTYPE;
  _now timestamptz := now();
  _recent_count integer := 0;
  _duplicate_count integer := 0;
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
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'muted',
      'mutedUntil', _state.muted_until
    );
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
          THEN _now
          ELSE _state.warning_window_started_at
        END,
        muted_until = _mute_until,
        updated_at = _now
    WHERE wallet = _wallet;

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'profanity',
      'warningCount', _new_count,
      'mutedUntil', _mute_until
    );
  END IF;

  SELECT count(*) INTO _recent_count
  FROM (
    SELECT created_at FROM public.chat_messages
    WHERE wallet = _wallet AND created_at > _now - interval '10 seconds'
    UNION ALL
    SELECT created_at FROM public.chat_dms
    WHERE from_wallet = _wallet AND created_at > _now - interval '10 seconds'
  ) recent_messages;

  SELECT count(*) INTO _duplicate_count
  FROM (
    SELECT text FROM public.chat_messages
    WHERE wallet = _wallet AND created_at > _now - interval '2 minutes'
    UNION ALL
    SELECT text FROM public.chat_dms
    WHERE from_wallet = _wallet AND created_at > _now - interval '2 minutes'
  ) recent_texts
  WHERE lower(regexp_replace(text, '[^[:alnum:]]', '', 'g')) = _normalized_text;

  IF _recent_count >= 3 OR _duplicate_count > 0 THEN
    _mute_until := _now + interval '5 minutes';
    UPDATE public.chat_moderation
    SET muted_until = _mute_until,
        updated_at = _now
    WHERE wallet = _wallet;

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', CASE WHEN _duplicate_count > 0 THEN 'duplicate' ELSE 'spam' END,
      'mutedUntil', _mute_until
    );
  END IF;

  UPDATE public.chat_moderation
  SET muted_until = NULL,
      updated_at = _now
  WHERE wallet = _wallet;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_chat_submission(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderate_chat_submission(text, text, boolean) TO service_role;