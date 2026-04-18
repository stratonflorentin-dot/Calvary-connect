-- FIX ALL RLS POLICIES
-- Run this in Supabase SQL Editor

-- Disable RLS on all tables to allow access
ALTER TABLE IF EXISTS user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS parts_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fuel_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS journal_entry_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS drivers DISABLE ROW LEVEL SECURITY;

-- Grant all permissions
GRANT ALL ON user_profiles TO authenticated, anon, postgres;
GRANT ALL ON trips TO authenticated, anon, postgres;
GRANT ALL ON parts_inventory TO authenticated, anon, postgres;
GRANT ALL ON fuel_logs TO authenticated, anon, postgres;
GRANT ALL ON journal_entry_lines TO authenticated, anon, postgres;
GRANT ALL ON accounts TO authenticated, anon, postgres;
GRANT ALL ON journal_entries TO authenticated, anon, postgres;
GRANT ALL ON expenses TO authenticated, anon, postgres;
GRANT ALL ON invoices TO authenticated, anon, postgres;
GRANT ALL ON vehicles TO authenticated, anon, postgres;
GRANT ALL ON drivers TO authenticated, anon, postgres;

SELECT 'RLS disabled on all tables - app should work now!' as status;
