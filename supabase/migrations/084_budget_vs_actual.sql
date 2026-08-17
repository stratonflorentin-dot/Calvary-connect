-- The `budgets` table already existed (category_id -> financial_categories,
-- vehicle_id -> vehicles, department, amount, spent_amount, period_type,
-- status) but had zero rows, no RLS policies (locked to everyone), and no
-- CHECK constraints — clearly planned but never finished, same pattern as
-- the dead `allowances` table found earlier. This finishes it: real
-- constraints, real RLS, and spent_amount gets computed from actual paid
-- expenses (matched by category name + optional vehicle) by the API route
-- rather than a fragile trigger on every expense write.

alter table budgets
  add constraint budgets_period_type_check check (period_type in ('monthly','quarterly','annual','custom')),
  add constraint budgets_status_check check (status in ('draft','active','closed'));

alter table budgets alter column status set default 'draft';

create policy budgets_read on budgets
  for select using (current_user_role() in ('CEO','ADMIN','ACCOUNTANT','HR'));

create policy budgets_write on budgets
  for all using (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'))
  with check (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'));
