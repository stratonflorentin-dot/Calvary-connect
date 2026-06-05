-- Truck Insurance Management System
-- Tables for managing fleet insurance policies, compliance, and claims
-- Tanzanian business requirements: TIRA compliance, COMESA coverage tracking

-- ==================== MAIN TABLES ====================

-- Create truck_insurance table
CREATE TABLE IF NOT EXISTS truck_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  insurer_name VARCHAR(255) NOT NULL,
  policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('third_party', 'third_party_cargo', 'comprehensive', 'cross_border')),
  tira_reference_number VARCHAR(100) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  annual_premium NUMERIC(12, 2) NOT NULL,
  assigned_driver_id UUID REFERENCES drivers(id),
  route_coverage_area VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expiring_soon', 'expired')),
  is_cross_border BOOLEAN DEFAULT FALSE,
  has_comesa_yellow_card BOOLEAN DEFAULT FALSE,
  policy_document_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_truck_insurance_vehicle_id ON truck_insurance(vehicle_id);
CREATE INDEX idx_truck_insurance_status ON truck_insurance(status);
CREATE INDEX idx_truck_insurance_expiry_date ON truck_insurance(expiry_date);
CREATE INDEX idx_truck_insurance_insurer ON truck_insurance(insurer_name);

-- Create insurance_claims table (optional but recommended)
CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_insurance_id UUID NOT NULL REFERENCES truck_insurance(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL,
  claim_type VARCHAR(50) NOT NULL CHECK (claim_type IN ('accident', 'theft', 'damage', 'third_party', 'cargo')),
  claim_amount NUMERIC(12, 2) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  resolution_notes TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_insurance_claims_truck ON insurance_claims(truck_insurance_id);
CREATE INDEX idx_insurance_claims_vehicle ON insurance_claims(vehicle_id);
CREATE INDEX idx_insurance_claims_status ON insurance_claims(status);
CREATE INDEX idx_insurance_claims_date ON insurance_claims(claim_date);

-- ==================== AUDIT & TRACKING ====================

-- Add insurance-related columns to vehicles table (if not already present)
-- ALTER TABLE vehicles ADD COLUMN insurance_expiry DATE;
-- ALTER TABLE vehicles ADD COLUMN insurance_status VARCHAR(50);

-- ==================== VIEWS FOR REPORTING ====================

-- Create a view for expiring policies (within 30 days)
CREATE VIEW expiring_insurance_policies AS
SELECT 
  ti.*,
  v.plate_number,
  v.make,
  v.model,
  EXTRACT(DAY FROM ti.expiry_date - NOW()) as days_until_expiry
FROM truck_insurance ti
JOIN vehicles v ON ti.vehicle_id = v.id
WHERE ti.expiry_date <= NOW() + INTERVAL '30 days'
  AND ti.expiry_date >= NOW() - INTERVAL '30 days'
ORDER BY ti.expiry_date ASC;

-- Create a view for TIRA compliance check
CREATE VIEW tira_compliance_report AS
SELECT 
  v.id as vehicle_id,
  v.plate_number,
  COALESCE(MAX(CASE WHEN ti.policy_type IN ('third_party', 'third_party_cargo', 'comprehensive', 'cross_border') 
    AND ti.expiry_date > NOW() THEN 1 ELSE 0 END), 0) as has_valid_coverage,
  COUNT(ti.id) as total_policies,
  ARRAY_AGG(ti.policy_type) as policy_types,
  MAX(ti.expiry_date) as latest_expiry
FROM vehicles v
LEFT JOIN truck_insurance ti ON v.id = ti.vehicle_id
GROUP BY v.id, v.plate_number;

-- Create a view for cross-border vehicles requiring COMESA coverage
CREATE VIEW cross_border_coverage_check AS
SELECT 
  ti.id,
  ti.vehicle_id,
  v.plate_number,
  ti.insurer_name,
  ti.is_cross_border,
  ti.has_comesa_yellow_card,
  CASE 
    WHEN ti.is_cross_border AND NOT ti.has_comesa_yellow_card THEN 'MISSING_YELLOW_CARD'
    WHEN ti.is_cross_border AND ti.has_comesa_yellow_card THEN 'COMPLIANT'
    ELSE 'NOT_CROSS_BORDER'
  END as comesa_status
FROM truck_insurance ti
JOIN vehicles v ON ti.vehicle_id = v.id
WHERE ti.is_cross_border = TRUE
ORDER BY ti.expiry_date DESC;

-- ==================== ROW LEVEL SECURITY (RLS) ====================

-- Enable RLS on truck_insurance
ALTER TABLE truck_insurance ENABLE ROW LEVEL SECURITY;

-- Policy: HR users can view all insurance records
CREATE POLICY "HR can view all insurance" ON truck_insurance
  FOR SELECT USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'HR'
    OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'ADMIN'
  );

