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
