import { supabaseAdmin } from '@/lib/supabase-admin';

// These 4 fleet report routes (driver-performance, fuel, route-profitability,
// revenue-by-vehicle) used the plain browser-oriented `@/lib/supabase`
// client server-side — a module-level singleton with no cookie/session
// handling, so every query it ran here executed as the literal `anon`
// role. That was invisible while trips/fuel_requests/vehicles had no real
// RLS; migrations 048/053 locking those tables down turned it into
// "permission denied for table trips" for every caller, regardless of
// role — CEO/ADMIN included, not just the roles that were actually
// missing from a policy.
//
// Fix: verify the caller's own session via Bearer token (same pattern as
// requireStatutoryAccess in payroll/statutory/helpers.ts) against these
// routes' own route-config.ts role list, then use the service-role client
// to run the actual report queries — reports read broadly across tables
// for aggregation, which is what route-config's per-route role list is
// for, rather than relying on each table's own RLS shape to happen to
// line up.
const FLEET_REPORT_ROLES = ['CEO', 'ADMIN', 'ACCOUNTANT', 'HR'];

export async function requireFleetReportAccess(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    throw new Error('UNAUTHORIZED: missing access token');
  }

  const admin = supabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) {
    throw new Error('UNAUTHORIZED: invalid session');
  }

  const { data: profile } = await admin.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !FLEET_REPORT_ROLES.includes(String(profile.role).toUpperCase())) {
    throw new Error('FORBIDDEN: not authorized to view fleet reports');
  }

  return admin;
}
