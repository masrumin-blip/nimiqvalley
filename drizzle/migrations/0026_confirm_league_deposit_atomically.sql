CREATE OR REPLACE FUNCTION public.confirm_league_deposit(p_pending uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

REVOKE ALL ON FUNCTION public.confirm_league_deposit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_league_deposit(uuid) TO service_role;