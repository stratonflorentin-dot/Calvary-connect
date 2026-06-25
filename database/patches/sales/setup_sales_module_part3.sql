-- ==========================================
-- PART 3: SALES MODULE - RLS, Functions & Views
-- Run this after Part 2 completes
-- ==========================================

-- 9. ENABLE RLS
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quotation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contract_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales_opportunities ENABLE ROW LEVEL SECURITY;

-- 10. RLS POLICIES
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON customers;
CREATE POLICY "Allow all operations for authenticated users" ON customers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON quotations;
CREATE POLICY "Allow all operations for authenticated users" ON quotations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON quotation_lines;
CREATE POLICY "Allow all operations for authenticated users" ON quotation_lines
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON contracts;
CREATE POLICY "Allow all operations for authenticated users" ON contracts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON contract_lines;
CREATE POLICY "Allow all operations for authenticated users" ON contract_lines
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON follow_ups;
CREATE POLICY "Allow all operations for authenticated users" ON follow_ups
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON sales_opportunities;
CREATE POLICY "Allow all operations for authenticated users" ON sales_opportunities
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. AUTO-GENERATE QUOTATION NUMBER FUNCTION
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TRIGGER AS $$
DECLARE
    year_str TEXT;
    next_num INTEGER;
    new_number TEXT;
BEGIN
    IF NEW.quotation_number IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    year_str := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_number FROM 'QT-\d{4}-(\d+)') AS INTEGER)), 0) + 1
    INTO next_num
    FROM quotations
    WHERE quotation_number LIKE 'QT-' || year_str || '-%';
    
    new_number := 'QT-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
    NEW.quotation_number := new_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_quotation_number ON quotations;
CREATE TRIGGER auto_quotation_number
    BEFORE INSERT ON quotations
    FOR EACH ROW
    EXECUTE FUNCTION generate_quotation_number();

-- 12. AUTO-GENERATE CONTRACT NUMBER FUNCTION
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TRIGGER AS $$
DECLARE
    year_str TEXT;
    next_num INTEGER;
    new_number TEXT;
BEGIN
    IF NEW.contract_number IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    year_str := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM 'CONT-\d{4}-(\d+)') AS INTEGER)), 0) + 1
    INTO next_num
    FROM contracts
    WHERE contract_number LIKE 'CONT-' || year_str || '-%';
    
    new_number := 'CONT-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
    NEW.contract_number := new_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_contract_number ON contracts;
CREATE TRIGGER auto_contract_number
    BEFORE INSERT ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION generate_contract_number();

-- 13. UPDATE TIMESTAMPS FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Update timestamp triggers
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotations_updated_at ON quotations;
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contracts_updated_at ON contracts;
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_follow_ups_updated_at ON follow_ups;
CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON follow_ups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_opportunities_updated_at ON sales_opportunities;
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON sales_opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 14. VIEWS
DROP VIEW IF EXISTS sales_pipeline_summary;
CREATE OR REPLACE VIEW sales_pipeline_summary AS
SELECT 
    stage,
    COUNT(*) as opportunity_count,
    SUM(estimated_value) as total_value,
    AVG(probability) as avg_probability,
    SUM(estimated_value * probability / 100) as weighted_forecast
FROM sales_opportunities
WHERE stage NOT IN ('closed_won', 'closed_lost')
    AND deleted_at IS NULL
GROUP BY stage;

DROP VIEW IF EXISTS customer_summary;
CREATE OR REPLACE VIEW customer_summary AS
SELECT 
    c.id,
    c.customer_code,
    c.company_name,
    c.status,
    COUNT(DISTINCT q.id) as total_quotations,
    COUNT(DISTINCT CASE WHEN q.status = 'converted' THEN q.id END) as converted_quotations,
    COUNT(DISTINCT cont.id) as active_contracts,
    COALESCE(SUM(cont.total_revenue_generated), 0) as total_revenue,
    MAX(q.quotation_date) as last_quotation_date,
    MAX(cont.end_date) as contract_end_date
FROM customers c
LEFT JOIN quotations q ON q.customer_id = c.id AND q.deleted_at IS NULL
LEFT JOIN contracts cont ON cont.customer_id = c.id AND cont.status = 'active' AND cont.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.customer_code, c.company_name, c.status;

-- 15. AUTO-GENERATE CUSTOMER CODE FUNCTION
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
DECLARE
    next_num INTEGER;
    new_code TEXT;
BEGIN
    IF NEW.customer_code IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(customer_code FROM 'CUST-(\d+)') AS INTEGER)), 0) + 1
    INTO next_num
    FROM customers;
    
    new_code := 'CUST-' || LPAD(next_num::TEXT, 4, '0');
    NEW.customer_code := new_code;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_customer_code ON customers;
CREATE TRIGGER auto_customer_code
    BEFORE INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION generate_customer_code();

SELECT 'Part 3 complete - RLS, functions, triggers and views created' as status;
