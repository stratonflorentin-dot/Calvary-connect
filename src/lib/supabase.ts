import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin user configuration
export const ADMIN_EMAIL = 'stratonflorentin@gmail.com';
export const ADMIN_ROLE = 'CEO';

/** Primary install owner (offline admin / legacy bypass). Not every staff @ domain. */
export function isPrimaryOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
}

// Demo mode flag - should be false in production
export const DEMO_MODE = false;
