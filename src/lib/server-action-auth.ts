import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Authorization guard for 'use server' actions that use the service-role client
 * (which bypasses RLS). Validates the caller's Supabase access token and role
 * before any privileged operation, so an action can't be invoked by a user who
 * lacks the role — and so the actor is the *verified* user, never a client arg.
 * See docs/server-actions-auth-audit.md.
 */

export function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase admin credentials');
  return createClient(url, key);
}

export class ServerActionAuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = 'ServerActionAuthError';
    this.status = status;
  }
}

/**
 * Verify the access token and that the caller's role is allowed. Returns the
 * service-role `admin` client plus the verified `user` and `role`. Throws
 * ServerActionAuthError on a missing/invalid session or insufficient role.
 */
export async function requireRole(accessToken: string, allowed: string[]) {
  if (!accessToken) throw new ServerActionAuthError('Sign in again to continue.', 401);
  const admin = getAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new ServerActionAuthError('Your session is invalid or expired. Sign in again.', 401);
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle();
  const role = String(profile?.role ?? '').toUpperCase();
  if (!profile || String(profile.status ?? '').toLowerCase() === 'deleted' || !allowed.includes(role)) {
    throw new ServerActionAuthError('You are not authorized to perform this action.', 403);
  }
  return { admin, user, role };
}
