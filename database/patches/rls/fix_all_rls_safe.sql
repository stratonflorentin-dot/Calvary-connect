-- FIX ALL RLS POLICIES (SAFE VERSION)
-- Run this in Supabase SQL Editor

-- Create a function to safely disable RLS
CREATE OR REPLACE FUNCTION safe_disable_rls(table_name TEXT) RETURNS TEXT AS $$
BEGIN
    EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', table_name);
    RETURN 'Disabled RLS on ' || table_name;
EXCEPTION WHEN undefined_table THEN
    RETURN 'Table ' || table_name || ' does not exist, skipped';
END;
$$ LANGUAGE plpgsql;

-- Create a function to safely grant permissions
CREATE OR REPLACE FUNCTION safe_grant(table_name TEXT) RETURNS TEXT AS $$
BEGIN
    EXECUTE format('GRANT ALL ON %I TO authenticated, anon, postgres', table_name);
    RETURN 'Granted permissions on ' || table_name;
EXCEPTION WHEN undefined_table THEN
    RETURN 'Table ' || table_name || ' does not exist, skipped';
END;
$$ LANGUAGE plpgsql;

-- Disable RLS on existing tables
SELECT safe_disable_rls('user_profiles');
SELECT safe_disable_rls('trips');
SELECT safe_disable_rls('parts_inventory');
SELECT safe_disable_rls('fuel_logs');
SELECT safe_disable_rls('journal_entry_lines');
SELECT safe_disable_rls('journal_entries');
SELECT safe_disable_rls('accounts');
SELECT safe_disable_rls('expenses');
SELECT safe_disable_rls('invoices');
SELECT safe_disable_rls('vehicles');
SELECT safe_disable_rls('drivers');
SELECT safe_disable_rls('spare_parts');

-- Grant permissions on existing tables
SELECT safe_grant('user_profiles');
SELECT safe_grant('trips');
SELECT safe_grant('journal_entry_lines');
SELECT safe_grant('journal_entries');
SELECT safe_grant('accounts');
SELECT safe_grant('expenses');
SELECT safe_grant('invoices');
SELECT safe_grant('vehicles');
SELECT safe_grant('spare_parts');

-- Clean up functions
DROP FUNCTION IF EXISTS safe_disable_rls(TEXT);
DROP FUNCTION IF EXISTS safe_grant(TEXT);

SELECT 'RLS fix complete - only existing tables were modified!' as status;
