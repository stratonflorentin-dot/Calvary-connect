-- Finishes the dormant cash_requests table (id/request_number/requester_id/
-- trip_id/amount/purpose/status only, zero rows) into a real petty-cash
-- lifecycle: draft -> pending -> approved -> disbursed -> retired, with
-- rejected as a branch from pending. Disbursement and retirement both post
-- real ledger entries (see engine.ts) rather than writing balances directly,
-- per the "every transactional screen posts through Journal Entries" rule —
-- disbursement reuses post_bank_transaction (Dr 1110 Driver Float/Staff
-- Advance / Cr the disbursing bank account), retirement posts a manual
-- balanced entry (Dr the chosen expense account / Cr 1110) plus, if any
-- cash was physically returned, a second post_bank_transaction leg (Dr bank
-- / Cr 1110) for the returned portion.
--
-- Two-person "2nd approval" for large requests is deliberately NOT a
-- separate state — it's handled by the same amount-tiered approvalRules
-- (spendTiers) already gating fuel_request/expense approval, so a bigger
-- request just needs a more senior role, without inventing a parallel
-- approval mechanism for one entity kind.

insert into document_sequences (doc_type, prefix, next_number, padding)
values ('cash_request', 'CR-', 1, 5)
on conflict (doc_type) do nothing;

alter table cash_requests
  add column if not exists currency text not null default 'TZS',
  add column if not exists approved_by uuid references user_profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_reason text,
  add column if not exists disbursed_by uuid references user_profiles(id),
  add column if not exists disbursed_at timestamptz,
  add column if not exists disbursed_from_account_id uuid references bank_accounts(id),
  add column if not exists disbursement_bank_transaction_id uuid references bank_transactions(id),
  add column if not exists retired_by uuid references user_profiles(id),
  add column if not exists retired_at timestamptz,
  add column if not exists actual_spent numeric,
  add column if not exists returned_amount numeric,
  add column if not exists return_bank_account_id uuid references bank_accounts(id),
  add column if not exists return_bank_transaction_id uuid references bank_transactions(id),
  add column if not exists retirement_notes text,
  add column if not exists retirement_expense_id uuid references expenses(id),
  add column if not exists retirement_journal_entry_id uuid references journal_entries(id),
  add column if not exists updated_at timestamptz not null default now();

alter table cash_requests
  drop constraint if exists cash_requests_status_check,
  add constraint cash_requests_status_check check (status in ('draft','pending','approved','rejected','disbursed','retired'));

alter table cash_requests alter column status set default 'draft';

drop trigger if exists trg_cash_requests_updated_at on cash_requests;
create trigger trg_cash_requests_updated_at
  before update on cash_requests
  for each row execute function set_updated_at();

drop policy if exists cash_requests_all on cash_requests;
create policy cash_requests_all on cash_requests
  for all using (requester_id = auth.uid() or current_user_role() in ('CEO','ADMIN','ACCOUNTANT','OPERATOR'))
  with check (requester_id = auth.uid() or current_user_role() in ('CEO','ADMIN','ACCOUNTANT','OPERATOR'));

-- Linked-source traceability: an expense generated from a cash request's
-- retirement carries a reference back to it.
alter table expenses add column if not exists cash_request_id uuid references cash_requests(id);

NOTIFY pgrst, 'reload schema';
