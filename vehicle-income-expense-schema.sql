-- ===========================================================
-- VEHICLE INCOME & EXPENSE TRACKING SCHEMA
-- Fully connected to fleet, trips, and financial operations
-- AI has full read access through RLS policies
-- ===========================================================

-- ===========================================================
-- VEHICLE SERVICE RECORDS (Maintenance history per vehicle)
-- ===========================================================
CREATE TABLE IF NOT EXISTS vehicle_service_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL,
    mechanic_id UUID,
    
    -- Service Details
    service_type VARCHAR(100) NOT NULL,
    service_description TEXT,
    service_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Parts & Labor
    parts_used TEXT,
    labor_hours DECIMAL(5,2) DEFAULT 0,
    labor_cost DECIMAL(12,2) DEFAULT 0,
    parts_cost DECIMAL(12,2) DEFAULT 0,
    total_cost DECIMAL(12,2) GENERATED ALWAYS AS (labor_cost + parts_cost) STORED,
    
    -- Vehicle State
    mileage_at_service INTEGER,
    next_service_date DATE,
    next_service_mileage INTEGER,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for vehicle_service_records
CREATE INDEX IF NOT EXISTS idx_service_records_vehicle ON vehicle_service_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_records_date ON vehicle_service_records(service_date);
CREATE INDEX IF NOT EXISTS idx_service_records_type ON vehicle_service_records(service_type);

-- Add foreign key constraints (if vehicles table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN
        ALTER TABLE vehicle_service_records 
            ADD CONSTRAINT fk_service_vehicle FOREIGN KEY (vehicle_id) 
            REFERENCES vehicles(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add FK constraint to vehicles: %', SQLERRM;
END $$;

-- ===========================================================
-- FUEL RECORDS (Fuel purchases per vehicle)
-- ===========================================================
CREATE TABLE IF NOT EXISTS fuel_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL,
    driver_id UUID,
    
    -- Fuel Details
    fuel_type VARCHAR(50) DEFAULT 'DIESEL',
    liters DECIMAL(8,2) NOT NULL,
    price_per_liter DECIMAL(8,2),
    cost DECIMAL(12,2),
    total_cost DECIMAL(12,2) GENERATED ALWAYS AS (COALESCE(cost, liters * COALESCE(price_per_liter, 0))) STORED,
    
    -- Location
    station_name VARCHAR(100),
    location VARCHAR(200),
    
    -- Vehicle State
    odometer_reading INTEGER,
    
    -- Payment
    payment_method VARCHAR(50) DEFAULT 'CASH',
    receipt_number VARCHAR(100),
    
    -- Date
    fuel_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fuel_records
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle ON fuel_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_date ON fuel_records(fuel_date);
CREATE INDEX IF NOT EXISTS idx_fuel_driver ON fuel_records(driver_id);

-- Add foreign key constraints
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN
        ALTER TABLE fuel_records 
            ADD CONSTRAINT fk_fuel_vehicle FOREIGN KEY (vehicle_id) 
            REFERENCES vehicles(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add FK constraint to vehicles: %', SQLERRM;
END $$;

-- ===========================================================
-- VEHICLE EXPENSES (Additional expenses per vehicle)
-- ===========================================================
CREATE TABLE IF NOT EXISTS vehicle_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL,
    
    -- Expense Details
    category VARCHAR(50) NOT NULL, -- INSURANCE, TOLL, PARKING, REPAIR, CLEANING, etc.
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TZS',
    
    -- Vendor
    vendor_name VARCHAR(200),
    vendor_contact VARCHAR(100),
    
    -- Receipt/Documentation
    receipt_number VARCHAR(100),
    document_url TEXT,
    
    -- Payment
    payment_method VARCHAR(50) DEFAULT 'CASH',
    payment_status VARCHAR(20) DEFAULT 'PAID',
    
    -- Date
    expense_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Meta
    recorded_by UUID,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for vehicle_expenses
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_vehicle ON vehicle_expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_date ON vehicle_expenses(expense_date);

-- Add category column if table exists but column doesn't (migration fix)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_expenses') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'vehicle_expenses' AND column_name = 'category') THEN
            ALTER TABLE vehicle_expenses ADD COLUMN category VARCHAR(50) DEFAULT 'GENERAL';
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add category column: %', SQLERRM;
END $$;

-- Create category index after column is guaranteed to exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'vehicle_expenses' AND column_name = 'category') THEN
        CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_category ON vehicle_expenses(category);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create category index: %', SQLERRM;
