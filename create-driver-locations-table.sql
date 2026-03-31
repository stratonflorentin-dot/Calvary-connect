-- Create driver_locations table for real-time tracking
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS driver_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2),
    speed DECIMAL(10, 2),
    heading DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(driver_id)
);

-- Enable RLS
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (to avoid error)
DROP POLICY IF EXISTS "drivers_update_own_location" ON driver_locations;
DROP POLICY IF EXISTS "managers_view_all_locations" ON driver_locations;

-- Policy: Drivers can update their own location
CREATE POLICY "drivers_update_own_location" 
ON driver_locations FOR ALL
TO authenticated
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid());

-- Policy: CEO/Admin/HR/Operator can view all driver locations
CREATE POLICY "managers_view_all_locations" 
ON driver_locations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('CEO', 'ADMIN', 'HR', 'OPERATOR')
    )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_active ON driver_locations(is_active);

-- Enable real-time updates (only if not already added)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'driver_locations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
    END IF;
END $$;
