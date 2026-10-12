-- Private event table backing Supabase Realtime notifications for admin API health.
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
