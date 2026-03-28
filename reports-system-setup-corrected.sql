-- Create reports table for the reporting system
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('financial', 'operational', 'fleet', 'maintenance', 'custom')),
  content TEXT NOT NULL,
  period TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)
);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own reports" ON reports
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "System can manage reports" ON reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'ceo', 'accountant')
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_period ON reports(period);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);

-- Create other missing tables for the monthly report system
CREATE TABLE IF NOT EXISTS fuel_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES user_profiles(id),
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  participants UUID[], -- Array of user IDs
  created_by UUID REFERENCES user_profiles(id),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for new tables
ALTER TABLE fuel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for fuel_requests
CREATE POLICY "Users can view their own fuel requests" ON fuel_requests
  FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Users can create their own fuel requests" ON fuel_requests
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "System can manage fuel requests" ON fuel_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'ceo', 'accountant','hr')
    )
  );

-- Create RLS policies for meetings
CREATE POLICY "Users can view meetings they participate in" ON meetings
  FOR SELECT USING (
    auth.uid() = created_by OR 
    auth.uid() = ANY(participants)
  );

CREATE POLICY "Users can create meetings" ON meetings
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "System can manage meetings" ON meetings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'ceo', 'hr')
    )
  );

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_fuel_requests_driver_id ON fuel_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_requests_status ON fuel_requests(status);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);

-- Success message
SELECT '✅ Reports system tables created successfully!' as status,
       'Reports, fuel_requests, and meetings tables are now ready.' as message;
