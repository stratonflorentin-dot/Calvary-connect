-- Calvary Connect: SQL migrations confirmed missing from the connected
-- Supabase project's public.schema_migrations ledger (checked 2026-10-12).
-- Run this file in Supabase SQL Editor from top to bottom.
--
-- The ledger currently records migrations through 138_notebook_sources.sql.
-- Migrations 139, 140 and 141 were recorded as pending when this bundle was
-- assembled; migration 142 adds traffic fines and trip-linked driver expenses.
-- Each migration records itself in public.schema_migrations.
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


-- Included pending migration 142; run only if version 142 is absent from schema_migrations.

-- Track traffic penalties against the actual truck, responsible driver and trip.
-- Also ensure driver-submitted expenses can be tied to a trip and its vehicle.

alter table public.expenses
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists receipt_url text;

create index if not exists idx_expenses_vehicle_trip on public.expenses(vehicle_id, trip_id);

drop policy if exists expenses_write on public.expenses;
create policy expenses_write on public.expenses for insert
  with check (
    current_user_role() in ('CEO','ADMIN','ACCOUNTANT','OPERATOR','HR')
    or (current_user_role() = 'DRIVER' and driver_id = auth.uid()::text)
  );

create table if not exists public.traffic_fines (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  driver_id uuid not null references public.user_profiles(id) on delete restrict,
  trip_id uuid references public.trips(id) on delete set null,
  fine_date date not null default current_date,
  location text,
  issuing_authority text not null default 'Traffic Police',
  notice_number text,
  offence text not null,
  amount numeric(15,2) not null check (amount > 0),
  currency text not null default 'TZS',
  status text not null default 'unpaid' check (status in ('unpaid','paid','disputed','waived')),
  paid_date date,
  notes text,
  evidence_url text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_traffic_fines_vehicle_date on public.traffic_fines(vehicle_id, fine_date desc);
create index if not exists idx_traffic_fines_driver_date on public.traffic_fines(driver_id, fine_date desc);
create index if not exists idx_traffic_fines_status_date on public.traffic_fines(status, fine_date desc);

alter table public.traffic_fines enable row level security;
revoke all on public.traffic_fines from anon;
grant select, insert, update, delete on public.traffic_fines to authenticated;

drop policy if exists traffic_fines_read on public.traffic_fines;
create policy traffic_fines_read on public.traffic_fines for select to authenticated
  using (
    current_user_role() in ('CEO','ADMIN','OPERATOR','ACCOUNTANT','HR')
    or (current_user_role() = 'DRIVER' and driver_id = auth.uid())
  );
drop policy if exists traffic_fines_insert on public.traffic_fines;
create policy traffic_fines_insert on public.traffic_fines for insert to authenticated
  with check (
    current_user_role() in ('CEO','ADMIN','OPERATOR','ACCOUNTANT','HR')
    or (current_user_role() = 'DRIVER' and driver_id = auth.uid() and created_by = auth.uid())
  );
drop policy if exists traffic_fines_update on public.traffic_fines;
create policy traffic_fines_update on public.traffic_fines for update to authenticated
  using (current_user_role() in ('CEO','ADMIN','OPERATOR','ACCOUNTANT','HR'))
  with check (current_user_role() in ('CEO','ADMIN','OPERATOR','ACCOUNTANT','HR'));
drop policy if exists traffic_fines_delete on public.traffic_fines;
create policy traffic_fines_delete on public.traffic_fines for delete to authenticated
  using (current_user_role() in ('CEO','ADMIN'));

insert into public.schema_migrations(version)
values ('142_traffic_fines_and_driver_trip_expenses.sql')
on conflict (version) do nothing;

notify pgrst, 'reload schema';


-- Included pending migration 143; required for driver receipt attachment.

-- Allow a driver to attach a receipt to their own already-synced expense,
-- without granting permission to edit financial fields on expenses.
create or replace function public.attach_driver_expense_receipt(
  p_expense_id uuid,
  p_receipt_url text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_receipt_url is null or length(trim(p_receipt_url)) = 0 then
    raise exception 'Receipt URL is required';
  end if;

  update public.expenses
     set receipt_url = p_receipt_url,
         updated_at = now()
   where id = p_expense_id
     and driver_id = auth.uid()::text;

  if not found then
    raise exception 'Expense was not found for this driver';
  end if;
end;
$$;

revoke all on function public.attach_driver_expense_receipt(uuid, text) from public, anon;
grant execute on function public.attach_driver_expense_receipt(uuid, text) to authenticated;

insert into public.schema_migrations(version)
values ('143_driver_expense_receipt_rpc.sql')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
