-- Create driver_photos table for storing driver-taken pictures
CREATE TABLE IF NOT EXISTS driver_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL,
  trip_id TEXT,
  photo_url TEXT NOT NULL,
  photo_type TEXT DEFAULT 'delivery_proof' CHECK (photo_type IN ('delivery_proof', 'expense_receipt', 'issue_document', 'vehicle_condition')),
  description TEXT,
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE driver_photos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Drivers can view their own photos" ON driver_photos
  FOR SELECT USING (auth.uid()::text = driver_id);

CREATE POLICY "Drivers can upload their own photos" ON driver_photos
  FOR INSERT WITH CHECK (auth.uid()::text = driver_id);

CREATE POLICY "System can manage photos" ON driver_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid()::text 
      AND user_profiles.role IN ('admin', 'ceo', 'accountant')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_driver_photos_driver_id ON driver_photos(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_photos_trip_id ON driver_photos(trip_id);
CREATE INDEX IF NOT EXISTS idx_driver_photos_type ON driver_photos(photo_type);
CREATE INDEX IF NOT EXISTS idx_driver_photos_created_at ON driver_photos(created_at);

-- Update function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_driver_photos_updated_at
  BEFORE UPDATE ON driver_photos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT '✅ Driver photos table created successfully!' as status,
       'Photo storage system is now ready for driver uploads.' as message;
