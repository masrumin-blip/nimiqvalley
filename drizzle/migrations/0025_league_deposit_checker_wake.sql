-- lovable-cron-fallback-reviewed: queue-backed; armed on enqueue, unscheduled by the route once no pending deposits remain
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.arm_league_deposit_checker()
returns trigger language plpgsql security definer set search_path = public, cron as $f$
begin
  if not exists (select 1 from cron.job where jobname = 'league-deposits-check') then
    perform cron.schedule('league-deposits-check', '*/2 * * * *', $job$
      select net.http_post(
        url:='https://project--7603a760-67d6-423b-9d7f-956918d5a40a.lovable.app/api/public/cron/league-deposits',
        headers:='{"Content-Type":"application/json","apikey":"sb_publishable_kKL8l5vPaP44yQ7CyTBv3A_KjGs0lYG"}'::jsonb,
        body:='{}'::jsonb);
    $job$);
  end if;
  return new;
end $f$;

create or replace function public.disarm_league_deposit_checker()
returns void language plpgsql security definer set search_path = public, cron as $f$
begin
  if not exists (select 1 from public.league_pending_deposits where status = 'pending')
     and exists (select 1 from cron.job where jobname = 'league-deposits-check') then
    perform cron.unschedule('league-deposits-check');
  end if;
end $f$;

revoke all on function public.disarm_league_deposit_checker() from public, anon, authenticated;
grant execute on function public.disarm_league_deposit_checker() to service_role;

drop trigger if exists league_pending_arm on public.league_pending_deposits;
create trigger league_pending_arm after insert on public.league_pending_deposits
for each row when (new.status = 'pending') execute function public.arm_league_deposit_checker();