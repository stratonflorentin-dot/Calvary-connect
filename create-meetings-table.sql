-- Create meetings table for HR meeting planning
-- Run this in your Supabase SQL Editor

-- Create the meetings table
CREATE TABLE IF NOT EXISTS meetings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    participants UUID[] DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "meetings_select_all" 
ON meetings FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "meetings_insert_all" 
ON meetings FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "meetings_update_all" 
ON meetings FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "meetings_delete_all" 
ON meetings FOR DELETE 
TO authenticated 
USING (true);
