-- ==========================================
-- CONTRACT TEMPLATES - PART 3: Rate Sheets & RLS
-- ==========================================

-- Insert Default Rate Sheet 2025
INSERT INTO rate_sheets (
    rate_sheet_name,
    effective_date,
    currency,
    fuel_adjustment_enabled,
    fuel_base_price,
    rates,
    special_conditions,
    is_active
) VALUES (
    'Standard Transit Rates 2025',
    '2025-01-01',
    'USD',
    TRUE,
    1.00,
    '[
        {"from": "DAR PORT", "destination": "KIGALI - RWANDA", "container_20ft": 3100, "container_40ft": 3100, "loose": 3100, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "LUSAKA - ZAMBIA", "container_20ft": 4000, "container_40ft": 4000, "loose": 4000, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "SOLWEZI - ZAMBIA", "container_20ft": 4800, "container_40ft": 4800, "loose": 4800, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "BUJUMBURA - BURUNDI", "container_20ft": 3200, "container_40ft": 3200, "loose": 3200, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "LILONGWE - MALAWI", "container_20ft": 4000, "container_40ft": 4000, "loose": 4000, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "BLANTYRE - MALAWI", "container_20ft": 4400, "container_40ft": 4400, "loose": 4400, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "KITWE - ZAMBIA", "container_20ft": 4000, "container_40ft": 4000, "loose": 4400, "truck_type": "C28", "transit_days": 5},
        {"from": "DAR PORT", "destination": "GOMA - DRC", "container_20ft": 4400, "container_40ft": 4400, "loose": 4400, "truck_type": "C28", "transit_days": 8},
        {"from": "DAR PORT", "destination": "BUKAVU - DRC", "container_20ft": 4800, "container_40ft": 4800, "loose": 4800, "truck_type": "C28", "transit_days": 8},
        {"from": "DAR PORT", "destination": "LUBUMBASHI - DRC", "container_20ft": 6400, "container_40ft": 6400, "loose": 6400, "truck_type": "C28", "transit_days": 8},
        {"from": "DAR PORT", "destination": "KOLWEZI - DRC", "container_20ft": 7200, "container_40ft": 7200, "loose": 7200, "truck_type": "C28", "transit_days": 8},
        {"from": "DAR PORT", "destination": "LIKASI - DRC", "container_20ft": 8500, "container_40ft": 8500, "loose": 8500, "truck_type": "C28", "transit_days": 8}
    ]'::jsonb,
    'Rates to be reviewed and agreed on truck allocation prior to loading due to fuel changes, market rates and 3rd party statutory charges. Prices subject to change with fuel fluctuation.',
    TRUE
)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_documents ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON contract_templates;
CREATE POLICY "Allow all operations for authenticated users" ON contract_templates
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON rate_sheets;
CREATE POLICY "Allow all operations for authenticated users" ON rate_sheets
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON contract_documents;
CREATE POLICY "Allow all operations for authenticated users" ON contract_documents
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_contract_templates_updated_at ON contract_templates;
CREATE TRIGGER update_contract_templates_updated_at BEFORE UPDATE ON contract_templates 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rate_sheets_updated_at ON rate_sheets;
CREATE TRIGGER update_rate_sheets_updated_at BEFORE UPDATE ON rate_sheets 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Part 3 complete - Rate sheets and RLS policies created' as status;
