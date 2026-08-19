-- Expense Categories: a real category table with a default COA account,
-- replacing free-text `expenses.category` for new entries (the old text
-- column stays untouched — nothing currently reads it depends on this).
create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_account_code text references accounts(code),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_expense_categories_updated_at on expense_categories;
create trigger trg_expense_categories_updated_at
  before update on expense_categories
  for each row execute function set_updated_at();

alter table expense_categories enable row level security;
drop policy if exists expense_categories_read on expense_categories;
create policy expense_categories_read on expense_categories for select using (auth.uid() is not null);
drop policy if exists expense_categories_write on expense_categories;
create policy expense_categories_write on expense_categories for all
  using (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'))
  with check (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'));

alter table expenses
  add column if not exists category_id uuid references expense_categories(id),
  add column if not exists supplier_id uuid references suppliers(id),
  add column if not exists vat_amount numeric not null default 0,
  add column if not exists is_zero_rated boolean not null default false;

-- Cash request retirement, itemized: a lump actual_spent/one-account
-- retirement can't represent "this advance covered both fuel and tolls".
-- Each line becomes its own expense row (cash_request_id already links
-- expenses back to the request) plus its own line here for a structured,
-- auditable breakdown distinct from the free-text retirement_notes.
create table if not exists cash_request_retirement_lines (
  id uuid primary key default gen_random_uuid(),
  cash_request_id uuid not null references cash_requests(id),
  account_code text not null references accounts(code),
  amount numeric not null check (amount > 0),
  description text,
  receipt_url text,
  expense_id uuid references expenses(id),
  journal_entry_id uuid references journal_entries(id),
  created_at timestamptz not null default now()
);

alter table cash_request_retirement_lines enable row level security;
drop policy if exists cash_request_retirement_lines_all on cash_request_retirement_lines;
create policy cash_request_retirement_lines_all on cash_request_retirement_lines for all
  using (
    exists (select 1 from cash_requests cr where cr.id = cash_request_id and (cr.requester_id = auth.uid() or current_user_role() in ('CEO','ADMIN','ACCOUNTANT','OPERATOR')))
  )
  with check (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'));

-- Due-back date + overdue tracking: set on disbursement (7 days out),
-- read directly rather than computed live so the list page can filter on
-- it with a plain query.
alter table cash_requests
  add column if not exists due_back_date date;

NOTIFY pgrst, 'reload schema';
