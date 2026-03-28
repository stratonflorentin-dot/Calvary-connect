-- Fix RLS policy for monthly_reports table to allow inserts
-- This allows authenticated users to generate monthly reports

-- First, drop any existing restrictive policies
DROP POLICY IF EXISTS "monthly_reports_select_own" ON monthly_reports;
DROP POLICY IF EXISTS "monthly_reports_insert_own" ON monthly_reports;
DROP POLICY IF EXISTS "monthly_reports_all_access" ON monthly_reports;
DROP POLICY IF EXISTS "monthly_reports_select_all" ON monthly_reports;
DROP POLICY IF EXISTS "monthly_reports_insert_all" ON monthly_reports;
DROP POLICY IF EXISTS "monthly_reports_update_all" ON monthly_reports;
DROP POLICY IF EXISTS "monthly_reports_delete_all" ON monthly_reports;

-- Enable RLS on the table (if not already enabled)
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to read all reports
CREATE POLICY "monthly_reports_select_all" 
ON monthly_reports FOR SELECT 
TO authenticated 
USING (true);

-- Create policy to allow all authenticated users to insert reports
CREATE POLICY "monthly_reports_insert_all" 
ON monthly_reports FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Create policy to allow all authenticated users to update reports
CREATE POLICY "monthly_reports_update_all" 
ON monthly_reports FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Create policy to allow all authenticated users to delete reports (if needed)
CREATE POLICY "monthly_reports_delete_all" 
ON monthly_reports FOR DELETE 
TO authenticated 
USING (true);

-- Also ensure the table exists with proper structure
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'monthly_reports'
    ) THEN
        CREATE TABLE monthly_reports (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            month TIMESTAMP WITH TIME ZONE NOT NULL,
            total_revenue NUMERIC DEFAULT 0,
            total_expenses NUMERIC DEFAULT 0,
            total_allowances NUMERIC DEFAULT 0,
            net_profit NUMERIC DEFAULT 0,
            trip_count INTEGER DEFAULT 0,
            expense_count INTEGER DEFAULT 0,
            generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;
