-- Full rebuild of bank statement import + reconciliation. `bank_statements`
-- was actually a flat line-level table (no header/period/status concept)
-- despite its name; `bank_reconciliations` was a non-blocking snapshot log
-- that never locked anything. Both tables were empty (0 rows) in production,
-- so this restructures rather than migrates. Only one page in the app
-- referenced these tables (bank-reconciliation/page.tsx), which is being
-- rewritten as part of this change.

insert into document_sequences (doc_type, prefix, next_number, padding)
values ('bank_statement', 'STMT-', 1, 5)
on conflict (doc_type) do nothing;

-- ── Statement batches (the "BankStatement" header) ──────────────────────────
create table bank_statement_batches (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  bank_account_id uuid not null references bank_accounts(id),
  period_from date not null,
  period_to date not null,
  opening_balance numeric,
  closing_balance numeric,
  status text not null default 'draft' check (status in ('draft', 'posted')),
  -- Denormalized summary, recomputed by the app whenever a line's
  -- match_status changes — same write-through pattern as budgets.spent_amount,
  -- chosen over a per-write trigger and used by the Post transition's guard
  -- since workflow-engine guards are synchronous and can't query lines
  -- themselves.
  open_line_count integer not null default 0,
  difference numeric not null default 0,
  notes text,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bank_statement_batches_account on bank_statement_batches(bank_account_id);

create trigger trg_bank_statement_batches_updated_at
  before update on bank_statement_batches
  for each row execute function set_updated_at();

alter table bank_statement_batches enable row level security;

create policy bank_statement_batches_read on bank_statement_batches
  for select using (auth.uid() is not null);

create policy bank_statement_batches_write on bank_statement_batches
  for insert with check (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'));

create policy bank_statement_batches_update on bank_statement_batches
  for update using (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'))
  with check (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'));

create policy bank_statement_batches_delete on bank_statement_batches
  for delete using (current_user_role() in ('CEO','ADMIN') and status = 'draft');

-- ── Rename the old flat line table into the batch's children ───────────────
alter table bank_statements rename to bank_statement_lines;

alter table bank_statement_lines
  add column bank_statement_batch_id uuid references bank_statement_batches(id) on delete cascade,
  add column match_status text not null default 'unmatched' check (match_status in ('unmatched','matched','confirmed','ignored')),
  add column matched_by uuid references user_profiles(id),
  add column matched_at timestamptz;

-- Backfill match_status from the old boolean for consistency, then the
-- column is superseded entirely — only one page ever read `reconciled` and
-- it's being rewritten to use match_status.
update bank_statement_lines set match_status = 'confirmed' where reconciled = true;
alter table bank_statement_lines drop column reconciled;

create index idx_bank_statement_lines_batch on bank_statement_lines(bank_statement_batch_id);
create index idx_bank_statement_lines_match_status on bank_statement_lines(match_status);

-- ── Split / partial matching ────────────────────────────────────────────────
create table reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  bank_statement_line_id uuid not null references bank_statement_lines(id) on delete cascade,
  matched_entity_type text not null check (matched_entity_type in ('invoice_payment','expense','journal_line')),
  matched_entity_id uuid not null,
  matched_amount numeric not null,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create index idx_reconciliation_matches_line on reconciliation_matches(bank_statement_line_id);

alter table reconciliation_matches enable row level security;

create policy reconciliation_matches_read on reconciliation_matches
  for select using (auth.uid() is not null);

create policy reconciliation_matches_write on reconciliation_matches
  for all using (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'))
  with check (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'));

drop table if exists bank_reconciliations;

NOTIFY pgrst, 'reload schema';
