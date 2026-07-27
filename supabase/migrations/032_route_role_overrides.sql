-- Role Permissions settings: DB-backed overrides for route-config.ts's
-- static `allowedRoles`, editable from /settings by CEO/Admin.
--
-- Overrides-only: a route with no row here falls back to route-config.ts's
-- static allowedRoles, so an empty/fresh table behaves identically to
-- today's hardcoded behavior — no seed step, no risk of a partial seed
-- leaving some route with no rule at all.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.route_role_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_path    text NOT NULL UNIQUE,
  allowed_roles text[] NOT NULL,
  updated_by    uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_role_overrides_path
  ON public.route_role_overrides(route_path);

ALTER TABLE public.route_role_overrides ENABLE ROW LEVEL SECURITY;

-- Every authenticated user needs to read this (the sidebar computes nav
-- visibility for whatever role is logged in), but only ADMIN/CEO may write —
-- this table is itself an access control, so it must not be writable by a
-- non-admin (that would let someone grant themselves access to any route).
DROP POLICY IF EXISTS route_role_overrides_read ON public.route_role_overrides;
CREATE POLICY route_role_overrides_read ON public.route_role_overrides
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS route_role_overrides_write ON public.route_role_overrides;
CREATE POLICY route_role_overrides_write ON public.route_role_overrides
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'CEO'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'CEO'))
  );