-- Policy: HR users can create/update insurance records
CREATE POLICY "HR can manage insurance" ON truck_insurance
  FOR UPDATE USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'HR'
    OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'ADMIN'
  );

CREATE POLICY "HR can create insurance" ON truck_insurance
  FOR INSERT WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'HR'
    OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'ADMIN'
  );

-- Enable RLS on insurance_claims
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can view all claims" ON insurance_claims
  FOR SELECT USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'HR'
    OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'ADMIN'
  );

CREATE POLICY "HR can manage claims" ON insurance_claims
  FOR INSERT WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'HR'
    OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'ADMIN'
  );

-- ==================== FUNCTIONS FOR BUSINESS LOGIC ====================

-- Function to calculate insurance status based on expiry date
CREATE OR REPLACE FUNCTION calculate_insurance_status(expiry_date DATE)
RETURNS VARCHAR(50) AS $$
BEGIN
  IF expiry_date < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN 'expiring_soon';
  ELSE
    RETURN 'active';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to automatically update insurance status on insert/update
CREATE OR REPLACE FUNCTION update_insurance_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status = calculate_insurance_status(NEW.expiry_date);
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update status
CREATE TRIGGER update_insurance_status_trigger
BEFORE INSERT OR UPDATE ON truck_insurance
FOR EACH ROW
EXECUTE FUNCTION update_insurance_status();

-- ==================== SAMPLE DATA (Optional) ====================

-- Insert sample insurance data for testing
-- INSERT INTO truck_insurance (
--   vehicle_id, insurer_name, policy_type, tira_reference_number,
--   start_date, expiry_date, annual_premium, route_coverage_area,
--   is_cross_border, has_comesa_yellow_card, created_by
-- ) VALUES (
--   (SELECT id FROM vehicles LIMIT 1),
--   'Jubilee Insurance',
--   'third_party',
--   'TZ/2024/123456',
--   '2024-01-01',
--   '2025-01-01',
--   500000,
--   'East Africa',
--   FALSE,
--   FALSE,
--   (SELECT id FROM user_profiles WHERE role = 'HR' LIMIT 1)
-- );

-- ==================== HELPFUL QUERIES ====================

-- Check TIRA compliance
-- SELECT * FROM tira_compliance_report WHERE has_valid_coverage = 0;

-- Find expiring policies
-- SELECT * FROM expiring_insurance_policies ORDER BY days_until_expiry ASC;

-- Check cross-border compliance
-- SELECT * FROM cross_border_coverage_check WHERE comesa_status = 'MISSING_YELLOW_CARD';

-- Get insurance summary for dashboard
-- SELECT 
--   COUNT(*) as total_policies,
--   SUM(annual_premium) as total_annual_cost,
--   COUNT(CASE WHEN status = 'active' THEN 1 END) as active_policies,
--   COUNT(CASE WHEN status = 'expiring_soon' THEN 1 END) as expiring_soon_count,
--   COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_count
-- FROM truck_insurance;
