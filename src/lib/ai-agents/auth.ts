import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ALLOWED_ROLES = ['CEO', 'ADMIN'];

/**
 * Shared gate for the AI agent roster routes — mirrors the bearer-token +
 * user_profiles role check in src/app/api/fuel/detect-anomalies/route.ts.
 */
export async function requireAgentAccess(request: NextRequest) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) throw new Error('UNAUTHORIZED: missing access token');

  const admin = supabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error('UNAUTHORIZED: invalid session');

  const { data: profile } = await admin.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !ALLOWED_ROLES.includes(String(profile.role).toUpperCase())) {
    throw new Error('FORBIDDEN: not authorized to use AI agents');
  }
  return { admin, userId: user.id };
}

export function authErrorResponse(err: any): { status: number; body: { error: string } } {
  const message = err?.message || 'Server error';
  const status = message.startsWith('UNAUTHORIZED') ? 401 : message.startsWith('FORBIDDEN') ? 403 : 500;
  return { status, body: { error: message } };
}
