import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export class AiRequestAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AiRequestAuthError';
    this.status = status;
  }
}

/** Validate the browser's Supabase session and create a caller-scoped data client. */
export async function authenticateAiRequest(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) throw new AiRequestAuthError('Sign in to use the AI analyst.');

  const admin = supabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !user) throw new AiRequestAuthError('Your session is invalid or expired. Sign in again.');

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('id, name, email, role, status')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile || String(profile.status || '').toLowerCase() === 'deleted') {
    throw new AiRequestAuthError('Your active user profile could not be verified.', 403);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase client configuration is missing.');

  const dataClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { user, profile, dataClient };
}
