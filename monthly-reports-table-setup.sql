-- Create monthly_reports table for financial reporting
CREATE TABLE IF NOT EXISTS monthly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TIMESTAMP WITH TIME ZONE NOT NULL,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_expenses DECIMAL(12,2) DEFAULT 0,
  total_allowances DECIMAL(12,2) DEFAULT 0,
  net_profit DECIMAL(12,2) DEFAULT 0,
  trip_count INTEGER DEFAULT 0,
  expense_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)
);

-- Enable RLS
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own reports" ON monthly_reports
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own reports" ON monthly_reports
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "System can manage monthly reports" ON monthly_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'ceo', 'accountant')
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_monthly_reports_month ON monthly_reports(month);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_created_by ON monthly_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_created_at ON monthly_reports(created_at);

-- Success message
SELECT '✅ Monthly reports table created successfully!' as status,
       'Financial reporting system is now ready for monthly summaries.' as message;
