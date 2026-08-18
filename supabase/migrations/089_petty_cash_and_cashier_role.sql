-- Petty Cash: a simple debit/credit ledger for a cash box a Cashier
-- operates directly (tolls, small purchases), distinct from Cash Requests'
-- multi-step advance/retire/approval workflow — this is "record what
-- already happened," not "request permission first." Still posts through
-- real journal entries, same as every other money-moving feature in this
-- session: a debit (cash paid out) posts Dr [expense account] / Cr Petty
-- Cash; a credit (box replenished from a bank withdrawal) posts Dr Petty
-- Cash / Cr Bank via post_bank_transaction, same as Cash Requests'
-- disbursement leg.

insert into document_sequences (doc_type, prefix, next_number, padding)
values ('petty_cash', 'PC-', 1, 5)
on conflict (doc_type) do nothing;

create table petty_cash_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_number text not null unique,
  transaction_date date not null default current_date,
  type text not null check (type in ('debit', 'credit')),
  amount numeric not null check (amount > 0),
  description text not null,
  -- debit: the expense account the payment belongs to (e.g. Tolls & Road
  -- Charges). credit: null — the contra side is always the funding bank
  -- account, tracked separately below.
  contra_account_code text,
  reference text,
  -- Denormalized running balance of the box after this entry, computed at
  -- insert time from the prior total — read-heavy (every list view), so
  -- worth caching rather than summing the whole table on every render.
  running_balance numeric not null,
  journal_entry_id uuid references journal_entries(id),
  funded_from_account_id uuid references bank_accounts(id),
  bank_transaction_id uuid references bank_transactions(id),
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create index idx_petty_cash_transactions_date on petty_cash_transactions(transaction_date desc);

alter table petty_cash_transactions enable row level security;

create policy petty_cash_transactions_all on petty_cash_transactions
  for all using (current_user_role() in ('CEO','ADMIN','ACCOUNTANT','CASHIER'))
  with check (current_user_role() in ('CEO','ADMIN','ACCOUNTANT','CASHIER'));

NOTIFY pgrst, 'reload schema';
