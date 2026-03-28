-- Create insurance policies table for HR management
CREATE TABLE IF NOT EXISTS insurance_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_name TEXT NOT NULL,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('vehicle', 'road', 'health', 'liability', 'comprehensive')),
  insurance_company TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id),
  coverage_amount DECIMAL(12,2),
  premium_amount DECIMAL(12,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  renewal_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'cancelled')),
  documents TEXT[], -- Array of document URLs
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)
);

-- Enable RLS
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view insurance policies" ON insurance_policies
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create insurance policies" ON insurance_policies
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own insurance policies" ON insurance_policies
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "HR can manage insurance policies" ON insurance_policies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'ceo', 'hr')
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_insurance_policies_type ON insurance_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_status ON insurance_policies(status);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_end_date ON insurance_policies(end_date);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_renewal_date ON insurance_policies(renewal_date);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_created_by ON insurance_policies(created_by);

-- Success message
SELECT '✅ Insurance policies table created successfully!' as status,
       'Insurance tracking system is now ready for HR management.' as message;
