-- The real root cause of "permission denied for table users" generating a
-- Shipment's contract — found via a live pg_policies dump, not guessed:
-- three RLS policies on contracts (contracts_admin_delete, contracts_
-- creator_create, contracts_creator_update) query auth.users directly —
-- e.g. EXISTS (SELECT 1 FROM auth.users WHERE users.id = auth.uid() AND
-- users.raw_user_meta_data->>'role' = 'ADMIN'). None of these exist in any
-- migration file in this repo — hand-created directly in the dashboard,
-- same as contracts itself (flagged back in 038_lock_down_rls_gaps.sql's
-- own audit comment).
--
-- RLS policy USING/WITH CHECK expressions always run with the CALLING
-- session's own privileges — no SECURITY DEFINER trigger fix (099, 108)
-- can elevate that, because a policy isn't a trigger. authenticated has no
-- SELECT grant on auth.users, so evaluating any of these three throws a
-- hard permission error. Permissive RLS policies combine via OR, but a
-- thrown error during evaluation fails the whole statement regardless of
-- whether another policy (contracts_all) would separately have allowed
-- it — that's why this kept failing even after audit_log() and the base
-- table grant were both already fixed.
--
-- contracts_all (current_user_role() IN ('CEO','ADMIN','SALESMAN',
-- 'ACCOUNTANT'), FOR ALL) already covers every one of these three
-- policies' intent correctly, via this app's real role source
-- (user_profiles), not Supabase auth metadata this app never writes to.
-- Dropping the three broken ones is not a permission reduction — nothing
-- they granted isn't already granted by contracts_all.
--
-- Also drops contracts_authenticated_view, a fourth pre-existing policy
-- that's simply dead code: it checks auth.role() = 'authenticated_user',
-- but Supabase's actual role string is 'authenticated' (no _user suffix)
-- — this condition can never be true, so the policy has never actually
-- granted anything. Harmless (permissive policies that never match don't
-- block access), but not worth keeping.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

DROP POLICY IF EXISTS contracts_admin_delete ON contracts;
DROP POLICY IF EXISTS contracts_creator_create ON contracts;
DROP POLICY IF EXISTS contracts_creator_update ON contracts;
DROP POLICY IF EXISTS contracts_authenticated_view ON contracts;

NOTIFY pgrst, 'reload schema';
