-- Expenses could be entered in any currency but never recorded which real
-- bank/mobile-money account actually paid them — no way to know, and no
-- explicit choice at entry time. This also matters more now that this
-- chart has two active TZS accounts (CRDB TZS and AIRTEL): the expense
-- ->paid workflow transition (engine.ts) auto-picks "the" account for a
-- currency and requires exactly one match, which is now ambiguous for TZS
-- unless the expense says which one it means.
alter table expenses add column if not exists bank_account_id uuid references bank_accounts(id);

NOTIFY pgrst, 'reload schema';
