-- Postgres views run with the view owner's permissions by default, not the
-- querying user's — the same effect as SECURITY DEFINER, and it bypasses
-- RLS. The Supabase security advisor flagged all four views from migration
-- 061 as ERROR-level `security_definer_view` immediately after they were
-- created: any authenticated user querying fleet_fuel_summary,
-- view_trip_profitability, view_driver_float_aging, or
-- view_tra_vfd_audit_schedule would see every row regardless of the RLS
-- policies on invoices/credit_notes/vendor_bills/trip_advances/
-- vehicle_costs underneath — a real cross-tenant/cross-role data exposure,
-- not a cosmetic finding.
--
-- Fixed with the security_invoker view option (Postgres 15+): the view now
-- runs with the querying user's own permissions, so normal RLS applies as
-- if they'd queried the underlying tables directly. Column lists are
-- unchanged — this only changes whose permissions the view runs with.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER VIEW fleet_fuel_summary SET (security_invoker = true);
ALTER VIEW view_trip_profitability SET (security_invoker = true);
ALTER VIEW view_driver_float_aging SET (security_invoker = true);
ALTER VIEW view_tra_vfd_audit_schedule SET (security_invoker = true);

INSERT INTO public.schema_migrations (version) VALUES ('064_fix_reporting_views_security_invoker.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
