-- Day-End Closings / period lock. The enforcement already existed and was
-- already correctly wired: post_journal_entry() has called is_period_open()
-- as a guard since before this session — fiscal_periods + is_period_open()
-- already block posting into a closed period at the one true posting
-- choke-point, not just the UI.
--
-- What was missing turned out to be more subtle than "build it from
-- scratch": close_fiscal_period(year, month, p_lock) already existed with a
-- richer 3-state model (open/closed/locked) than a first pass at this
-- migration built blind, but it could never have actually run —
-- ON CONFLICT (year, month) inside it requires a unique constraint that
-- didn't exist. This migration adds that constraint (making the existing
-- function actually work for the first time) and consolidates
-- reopen_fiscal_period onto a single reason-required signature, replacing
-- an earlier reason-less version that was equally never-exercised.

-- One row per (year, month) so ON CONFLICT (year, month) in
-- close_fiscal_period actually works.
alter table fiscal_periods add constraint fiscal_periods_year_month_unique unique (year, month);

create or replace function public.reopen_fiscal_period(p_year integer, p_month integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user_role() not in ('CEO','ADMIN') then
    raise exception 'Only CEO/ADMIN can reopen periods';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to reopen a closed period';
  end if;

  update fiscal_periods set status = 'open', closed_by = auth.uid(), closed_at = now()
  where year = p_year and month = p_month and status <> 'locked';
  if not found then
    raise exception 'Period not found or locked';
  end if;

  insert into audit_trail (user_id, module, action, entity_type, description)
  values (auth.uid(), 'finance', 'update', 'fiscal_period', format('Reopened fiscal period %s-%s: %s', p_year, p_month, p_reason));
end;
$$;

NOTIFY pgrst, 'reload schema';
