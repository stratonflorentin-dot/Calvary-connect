-- Adds a DELETE policy to audit_logs (the table behind the "Financial
-- Audit Trail" page at /audit) so CEO/ADMIN can clear it from the UI.
-- Deliberately requested: this table previously had no delete policy at
-- all (matching audit_trail's own immutable-by-design shape) — CEO/ADMIN
-- explicitly want a full clear capability with no export/retention step.
-- Scoped to the same roles already allowed to read it (038_lock_down_rls_gaps.sql).
drop policy if exists audit_logs_delete on audit_logs;
create policy audit_logs_delete on audit_logs
  for delete using (current_user_role() in ('CEO','ADMIN'));

NOTIFY pgrst, 'reload schema';
