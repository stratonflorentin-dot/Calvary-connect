-- Create reports table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    period TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "reports_select_all" 
ON reports FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "reports_insert_all" 
ON reports FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "reports_update_all" 
ON reports FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "reports_delete_all" 
ON reports FOR DELETE 
TO authenticated 
USING (true);
