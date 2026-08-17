-- ── Document sequences for new case types ──────────────────────────────────
insert into document_sequences (doc_type, prefix, next_number, padding)
values ('disciplinary_case', 'DISC-', 1, 5), ('separation_case', 'SEP-', 1, 5)
on conflict (doc_type) do nothing;

-- ── Disciplinary cases ──────────────────────────────────────────────────────
-- Reported -> Investigating -> Hearing -> Resolved, with Withdraw as a
-- side-branch. Minor cases can resolve straight from Investigating without a
-- hearing (guarded in the workflow machine, not here).
create table disciplinary_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  employee_id uuid not null references user_profiles(id),
  category text not null check (category in ('attendance','conduct','safety','policy_violation','performance','other')),
  description text not null,
  incident_date date not null,
  reported_by uuid not null references user_profiles(id),
  severity text not null check (severity in ('minor','moderate','major','gross_misconduct')),
  status text not null default 'reported' check (status in ('reported','investigating','hearing','resolved','withdrawn')),
  hearing_date date,
  outcome text check (outcome in ('verbal_warning','written_warning','final_warning','suspension','termination','no_action')),
  outcome_notes text,
  suspension_days integer,
  attachment_url text,
  resolved_by uuid references user_profiles(id),
  resolved_at timestamptz,
  created_by uuid not null references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_disciplinary_cases_employee on disciplinary_cases(employee_id);
create index idx_disciplinary_cases_status on disciplinary_cases(status);

create trigger trg_disciplinary_cases_updated_at
  before update on disciplinary_cases
  for each row execute function set_updated_at();

alter table disciplinary_cases enable row level security;

create policy disciplinary_cases_read on disciplinary_cases
  for select using (employee_id = auth.uid() or current_user_role() in ('CEO','ADMIN','HR'));

create policy disciplinary_cases_write on disciplinary_cases
  for all using (current_user_role() in ('CEO','ADMIN','HR'))
  with check (current_user_role() in ('CEO','ADMIN','HR'));

-- ── Separation / exit cases ──────────────────────────────────────────────────
-- Initiated -> Clearance in progress -> Pending final pay -> Completed, with
-- Cancel as a side-branch from the first two states. Final pay itself is
-- computed as a plain data action (not a status transition) from real
-- employee_compensation + employee_loans rows, then raised as a normal
-- `expenses` row so it flows through the existing approve/pay/ledger path —
-- no parallel payment-posting logic.
create table separation_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  employee_id uuid not null references user_profiles(id),
  separation_type text not null check (separation_type in ('resignation','termination','end_of_contract','retirement','redundancy')),
  reason text,
  disciplinary_case_id uuid references disciplinary_cases(id),
  notice_date date not null,
  last_working_day date not null,
  status text not null default 'initiated' check (status in ('initiated','clearance_in_progress','pending_final_pay','completed','cancelled')),
  initiated_by uuid not null references user_profiles(id),
  clearance_it boolean not null default false,
  clearance_assets boolean not null default false,
  clearance_finance boolean not null default false,
  exit_interview_notes text,
  exit_interview_completed_at timestamptz,
  final_pay_breakdown jsonb,
  final_pay_computed_at timestamptz,
  final_pay_computed_by uuid references user_profiles(id),
  final_pay_expense_id uuid references expenses(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_separation_cases_employee on separation_cases(employee_id);
create index idx_separation_cases_status on separation_cases(status);

create trigger trg_separation_cases_updated_at
  before update on separation_cases
  for each row execute function set_updated_at();

alter table separation_cases enable row level security;

create policy separation_cases_read on separation_cases
  for select using (employee_id = auth.uid() or current_user_role() in ('CEO','ADMIN','HR','ACCOUNTANT'));

create policy separation_cases_write on separation_cases
  for all using (current_user_role() in ('CEO','ADMIN','HR','ACCOUNTANT'))
  with check (current_user_role() in ('CEO','ADMIN','HR','ACCOUNTANT'));

-- ── Persisted KPI / performance reviews ──────────────────────────────────────
-- performance_reviews already existed (bare rating+text). Extend it with a
-- real draft -> submitted -> acknowledged lifecycle and a flexible KPI-score
-- map instead of inventing a fixed rubric that wouldn't fit every role.
alter table performance_reviews
  add column if not exists status text not null default 'draft' check (status in ('draft','submitted','acknowledged')),
  add column if not exists review_period_start date,
  add column if not exists review_period_end date,
  add column if not exists kpi_scores jsonb not null default '{}'::jsonb,
  add column if not exists submitted_at timestamptz,
  add column if not exists employee_acknowledged_at timestamptz,
  add column if not exists employee_comments text,
  add column if not exists updated_at timestamptz not null default now();

create trigger trg_performance_reviews_updated_at
  before update on performance_reviews
  for each row execute function set_updated_at();

-- Existing "performance_reviews_all" policy (CEO/ADMIN/HR, all commands)
-- stays as-is. Add a narrow self-select so the reviewed employee can see
-- (never edit directly) their own review — but not while it's still a draft,
-- since HR may not be done writing it yet.
create policy performance_reviews_self_select on performance_reviews
  for select using (employee_id = auth.uid() and status <> 'draft');

-- Employee acknowledgement has to touch employee_acknowledged_at/comments/
-- status on a row the employee doesn't otherwise have UPDATE rights on, and
-- Postgres RLS can't restrict *which columns* an UPDATE touches — same
-- constraint that drove fuel_anomalies.driver_response onto a SECURITY
-- DEFINER RPC rather than a column-scoped RLS policy. Same fix here.
create or replace function acknowledge_performance_review(p_review_id uuid, p_comments text default null)
returns public.performance_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.performance_reviews;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_row from performance_reviews where id = p_review_id;
  if v_row.id is null then
    raise exception 'Review not found';
  end if;
  if v_row.employee_id <> auth.uid() then
    raise exception 'Only the reviewed employee can acknowledge this review';
  end if;
  if v_row.status <> 'submitted' then
    raise exception 'Review is not awaiting acknowledgement (status: %)', v_row.status;
  end if;

  update performance_reviews
     set status = 'acknowledged',
         employee_acknowledged_at = now(),
         employee_comments = p_comments,
         updated_at = now()
   where id = p_review_id
   returning * into v_row;

  return v_row;
end;
$$;