END $$;

-- Add foreign key constraints
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN
        ALTER TABLE vehicle_expenses 
            ADD CONSTRAINT fk_expense_vehicle FOREIGN KEY (vehicle_id) 
            REFERENCES vehicles(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add FK constraint to vehicles: %', SQLERRM;
END $$;

-- ===========================================================
-- VEHICLE FINANCIAL SUMMARY VIEW (for fast AI queries)
-- Only create if trips table has vehicle_id column
-- ===========================================================
DO $$
BEGIN
    -- Check if trips table exists and has vehicle_id column
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trips') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trips' AND column_name = 'vehicle_id') THEN
            
            CREATE OR REPLACE VIEW vehicle_financial_summary AS
            SELECT 
                v.id AS vehicle_id,
                v.plate_number,
                v.name AS vehicle_name,
                v.status,
                
                -- Income from trips
                COALESCE(trip_stats.total_income, 0) AS total_income,
                COALESCE(trip_stats.trip_count, 0) AS trip_count,
                
                -- Service costs
                COALESCE(service_stats.total_service_cost, 0) AS total_service_cost,
                COALESCE(service_stats.service_count, 0) AS service_count,
                
                -- Fuel costs
                COALESCE(fuel_stats.total_fuel_cost, 0) AS total_fuel_cost,
                COALESCE(fuel_stats.total_liters, 0) AS total_fuel_liters,
                COALESCE(fuel_stats.fuel_count, 0) AS fuel_count,
                
                -- Other expenses
                COALESCE(expense_stats.total_expenses, 0) AS total_other_expenses,
                COALESCE(expense_stats.expense_count, 0) AS expense_count,
                
                -- Calculated totals
                COALESCE(trip_stats.total_income, 0) AS total_revenue,
                COALESCE(service_stats.total_service_cost, 0) + 
                    COALESCE(fuel_stats.total_fuel_cost, 0) + 
                    COALESCE(expense_stats.total_expenses, 0) AS total_costs,
                COALESCE(trip_stats.total_income, 0) - (
                    COALESCE(service_stats.total_service_cost, 0) + 
                    COALESCE(fuel_stats.total_fuel_cost, 0) + 
                    COALESCE(expense_stats.total_expenses, 0)
                ) AS net_profit,
                
                -- Averages
                CASE 
                    WHEN COALESCE(trip_stats.trip_count, 0) > 0 
                    THEN COALESCE(trip_stats.total_income, 0) / trip_stats.trip_count 
                    ELSE 0 
                END AS avg_revenue_per_trip,
                
                -- Profit margin
                CASE 
                    WHEN COALESCE(trip_stats.total_income, 0) > 0 
                    THEN ((COALESCE(trip_stats.total_income, 0) - (
                        COALESCE(service_stats.total_service_cost, 0) + 
                        COALESCE(fuel_stats.total_fuel_cost, 0) + 
                        COALESCE(expense_stats.total_expenses, 0)
                    )) / trip_stats.total_income) * 100
                    ELSE 0 
                END AS profit_margin_percent,
                
                -- Last updated
                NOW() AS calculated_at

            FROM vehicles v
            
            -- Trip income statistics
            LEFT JOIN (
                SELECT 
                    vehicle_id,
                    COALESCE(SUM(salesAmount), 0) + COALESCE(SUM(revenue), 0) + COALESCE(SUM(price), 0) + COALESCE(SUM(totalAmount), 0) AS total_income,
                    COUNT(*) AS trip_count
                FROM trips
                WHERE vehicle_id IS NOT NULL
                GROUP BY vehicle_id
            ) trip_stats ON v.id = trip_stats.vehicle_id
            
            -- Service statistics
            LEFT JOIN (
                SELECT 
                    vehicle_id,
                    SUM(total_cost) AS total_service_cost,
                    COUNT(*) AS service_count
                FROM vehicle_service_records
                GROUP BY vehicle_id
            ) service_stats ON v.id = service_stats.vehicle_id
            
            -- Fuel statistics
            LEFT JOIN (
                SELECT 
                    vehicle_id,
                    SUM(total_cost) AS total_fuel_cost,
                    SUM(liters) AS total_liters,
                    COUNT(*) AS fuel_count
                FROM fuel_records
                GROUP BY vehicle_id
            ) fuel_stats ON v.id = fuel_stats.vehicle_id
            
            -- Other expenses statistics
            LEFT JOIN (
                SELECT 
                    vehicle_id,
                    SUM(amount) AS total_expenses,
                    COUNT(*) AS expense_count
                FROM vehicle_expenses
                GROUP BY vehicle_id
            ) expense_stats ON v.id = expense_stats.vehicle_id;
            
            RAISE NOTICE 'Created vehicle_financial_summary view successfully';
        ELSE
            RAISE NOTICE 'trips table does not have vehicle_id column - view not created';
        END IF;
    ELSE
        RAISE NOTICE 'trips table does not exist - view not created';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create view: %', SQLERRM;
