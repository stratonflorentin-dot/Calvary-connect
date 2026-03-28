import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin user configuration
export const ADMIN_EMAIL = 'stratonflorentin@gmail.com';
export const ADMIN_ROLE = 'CEO';

// Demo mode flag - only active if no real Supabase URL is provided
export const DEMO_MODE = !supabaseUrl || supabaseUrl === ''; // Auto-detect based on URL presence
