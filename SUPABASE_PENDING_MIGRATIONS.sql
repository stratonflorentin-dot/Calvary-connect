-- Calvary Connect: SQL migrations confirmed missing from the connected
-- Supabase project's public.schema_migrations ledger (checked 2026-10-12).
-- Run this file in Supabase SQL Editor from top to bottom.
--
-- The ledger currently records migrations through 138_notebook_sources.sql.
-- These three migrations are absent: 139, 140, and the new 141 trip-fuel
-- telemetry migration. Each records itself in public.schema_migrations.
--
-- Scope note: older migration files 066-109 and 113-136 do not record
-- themselves in this ledger, so this query cannot establish whether they were
-- run. They are intentionally not copied here; some contain cleanup or DROP
-- statements and must not be rerun based only on missing ledger rows.

-- ==========================================================================
-- 139_external_api_health_events.sql
-- ==========================================================================
create table if not exists public.api_health_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('api_health_events', 'cache_invalidations', 'rate_limit_events')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.api_health_events enable row level security;
revoke all on public.api_health_events from anon, authenticated;
grant select on public.api_health_events to authenticated;
grant all on public.api_health_events to service_role;

drop policy if exists api_health_events_admin_read on public.api_health_events;
create policy api_health_events_admin_read on public.api_health_events
  for select to authenticated using (current_user_role() in ('CEO', 'ADMIN'));

do $$ begin
  alter publication supabase_realtime add table public.api_health_events;
exception when duplicate_object then null;
end $$;

create index if not exists api_health_events_created_at_idx on public.api_health_events (created_at desc);

insert into public.schema_migrations (version) values ('139_external_api_health_events.sql') on conflict (version) do nothing;
notify pgrst, 'reload schema';

-- ==========================================================================
-- 140_schedule_external_api_health.sql
-- ==========================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.schedule_external_api_health_check()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, cron, net, vault
as $$
declare secret_count integer;
begin
  select count(*) into secret_count
  from vault.decrypted_secrets
  where name in ('supabase_functions_url', 'external_health_check_secret');
  if secret_count < 2 then
    raise exception 'Configure supabase_functions_url and external_health_check_secret in Supabase Vault first.';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'external-api-health-check';
  perform cron.schedule(
    'external-api-health-check',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_functions_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'external_health_check_secret')
        ),
        body := jsonb_build_object('source', 'pg_cron')
      );
    $job$
  );
end $$;

revoke all on function public.schedule_external_api_health_check() from public, anon, authenticated;
grant execute on function public.schedule_external_api_health_check() to postgres, service_role;

insert into public.schema_migrations (version) values ('140_schedule_external_api_health.sql') on conflict (version) do nothing;
notify pgrst, 'reload schema';

-- Before enabling the schedule, add these two named secrets in Supabase
-- Vault: supabase_functions_url and external_health_check_secret.
-- Then run this separately to schedule the five-minute check:
-- select public.schedule_external_api_health_check();

-- ==========================================================================
-- 141_trip_fuel_telemetry_tracking.sql
-- ==========================================================================
alter table public.vehicle_telemetry_history
  add column if not exists trip_id uuid references public.trips(id) on delete set null;

create index if not exists idx_vehicle_telemetry_trip_vehicle_time
  on public.vehicle_telemetry_history (trip_id, vehicle_id, recorded_at)
  where trip_id is not null;

insert into public.schema_migrations (version)
values ('141_trip_fuel_telemetry_tracking.sql')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

-- Verify the migrations were recorded after the statements above complete.
select version, applied_at
from public.schema_migrations
where version in (
  '139_external_api_health_events.sql',
  '140_schedule_external_api_health.sql',
  '141_trip_fuel_telemetry_tracking.sql'
)
order by version;
