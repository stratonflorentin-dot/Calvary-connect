-- Security hardening: pin a stable search_path on every public, non-extension
-- function that doesn't already set one (the advisor's function_search_path_mutable
-- warning). A mutable search_path lets a caller's search_path influence how
-- unqualified names resolve inside SECURITY DEFINER functions — a privilege-
-- escalation vector. Setting it to `public` (the schema these functions live in
-- and reference unqualified) closes that without requiring full qualification.
-- Idempotent and self-skipping: functions already pinned are excluded, and any
-- individual ALTER that fails is logged and skipped rather than failing the run.
do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    begin
      execute format('alter function public.%I(%s) set search_path = public', r.proname, r.args);
    exception when others then
      raise notice 'skip %(%): %', r.proname, r.args, sqlerrm;
    end;
  end loop;
end $$;
