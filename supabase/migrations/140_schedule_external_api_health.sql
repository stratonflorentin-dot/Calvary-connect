-- Configure the two named Vault secrets below before invoking the scheduler.
-- pg_cron creates its own `cron` schema on Supabase; keep its default schema.
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
