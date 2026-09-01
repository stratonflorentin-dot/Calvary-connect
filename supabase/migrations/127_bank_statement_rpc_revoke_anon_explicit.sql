-- REVOKE ... FROM PUBLIC (126) didn't actually close the anon exposure —
-- verified via has_function_privilege('anon', ..., 'EXECUTE') still
-- returning true afterwards. This Supabase project's anon role holds
-- EXECUTE via a direct/default privilege grant on the public schema, not
-- only through PUBLIC membership (the standard Supabase project bootstrap
-- grants anon/authenticated EXECUTE on functions via ALTER DEFAULT
-- PRIVILEGES, separate from whatever PUBLIC has). Revoke explicitly from
-- anon. Confirmed after this that anon_can_execute is false and
-- authenticated_can_execute is still true for all five functions.
REVOKE EXECUTE ON FUNCTION post_bank_statement_line(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION reconcile_bank_statement_line(uuid, text, uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION unreconcile_bank_statement_line(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION ignore_bank_statement_line(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION unignore_bank_statement_line(uuid) FROM anon;
