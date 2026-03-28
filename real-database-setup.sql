-- REAL DATABASE SETUP - PRODUCTION READY
-- Creates all tables with proper structure for real fleet management system
-- No demo data - clean production schema

-- Step 1: Create essential tables for core functionality

-- Users/Profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    phone TEXT,
    address TEXT,
    license_number TEXT,
    hire_date DATE,
    salary DECIMAL(10, 2),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plate_number TEXT UNIQUE NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    type TEXT DEFAULT 'truck',
    status TEXT DEFAULT 'active',
    mileage INTEGER DEFAULT 0,
    fuel_capacity DECIMAL(5, 2),
    fuel_type TEXT DEFAULT 'diesel',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES user_profiles(id),
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    distance_km INTEGER,
    fuel_consumed DECIMAL(8, 2),
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Maintenance Requests table
CREATE TABLE IF NOT EXISTS maintenance_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id),
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    cost DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category TEXT NOT NULL,
    date DATE NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue table
CREATE TABLE IF NOT EXISTS revenue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    source TEXT NOT NULL,
    date DATE NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial Categories table
CREATE TABLE IF NOT EXISTS financial_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_by UUID REFERENCES user_profiles(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicle Locations table
CREATE TABLE IF NOT EXISTS vehicle_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monthly Reports table
CREATE TABLE IF NOT EXISTS monthly_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month TIMESTAMP WITH TIME ZONE NOT NULL,
    total_revenue DECIMAL(12, 2) DEFAULT 0,
    total_expenses DECIMAL(12, 2) DEFAULT 0,
    total_allowances DECIMAL(12, 2) DEFAULT 0,
    net_profit DECIMAL(12, 2) DEFAULT 0,
    trip_count INTEGER DEFAULT 0,
    expense_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spare Parts table
CREATE TABLE IF NOT EXISTS spare_parts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity_available INTEGER DEFAULT 0,
    quantity_used INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'pieces',
    status TEXT DEFAULT 'in_stock',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver Allowances table
CREATE TABLE IF NOT EXISTS driver_allowances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_name TEXT NOT NULL,
    role TEXT NOT NULL,
    user_id UUID REFERENCES user_profiles(id),
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fuel Requests table
CREATE TABLE IF NOT EXISTS fuel_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_name TEXT,
    vehicle_id TEXT,
    fuel_station TEXT NOT NULL,
    verification_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pending',
    amount DECIMAL(10, 2) NOT NULL
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name TEXT NOT NULL,
    receipt_id TEXT NOT NULL,
    price_before_vat DECIMAL(10, 2) NOT NULL,
    vat DECIMAL(10, 2) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    date DATE NOT NULL,
    category TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create indexes for performance (with conditional checks)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'type') THEN
        CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(type);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'vehicle_id') THEN
        CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'date') THEN
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_requests' AND column_name = 'vehicle_id') THEN
        CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_id ON maintenance_requests(vehicle_id);
    END IF;
    
    -- Index on monthly_reports month
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'month') THEN
        CREATE INDEX IF NOT EXISTS idx_monthly_reports_month ON monthly_reports(month);
    END IF;
    
    -- Index on spare_parts category
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spare_parts' AND column_name = 'category') THEN
        CREATE INDEX IF NOT EXISTS idx_spare_parts_category ON spare_parts(category);
    END IF;
    
    -- Index on driver_allowances user_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_allowances' AND column_name = 'user_id') THEN
        CREATE INDEX IF NOT EXISTS idx_driver_allowances_user_id ON driver_allowances(user_id);
    END IF;
    
    -- Index on fuel_requests status
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_requests' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_fuel_requests_status ON fuel_requests(status);
    END IF;
    
    -- Index on fuel_requests verification_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_requests' AND column_name = 'verification_id') THEN
        CREATE INDEX IF NOT EXISTS idx_fuel_requests_verification_id ON fuel_requests(verification_id);
    END IF;
    
    -- Index on purchases receipt_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'receipt_id') THEN
        CREATE INDEX IF NOT EXISTS idx_purchases_receipt_id ON purchases(receipt_id);
    END IF;
    
    -- Index on purchases date
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'date') THEN
        CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
    END IF;
    
    RAISE NOTICE 'Indexes created successfully';
END $$;

-- Step 3: Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Step 4: Verify tables were created
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t.table_name) THEN 'CREATED'
        ELSE 'FAILED'
    END as status
FROM (
    VALUES 
        ('user_profiles'),
        ('vehicles'),
        ('trips'),
        ('maintenance_requests'),
        ('expenses'),
        ('revenue'),
        ('notifications'),
        ('budgets'),
        ('financial_categories'),
        ('reports'),
        ('vehicle_locations'),
        ('monthly_reports'),
        ('spare_parts'),
        ('driver_allowances'),
        ('fuel_requests'),
        ('purchases')
) AS t(table_name);

SELECT '✅ REAL DATABASE SETUP COMPLETE' as status,
       'All production tables created successfully' as message,
       'System is ready for real data' as next_step;
