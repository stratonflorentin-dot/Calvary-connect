-- get_advisors (security) flagged post_bank_statement_line,
-- reconcile_bank_statement_line, unreconcile_bank_statement_line,
-- ignore_bank_statement_line and unignore_bank_statement_line (124/125) as
-- callable by the anon role via PostgREST RPC. Every CREATE FUNCTION
-- implicitly grants EXECUTE to PUBLIC, which anon inherits; the functions'
-- own `current_user_role() NOT IN (...)` check does NOT save them for a
-- truly unauthenticated caller, because current_user_role() resolves via
-- `auth.uid()` (NULL for anon), the lookup returns NULL, and
-- `NULL NOT IN (...)` is NULL — which plpgsql's IF treats as false, so the
-- RAISE EXCEPTION is silently skipped and the SECURITY DEFINER body runs
-- with the function owner's privileges regardless of RLS.
--
-- Revoking the PUBLIC grant closes that off at the grant layer, independent
-- of the role check inside the function body. See 127 — on this project
-- anon also holds a separate default-privilege grant, so this alone turned
-- out not to be sufficient; 127 revokes from anon explicitly.
REVOKE EXECUTE ON FUNCTION post_bank_statement_line(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reconcile_bank_statement_line(uuid, text, uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION unreconcile_bank_statement_line(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ignore_bank_statement_line(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION unignore_bank_statement_line(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION post_bank_statement_line(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION reconcile_bank_statement_line(uuid, text, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION unreconcile_bank_statement_line(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ignore_bank_statement_line(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION unignore_bank_statement_line(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
