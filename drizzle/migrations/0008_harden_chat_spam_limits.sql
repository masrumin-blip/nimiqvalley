ALTER TABLE public.chat_moderation
  ADD COLUMN submission_times timestamptz[] NOT NULL DEFAULT '{}',
  ADD COLUMN last_normalized_text text,
  ADD COLUMN last_message_at timestamptz;

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

REVOKE ALL ON FUNCTION public.moderate_chat_submission(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderate_chat_submission(text, text, boolean) TO service_role;