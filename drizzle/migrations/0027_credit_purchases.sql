create table public.credit_purchases (
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
grant all on public.credit_purchases to service_role;
alter table public.credit_purchases enable row level security;
create index credit_purchases_status_idx on public.credit_purchases(status);

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

create or replace function public.disarm_league_deposit_checker()
returns void language plpgsql security definer set search_path = public, cron as $f$
begin
  if not exists (select 1 from public.league_pending_deposits where status = 'pending')
     and not exists (select 1 from public.credit_purchases where status = 'pending')
     and exists (select 1 from cron.job where jobname = 'league-deposits-check') then
    perform cron.unschedule('league-deposits-check');
  end if;
end $f$;

create trigger credit_purchase_arm after insert or update of status on public.credit_purchases
for each row when (new.status = 'pending') execute function public.arm_league_deposit_checker();