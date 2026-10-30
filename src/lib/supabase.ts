import { createBrowserClient } from '@supabase/ssr';

// Use environment variables for Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.',
  );
}

// Cookie-backed browser client (@supabase/ssr) instead of the default
// localStorage client, so the session is readable by the Edge middleware
// (src/middleware.ts) and can be enforced server-side. The client API is
// identical to supabase-js, so every existing `supabase.*` caller is unchanged.
// One-time effect: users with an existing localStorage session must sign in
// again once, after which the session lives in cookies.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name, role')
    .eq('id', user.id)
    .single();

  return {
    id: user.id,
    name: profile?.name || user.email || 'Unknown',
    role: profile?.role || 'USER',
  };
}
