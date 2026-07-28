-- Fix privilege escalation: user_profiles_update policy has no WITH CHECK,
-- so any authenticated user can currently run
--   UPDATE user_profiles SET role = 'ADMIN' WHERE id = auth.uid()
-- from the browser and grant themselves admin. role drives current_user_role(),
-- which every other RLS policy and RPC in the app relies on for authorization,
-- so this one gap silently defeats access control everywhere else.
--
-- Fix: a BEFORE UPDATE trigger is the actual guard (WITH CHECK can't cleanly
-- express "this one column may only change if the caller is already an admin"
-- across partial updates). The policy itself is loosened slightly so CEO/ADMIN
-- can still edit other users' profiles (needed for HR role changes) — the
-- trigger is what blocks the role column specifically.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.guard_user_profiles_role_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user_role() NOT IN ('CEO', 'ADMIN') THEN
    RAISE EXCEPTION 'Only CEO or ADMIN may change a user''s role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_profiles_role_change_trigger ON public.user_profiles;

CREATE TRIGGER guard_user_profiles_role_change_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profiles_role_change();

DROP POLICY IF EXISTS user_profiles_update ON public.user_profiles;

CREATE POLICY user_profiles_update ON public.user_profiles
  FOR UPDATE
  USING (id = auth.uid() OR current_user_role() IN ('CEO', 'ADMIN'));

-- Same class of hole exists on INSERT: WITH CHECK (id = auth.uid()) alone
-- doesn't stop a self-inserted profile row from setting role='ADMIN' at
-- creation time. Profile creation in this app normally goes through the
-- service-role client (src/app/users/actions.ts), which bypasses RLS anyway —
-- this is defense-in-depth for any path that inserts as the authenticated user.
DROP POLICY IF EXISTS user_profiles_insert ON public.user_profiles;

CREATE POLICY user_profiles_insert ON public.user_profiles
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND (role IS NULL OR role NOT IN ('CEO', 'ADMIN') OR current_user_role() IN ('CEO', 'ADMIN'))
  );
