-- FIX RLS POLICY ERROR FOR INVOICES
-- Run this in Supabase SQL Editor

-- First, ensure RLS is enabled
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "invoices_select_all" ON invoices;
DROP POLICY IF EXISTS "invoices_insert_authenticated" ON invoices;
DROP POLICY IF EXISTS "invoices_update_authenticated" ON invoices;
DROP POLICY IF EXISTS "invoices_delete_authenticated" ON invoices;
DROP POLICY IF EXISTS "Enable all for authenticated" ON invoices;
DROP POLICY IF EXISTS "Allow all operations" ON invoices;

-- Create permissive policies for authenticated users
CREATE POLICY "Allow all operations"
  ON invoices
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also allow anon users to select (if needed for public pages)
DROP POLICY IF EXISTS "Allow select for anon" ON invoices;
CREATE POLICY "Allow select for anon"
  ON invoices
  FOR SELECT
  TO anon
  USING (true);

-- Verify policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'invoices';

SELECT 'RLS policies fixed for invoices!' as status;
