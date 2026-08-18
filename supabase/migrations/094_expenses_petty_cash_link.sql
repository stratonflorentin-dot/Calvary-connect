-- Petty Cash debit entries (cash box or mobile money) posted a journal
-- entry but never created an `expenses` row, so a cashier's payments never
-- showed up on the main Expenses Management page — the same
-- linked-source-traceability gap Cash Requests' retirement already solved
-- via expenses.cash_request_id. Mirrors that pattern for Petty Cash.
alter table expenses add column if not exists petty_cash_transaction_id uuid references petty_cash_transactions(id);

NOTIFY pgrst, 'reload schema';
