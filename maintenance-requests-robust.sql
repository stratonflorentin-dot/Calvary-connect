-- First, drop any existing maintenance_requests table to avoid conflicts
DROP TABLE IF EXISTS maintenance_requests CASCADE;

-- Create maintenance requests table without assuming user_profiles structure
CREATE TABLE maintenance_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID, -- Will reference user_profiles.id but we'll add constraint after checking structure
  vehicle_id UUID, -- Will reference vehicles.id but we'll add constraint after checking structure
  part_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  description TEXT,
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  requested_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  needed_by_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies that don't depend on specific column names
CREATE POLICY "Users can view maintenance requests" ON maintenance_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert maintenance requests" ON maintenance_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update maintenance requests" ON maintenance_requests
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete maintenance requests" ON maintenance_requests
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create indexes for performance (only if columns exist)
DO $$
BEGIN
    -- Check if user_id column exists before creating index
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'maintenance_requests' 
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        CREATE INDEX idx_maintenance_requests_user_id ON maintenance_requests(user_id);
    END IF;
    
    -- Check if vehicle_id column exists before creating index
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'maintenance_requests' 
        AND column_name = 'vehicle_id'
        AND table_schema = 'public'
    ) THEN
        CREATE INDEX idx_maintenance_requests_vehicle_id ON maintenance_requests(vehicle_id);
    END IF;
END $$;

-- Create other indexes that should always work
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_requests_urgency ON maintenance_requests(urgency);
CREATE INDEX idx_maintenance_requests_created_at ON maintenance_requests(created_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_maintenance_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_maintenance_requests_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_maintenance_requests_updated_at();

-- Create a simple view without complex joins for now
CREATE OR REPLACE VIEW parts_requests_view AS
SELECT 
  mr.id,
  mr.user_id,
  mr.vehicle_id,
  mr.part_name,
  mr.quantity,
  mr.urgency,
  mr.status,
  mr.description,
  mr.estimated_cost,
  mr.actual_cost,
  mr.requested_date,
  mr.needed_by_date,
  mr.completed_date,
  mr.reviewed_by,
  mr.reviewed_at,
  mr.notes,
  mr.created_at,
  mr.updated_at
FROM maintenance_requests mr;

-- Success message
SELECT '✅ Maintenance requests table created successfully!' as status,
       'Basic table created without foreign key constraints. Ready for parts requests system.' as message;
