-- Marking a payroll record "Paid" needs to know which bank account was
-- actually debited (same requirement expenses already have via
-- expenses.bank_account_id — see 035_post_bank_transaction_function.sql
-- and lib/workflow/engine.ts). driver_allowances had no such column, so
-- markPayrollPaidAction could only auto-pick "the one active account in
-- this currency" — which has been genuinely ambiguous for TZS since this
-- chart has two active TZS accounts (CRDB TZS and AIRTEL mobile money),
-- and the action correctly refused to guess rather than silently debiting
-- the wrong one.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE driver_allowances
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES bank_accounts(id);

NOTIFY pgrst, 'reload schema';
