-- Create driver_allowances table for real allowance system
CREATE TABLE IF NOT EXISTS driver_allowances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL,
  trip_id TEXT,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE driver_allowances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Drivers can view their own allowances" ON driver_allowances
  FOR SELECT USING (auth.uid()::text = driver_id);

CREATE POLICY "Drivers can insert their own allowances" ON driver_allowances
  FOR INSERT WITH CHECK (auth.uid()::text = driver_id);

CREATE POLICY "System can manage allowances" ON driver_allowances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid()::text 
      AND user_profiles.role IN ('admin', 'ceo', 'accountant')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_driver_allowances_driver_id ON driver_allowances(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_allowances_trip_id ON driver_allowances(trip_id);
CREATE INDEX IF NOT EXISTS idx_driver_allowances_status ON driver_allowances(status);

-- Update function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_driver_allowances_updated_at
  BEFORE UPDATE ON driver_allowances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT '✅ Driver allowances table created successfully!' as status,
       'Real allowance system is now ready for trip-based allowances.' as message;
