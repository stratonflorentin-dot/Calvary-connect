-- A petty cash debit can now be paid either from the physical cash box
-- (unchanged: Dr Expense / Cr Petty Cash, affects running_balance) or
-- directly via a mobile money account like AIRTEL (Dr Expense / Cr that
-- account, a REAL withdrawal via post_bank_transaction against its own
-- balance — does NOT touch the cash box's running_balance, since it's a
-- different pool of money). Both still show in the same ledger for the
-- cashier's visibility.

alter table petty_cash_transactions
  add column payment_method text not null default 'cash' check (payment_method in ('cash', 'mobile_money')),
  add column mobile_money_account_id uuid references bank_accounts(id);

NOTIFY pgrst, 'reload schema';
