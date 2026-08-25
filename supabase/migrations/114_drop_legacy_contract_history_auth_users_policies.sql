-- The Send/Activate contract actions call addContractHistory() (an insert
-- into contract_history), which chains .select().single() after the
-- insert — that triggers PostgREST to evaluate the SELECT RLS policy on
-- the row it just wrote. history_authenticated_view (created directly in
-- ./migrations/001_create_contracts_system.sql, a separate legacy folder
-- never applied through supabase/migrations) queries auth.users directly:
--   EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND
--     raw_user_meta_data->>'role' IN ('CEO','ADMIN'))
-- authenticated has no grant on auth.users, so this throws "permission
-- denied for table users" — the exact same root cause already fixed for
-- contracts itself in 109_drop_legacy_contracts_auth_users_policies.sql,
-- which never touched contract_history's own policies.
--
-- The contracts row update itself already succeeds (confirmed live —
-- status visibly changes to "Sent") because 109 already fixed contracts;
-- only the history-logging insert's follow-up SELECT was still broken.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

DROP POLICY IF EXISTS history_authenticated_view ON contract_history;
CREATE POLICY history_authenticated_view ON contract_history
  FOR SELECT USING (
    current_user_role() IN ('CEO','ADMIN')
    OR EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = contract_history.contract_id
        AND contracts.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS history_auto_insert ON contract_history;
CREATE POLICY history_auto_insert ON contract_history
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_history.contract_id)
  );

NOTIFY pgrst, 'reload schema';