END $$;

-- ===========================================================
-- ROW LEVEL SECURITY POLICIES (AI and authenticated users)
-- ===========================================================

-- Enable RLS on all tables
ALTER TABLE vehicle_service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_expenses ENABLE ROW LEVEL SECURITY;

-- Full read access for all authenticated users (including AI)
CREATE POLICY "Full read access for authenticated users" ON vehicle_service_records
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Full read access for authenticated users" ON fuel_records
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Full read access for authenticated users" ON vehicle_expenses
    FOR SELECT TO authenticated USING (true);

-- Full read access for AI (service role)
CREATE POLICY "Full read access for service role" ON vehicle_service_records
    FOR SELECT TO service_role USING (true);

CREATE POLICY "Full read access for service role" ON fuel_records
    FOR SELECT TO service_role USING (true);

CREATE POLICY "Full read access for service role" ON vehicle_expenses
    FOR SELECT TO service_role USING (true);

-- Write access for admins and mechanics
CREATE POLICY "Write access for admins" ON vehicle_service_records
    FOR ALL TO authenticated 
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'CEO', 'MECHANIC')));

CREATE POLICY "Write access for admins" ON fuel_records
    FOR ALL TO authenticated 
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'CEO', 'OPERATOR', 'DRIVER')));

CREATE POLICY "Write access for admins" ON vehicle_expenses
    FOR ALL TO authenticated 
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'CEO', 'ACCOUNTANT')));

-- Allow inserts for drivers recording their own fuel
CREATE POLICY "Drivers can add fuel records" ON fuel_records
    FOR INSERT TO authenticated 
    WITH CHECK (driver_id = auth.uid());

-- ===========================================================
-- TRIGGERS FOR UPDATED_AT
-- ===========================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vehicle_service_records_updated_at 
    BEFORE UPDATE ON vehicle_service_records 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fuel_records_updated_at 
    BEFORE UPDATE ON fuel_records 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_expenses_updated_at 
    BEFORE UPDATE ON vehicle_expenses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================================
-- NO SAMPLE DATA - Application fetches real data from fleet
-- ===========================================================
-- Records will be created through the application UI
-- when users log actual service and fuel records

-- Grant access to vehicle_financial_summary view (only if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'vehicle_financial_summary') THEN
        GRANT SELECT ON vehicle_financial_summary TO authenticated;
        GRANT SELECT ON vehicle_financial_summary TO service_role;
        GRANT SELECT ON vehicle_financial_summary TO anon;
        RAISE NOTICE 'Granted access to vehicle_financial_summary view';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not grant access to view: %', SQLERRM;
END $$;

-- ===========================================================
-- END OF SCHEMA
-- ===========================================================
