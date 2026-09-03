-- Part of the finance one-door-per-direction fix: /expenses (previously
-- reachable by CEO/ADMIN/ACCOUNTANT/OPERATOR/HR, per route-config.ts) is
-- now a read-only register — its raw insert/update calls were removed,
-- with a "New expense"/"Edit" link pointing at
-- /finance/transactions/expenses instead, which correctly also creates the
-- paired vendor_bills row when needed.
--
-- That route's allowedRoles was CEO/ADMIN/ACCOUNTANT only, so OPERATOR/HR
-- would otherwise lose the ability to log an expense entirely. Widening
-- expenses_write/expenses_update (034_lock_down_finance_rls.sql) to match.
-- (In practice expenses_write already didn't include OPERATOR/HR either —
-- their "Add Expense" button on /expenses was a raw insert that RLS was
-- already silently rejecting, a pre-existing bug this happens to fix too.)
--
-- vendor_bills stays CEO/ADMIN/ACCOUNTANT only, deliberately not widened:
-- creating a formal AP vendor bill is an accountant-tier action even when
-- the underlying expense record is logged by OPERATOR/HR. The expense
-- transactions page's "auto-create vendor bill" toggle already degrades
-- gracefully (saves the expense, reports the bill-creation step failed)
-- when the bill insert is rejected, so this doesn't need a code change.
--
-- Idempotent: safe to run more than once.

DROP POLICY IF EXISTS expenses_write ON expenses;
CREATE POLICY expenses_write ON expenses
  FOR INSERT WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','HR'));

DROP POLICY IF EXISTS expenses_update ON expenses;
CREATE POLICY expenses_update ON expenses
  FOR UPDATE USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT','OPERATOR','HR'));

NOTIFY pgrst, 'reload schema';
