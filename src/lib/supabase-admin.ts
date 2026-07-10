import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only Supabase client using the service-role key. API routes have no
// user session (the browser client's auth cookies are not forwarded), so the
// anon client always fails RLS policies tied to auth.uid(). Never import this
// from client components.
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing Supabase admin credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
