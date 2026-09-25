-- lovable-cron-fallback-reviewed: queue-backed; armed on enqueue, unscheduled by the route once no pending deposits/purchases remain
CREATE TABLE IF NOT EXISTS public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug text NOT NULL,
  creator_wallet text NOT NULL,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  payout text NOT NULL DEFAULT 'winner',
  token text NOT NULL DEFAULT 'nim',
  pool numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leagues TO anon, authenticated;
GRANT ALL ON public.leagues TO service_role;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leagues readable" ON public.leagues;
CREATE POLICY "leagues readable" ON public.leagues FOR SELECT TO anon, authenticated USING (status <> 'draft');

CREATE TABLE IF NOT EXISTS public.league_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  amount numeric NOT NULL,
  tx_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.league_deposits TO service_role;
ALTER TABLE public.league_deposits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.league_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  best numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, wallet)
);
GRANT SELECT ON public.league_scores TO anon, authenticated;
GRANT ALL ON public.league_scores TO service_role;
ALTER TABLE public.league_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "league scores readable" ON public.league_scores;
CREATE POLICY "league scores readable" ON public.league_scores FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.league_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  ranks integer[] NOT NULL DEFAULT '{}',
  amount numeric NOT NULL,
  to_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, wallet)
);
GRANT ALL ON public.league_payouts TO service_role;
ALTER TABLE public.league_payouts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.game_run_sessions ADD COLUMN IF NOT EXISTS league_id uuid;

CREATE OR REPLACE FUNCTION public.leagues_lock_terms()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
END $$;
DROP TRIGGER IF EXISTS leagues_lock_terms ON public.leagues;
CREATE TRIGGER leagues_lock_terms BEFORE UPDATE ON public.leagues FOR EACH ROW EXECUTE FUNCTION public.leagues_lock_terms();

CREATE OR REPLACE FUNCTION public.add_league_deposit(p_league uuid, p_wallet text, p_amount numeric, p_tx text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pool numeric;
BEGIN
  INSERT INTO public.league_deposits (league_id, wallet, amount, tx_hash) VALUES (p_league, p_wallet, p_amount, p_tx);
  UPDATE public.leagues SET pool = pool + p_amount, status = 'active' WHERE id = p_league RETURNING pool INTO _pool;
  RETURN _pool;
END $$;
REVOKE ALL ON FUNCTION public.add_league_deposit(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_league_deposit(uuid, text, numeric, text) TO service_role;

CREATE TABLE IF NOT EXISTS public.league_pending_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  amount numeric NOT NULL,
  token text NOT NULL DEFAULT 'nim',
  tx_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.league_pending_deposits TO service_role;
ALTER TABLE public.league_pending_deposits ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS league_pending_deposits_status_idx ON public.league_pending_deposits (status, league_id);

CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  kind text not null check (kind in ('chat','key','room')),
  pack_id text,
  chats integer not null default 0,
  keys integer not null default 0,
  rooms integer not null default 0,
  token text not null check (token in ('nim','usdt')),
  amount numeric not null,
  memo text not null,
  tx_hash text unique,
  status text not null default 'quoted' check (status in ('quoted','pending','confirmed','failed')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT ALL ON public.credit_purchases TO service_role;
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS credit_purchases_status_idx ON public.credit_purchases(status);

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.arm_league_deposit_checker()
returns trigger language plpgsql security definer set search_path = public, cron as $f$
begin
  if not exists (select 1 from cron.job where jobname = 'league-deposits-check') then
    perform cron.schedule('league-deposits-check', '*/2 * * * *', $job$
      select net.http_post(
        url:='https://project--8f661aa4-9125-4496-ba9a-21a58fa84bff.lovable.app/api/public/cron/league-deposits',
        headers:='{"Content-Type":"application/json","apikey":"sb_publishable_W_kFuKn6iLxLiKpzID1h_w_XQ23qnm7"}'::jsonb,
        body:='{}'::jsonb);
    $job$);
  end if;
  return new;
end $f$;
revoke all on function public.arm_league_deposit_checker() from public, anon, authenticated;

create or replace function public.disarm_league_deposit_checker()
returns void language plpgsql security definer set search_path = public, cron as $f$
begin
  if not exists (select 1 from public.league_pending_deposits where status = 'pending')
     and not exists (select 1 from public.credit_purchases where status = 'pending')
     and exists (select 1 from cron.job where jobname = 'league-deposits-check') then
    perform cron.unschedule('league-deposits-check');
  end if;
end $f$;
revoke all on function public.disarm_league_deposit_checker() from public, anon, authenticated;
grant execute on function public.disarm_league_deposit_checker() to service_role;

drop trigger if exists league_pending_arm on public.league_pending_deposits;
create trigger league_pending_arm after insert on public.league_pending_deposits
for each row when (new.status = 'pending') execute function public.arm_league_deposit_checker();

CREATE OR REPLACE FUNCTION public.confirm_league_deposit(p_pending uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _pending public.league_pending_deposits%ROWTYPE;
  _pool numeric;
BEGIN
  SELECT * INTO _pending FROM public.league_pending_deposits WHERE id = p_pending FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending deposit not found'; END IF;
  IF _pending.status = 'confirmed' THEN
    SELECT pool INTO _pool FROM public.leagues WHERE id = _pending.league_id;
    RETURN _pool;
  END IF;
  IF _pending.status <> 'pending' THEN RAISE EXCEPTION 'Deposit is not pending'; END IF;
  INSERT INTO public.league_deposits (league_id, wallet, amount, tx_hash)
  VALUES (_pending.league_id, _pending.wallet, _pending.amount, _pending.tx_hash)
  ON CONFLICT (tx_hash) DO NOTHING;
  IF FOUND THEN
    UPDATE public.leagues SET pool = pool + _pending.amount, status = 'active'
    WHERE id = _pending.league_id RETURNING pool INTO _pool;
  ELSE
    SELECT pool INTO _pool FROM public.leagues WHERE id = _pending.league_id;
  END IF;
  UPDATE public.league_pending_deposits SET status = 'confirmed', updated_at = now() WHERE id = _pending.id;
  RETURN _pool;
END
$function$;
REVOKE ALL ON FUNCTION public.confirm_league_deposit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_league_deposit(uuid) TO service_role;

create or replace function public.confirm_credit_purchase(p_id uuid)
returns text language plpgsql security definer set search_path = public as $f$
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
end $f$;
revoke all on function public.confirm_credit_purchase(uuid) from public, anon, authenticated;
grant execute on function public.confirm_credit_purchase(uuid) to service_role;

drop trigger if exists credit_purchase_arm on public.credit_purchases;
create trigger credit_purchase_arm after insert or update of status on public.credit_purchases
for each row when (new.status = 'pending') execute function public.arm_league_deposit_checker();