-- ===========================================================
-- CALVARY LOGISTICS OS v2.0 - DATABASE SCHEMA
-- Comprehensive schema for world-class logistics platform
-- ===========================================================

-- REQUIRED EXISTING TABLES (create these first if they don't exist):
-- 1. user_profiles (from original schema)
-- 2. vehicles (from original schema) 
-- 3. trailers (from original schema)
-- 4. trips (from original schema)
-- 
-- If these tables don't exist, the foreign key constraints will fail.
-- This script creates tables without strict FK constraints initially.
-- Run the add_foreign_keys.sql script after all tables exist to add constraints.

-- ===========================================================
-- TEMPORARY TYPES FOR NEW v2.0 CARGO AND SHIPMENT STATUS
-- ===========================================================

-- Add cargo type enum values if not exists
DO $$ 
BEGIN
    -- These are handled at application level if enum types don't exist
    -- Cargo types: GENERAL, REFRIGERATED, HAZARDOUS, OVERSIZED, PERISHABLE, PHARMA
    -- Shipment statuses: DRAFT, CONFIRMED, ASSIGNED, IN_TRANSIT, DELIVERED, COMPLETED
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Note: Some types may need to be created manually';
END $$;

-- ===========================================================
-- SHIPMENTS (Customer-Facing Entity)
-- ===========================================================
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID, -- References user_profiles(id) - add FK after table exists
    booking_reference VARCHAR(50),
    
    -- Assignment
    vehicle_id UUID, -- References vehicles(id) - add FK after table exists
    driver_id UUID, -- References user_profiles(id) - add FK after table exists
    
    -- Routing
    origin_city VARCHAR(100) NOT NULL,
    origin_country VARCHAR(50) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    destination_country VARCHAR(50) NOT NULL,
    planned_route JSONB DEFAULT '[]'::jsonb,
    
    -- Cargo Details
    cargo_description TEXT,
    cargo_type VARCHAR(50) DEFAULT 'GENERAL',
    cargo_weight_kg DECIMAL(10,2),
    cargo_volume_m3 DECIMAL(8,2),
    temperature_profile VARCHAR(20),
    
    -- Financial
    quoted_amount DECIMAL(12,2),
    final_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'TZS',
    payment_status VARCHAR(20) DEFAULT 'PENDING',
    payment_method VARCHAR(30),
    
    -- Status & Tracking
    status VARCHAR(30) DEFAULT 'DRAFT',
    current_location JSONB,
    progress_percent INTEGER DEFAULT 0,
    
    -- Cross-Border
    border_crossings JSONB DEFAULT '[]'::jsonb,
    customs_status VARCHAR(50),
    
    -- Timestamps
    requested_pickup TIMESTAMP WITH TIME ZONE,
    actual_pickup TIMESTAMP WITH TIME ZONE,
    promised_delivery TIMESTAMP WITH TIME ZONE,
    predicted_eta TIMESTAMP WITH TIME ZONE,
    actual_delivery TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for shipments
CREATE INDEX IF NOT EXISTS idx_shipments_customer ON shipments(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_number ON shipments(shipment_number);

-- ===========================================================
-- CUSTOMERS (B2B Portal Users)
-- ===========================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(200) NOT NULL,
    trading_name VARCHAR(200),
    tax_id VARCHAR(50),
    business_registration VARCHAR(100),
    
    -- Contact
    primary_email VARCHAR(255),
    primary_phone VARCHAR(50),
    billing_address JSONB,
    shipping_addresses JSONB DEFAULT '[]'::jsonb,
    
    -- Portal Access
    portal_enabled BOOLEAN DEFAULT FALSE,
    portal_users JSONB DEFAULT '[]'::jsonb,
    
    -- Financial
    credit_limit DECIMAL(12,2) DEFAULT 0,
    credit_terms_days INTEGER DEFAULT 0,
    current_balance DECIMAL(12,2) DEFAULT 0,
    total_shipments INTEGER DEFAULT 0,
    total_revenue DECIMAL(15,2) DEFAULT 0,
    
    -- Preferences
    notification_preferences JSONB DEFAULT '{"whatsapp": true, "sms": true, "email": true}'::jsonb,
    default_cargo_type VARCHAR(50),
    frequent_routes JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    
    -- Link to auth user
    user_id UUID -- References user_profiles(id) - add FK after table exists
);

CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_name);

-- ===========================================================
-- IOT SENSORS & DEVICES
-- ===========================================================
CREATE TABLE IF NOT EXISTS sensors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(100) UNIQUE NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    device_name VARCHAR(100),
    -- Use text/UUID without FK constraint first, add constraints after vehicles/trailers exist
    vehicle_id UUID,
    trailer_id UUID,
    
    -- Configuration
    sensor_config JSONB DEFAULT '{}'::jsonb,
    installed_at TIMESTAMP WITH TIME ZONE,
    last_calibration TIMESTAMP WITH TIME ZONE,
    warranty_expiry DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE',
    battery_level INTEGER,
    signal_strength INTEGER,
    firmware_version VARCHAR(50),
    last_seen_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensors_vehicle ON sensors(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_sensors_device ON sensors(device_id);
CREATE INDEX IF NOT EXISTS idx_sensors_status ON sensors(status);

-- Add foreign key constraints separately after vehicles/trailers tables exist
-- ALTER TABLE sensors ADD CONSTRAINT fk_sensors_vehicle 
--     FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
-- ALTER TABLE sensors ADD CONSTRAINT fk_sensors_trailer 
--     FOREIGN KEY (trailer_id) REFERENCES trailers(id) ON DELETE SET NULL;

-- ===========================================================
-- SENSOR READINGS (Time-Series Data)
-- ===========================================================
CREATE TABLE IF NOT EXISTS sensor_readings (
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    sensor_id UUID REFERENCES sensors(id),
    shipment_id UUID,
    vehicle_id UUID, -- References vehicles(id) - add constraint after vehicles table exists
    
    -- Location (for GPS devices)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    altitude DECIMAL(8, 2),
    speed_kmh DECIMAL(5, 2),
    heading DECIMAL(5, 2),
    accuracy_meters INTEGER,
    
    -- Temperature (for reefers)
    cargo_temp_celsius DECIMAL(4, 2),
    ambient_temp_celsius DECIMAL(4, 2),
    humidity_percent DECIMAL(5, 2),
    
    -- Vehicle Health (OBD-II)
    engine_rpm INTEGER,
    coolant_temp_celsius DECIMAL(5, 2),
    engine_load_percent DECIMAL(5, 2),
    fuel_level_percent DECIMAL(5, 2),
    odometer_km DECIMAL(10, 2),
    fault_codes TEXT[],
    
    -- Reefer Specific
    reefer_unit_status VARCHAR(20),
    door_open BOOLEAN,
    
    -- Additional telemetry
    additional_data JSONB DEFAULT '{}'::jsonb
);

-- Convert to TimescaleDB hypertable (if TimescaleDB extension is available)
-- Note: Run this separately after confirming TimescaleDB is installed
-- SELECT create_hypertable('sensor_readings', 'time', chunk_time_interval => INTERVAL '1 day');

-- Regular indexes for non-TimescaleDB installations
CREATE INDEX IF NOT EXISTS idx_sensor_readings_time ON sensor_readings(time DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor ON sensor_readings(sensor_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_shipment ON sensor_readings(shipment_id, time DESC);

-- ===========================================================
-- COMPLIANCE DOCUMENTS
-- ===========================================================
CREATE TABLE IF NOT EXISTS compliance_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(50) NOT NULL,
    document_category VARCHAR(50),
    
    reference_number VARCHAR(100) NOT NULL,
    linked_entity_type VARCHAR(50),
    linked_entity_id UUID,
    
    issuing_authority VARCHAR(200),
    issue_date DATE NOT NULL,
    expiry_date DATE,
    
    document_file_url VARCHAR(500),
    verification_status VARCHAR(20) DEFAULT 'PENDING',
    
    applicable_countries TEXT[],
    mandatory_for_cargo_types TEXT[],
    
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_sent_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_entity ON compliance_documents(linked_entity_type, linked_entity_id);
CREATE INDEX IF NOT EXISTS idx_compliance_expiry ON compliance_documents(expiry_date);

-- ===========================================================
-- EVENT LOG (Immutable Chain of Custody)
-- ===========================================================
CREATE TABLE IF NOT EXISTS event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50) DEFAULT 'OPERATIONAL',
    severity VARCHAR(20) DEFAULT 'INFO',
    
    shipment_id UUID,
    vehicle_id UUID, -- References vehicles(id) - add constraint after table exists
    driver_id UUID, -- References user_profiles(id)
    sensor_id UUID REFERENCES sensors(id),
    
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    location JSONB,
    
    photo_urls TEXT[],
    document_urls TEXT[],
    signature_data TEXT,
    
    verified_by UUID, -- References user_profiles(id)
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_method VARCHAR(50),
    
    previous_hash VARCHAR(64),
    event_hash VARCHAR(64),
    blockchain_tx_hash VARCHAR(64),
    
    source_system VARCHAR(50) DEFAULT 'CALVARY_OS',
    source_device_id VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_log_shipment ON event_log(shipment_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type, event_timestamp DESC);

-- ===========================================================
-- MOBILE MONEY TRANSACTIONS
-- ===========================================================
CREATE TABLE IF NOT EXISTS mobile_money_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_reference VARCHAR(100) UNIQUE NOT NULL,
    
    provider VARCHAR(20) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TZS',
    fees DECIMAL(10,2) DEFAULT 0,
    
    sender_phone VARCHAR(20),
    sender_name VARCHAR(100),
    recipient_phone VARCHAR(20),
    recipient_name VARCHAR(100),
    
    invoice_id UUID,
    shipment_id UUID, -- References shipments(id)
    driver_id UUID, -- References user_profiles(id)
    
    status VARCHAR(20) DEFAULT 'PENDING',
    provider_transaction_id VARCHAR(100),
    provider_status VARCHAR(50),
    
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    webhook_received BOOLEAN DEFAULT FALSE,
    webhook_payload JSONB,
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_money_shipment ON mobile_money_transactions(shipment_id);
CREATE INDEX IF NOT EXISTS idx_mobile_money_driver ON mobile_money_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_mobile_money_status ON mobile_money_transactions(status);

-- ===========================================================
-- ROUTE CONSTRAINTS (For Lowbed/Heavy Cargo)
-- ===========================================================
CREATE TABLE IF NOT EXISTS route_constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    constraint_type VARCHAR(50) NOT NULL,
    
    start_lat DECIMAL(10, 8) NOT NULL,
    start_lng DECIMAL(11, 8) NOT NULL,
    end_lat DECIMAL(10, 8),
    end_lng DECIMAL(11, 8),
    
    limit_value DECIMAL(10, 2),
    limit_unit VARCHAR(20),
    
    applicable_vehicle_types TEXT[],
    applicable_countries TEXT[],
    
    active_start_time TIME,
    active_end_time TIME,
    active_days TEXT[],
    
    bypass_route_description TEXT,
    requires_permit BOOLEAN DEFAULT FALSE,
    permit_type VARCHAR(50),
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_constraints_type ON route_constraints(constraint_type);
CREATE INDEX IF NOT EXISTS idx_route_constraints_countries ON route_constraints USING GIN(applicable_countries);

-- ===========================================================
-- SUSTAINABILITY METRICS
-- ===========================================================
CREATE TABLE IF NOT EXISTS sustainability_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL,
    
    vehicle_id UUID, -- References vehicles(id) - add after table exists
    driver_id UUID, -- References user_profiles(id)
    shipment_id UUID,
    
    fuel_consumed_liters DECIMAL(8, 2),
    distance_km DECIMAL(8, 2),
    co2_emissions_kg DECIMAL(8, 2),
    fuel_efficiency_km_per_liter DECIMAL(5, 2),
    
    idling_minutes INTEGER,
    idling_fuel_liters DECIMAL(6, 2),
    harsh_acceleration_events INTEGER,
    harsh_braking_events INTEGER,
    speeding_events INTEGER,
    
    eco_driving_score INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sustainability_vehicle ON sustainability_metrics(vehicle_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_sustainability_date ON sustainability_metrics(metric_date);

-- ===========================================================
-- WHATSAPP MESSAGE LOG
-- ===========================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    message_type VARCHAR(50),
    template_name VARCHAR(100),
    recipient_phone VARCHAR(20) NOT NULL,
    recipient_type VARCHAR(20),
    
    message_text TEXT,
    media_url VARCHAR(500),
    
    shipment_id UUID, -- References shipments(id)
    
    status VARCHAR(20) DEFAULT 'QUEUED',
    wa_message_id VARCHAR(100),
    
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    reply_received BOOLEAN DEFAULT FALSE,
    reply_text TEXT,
    reply_received_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_shipment ON whatsapp_messages(shipment_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON whatsapp_messages(recipient_phone);

-- ===========================================================
-- GEOFENCES
-- ===========================================================
CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    geofence_type VARCHAR(50), -- DEPOT, BORDER, CUSTOMER, RESTRICTED
    
    -- Geometry (simplified as JSON for flexibility)
    geometry JSONB NOT NULL, -- {type: 'circle', center: {lat, lng}, radius: 500} or {type: 'polygon', coordinates: [...]}
    
    -- Alert configuration
    entry_alert BOOLEAN DEFAULT TRUE,
    exit_alert BOOLEAN DEFAULT TRUE,
    dwell_time_alert INTEGER, -- minutes (alert if vehicle stays longer)
    
    applicable_vehicle_types TEXT[],
    applicable_vehicles UUID[], -- specific vehicles
    
    active BOOLEAN DEFAULT TRUE,
    schedule JSONB, -- Optional time-based activation
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofences_type ON geofences(geofence_type);

-- ===========================================================
-- VEHICLE MAINTENANCE SCHEDULES
-- ===========================================================
CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID, -- References vehicles(id) - add after table exists
    
    schedule_type VARCHAR(50), -- MILEAGE_BASED, TIME_BASED, CONDITION_BASED
    
    -- Trigger conditions
    mileage_interval INTEGER, -- every X km
    time_interval_days INTEGER, -- every X days
    
    -- Last service
    last_service_mileage DECIMAL(10, 2),
    last_service_date DATE,
    
    -- Next due
    next_service_mileage DECIMAL(10, 2),
    next_service_date DATE,
    
    -- Service items
    service_items JSONB, -- [{item: 'Oil Change', part_id: ..., estimated_cost: ...}]
    
    status VARCHAR(20) DEFAULT 'ACTIVE',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_schedules(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_due ON maintenance_schedules(next_service_date);

-- ===========================================================
-- TRIGGER FUNCTIONS FOR UPDATED_AT
-- ===========================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables that need updated_at
DROP TRIGGER IF EXISTS update_shipments_updated_at ON shipments;
CREATE TRIGGER update_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===========================================================
-- ROW LEVEL SECURITY POLICIES
-- ===========================================================
-- NOTE: These RLS policies reference user_profiles and trips tables.
-- Run this section ONLY after user_profiles, vehicles, trailers, and trips tables exist.
-- For now, RLS is disabled. Uncomment and run after base tables are created.

/*
-- Enable RLS on all new tables
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_money_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE sustainability_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;

-- Shipments RLS
CREATE POLICY "Users can view assigned shipments" ON shipments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('CEO', 'ADMIN', 'OPERATOR')
        )
        OR customer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM trips t 
            WHERE t.id = shipments.id AND t.driver_id = auth.uid()
        )
    );

CREATE POLICY "Operators can manage shipments" ON shipments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('CEO', 'ADMIN', 'OPERATOR')
        )
    );

-- Customers RLS
CREATE POLICY "Users can view own customer profile" ON customers
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage customers" ON customers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('CEO', 'ADMIN')
        )
    );

-- Sensors RLS
CREATE POLICY "Authenticated users can view sensors" ON sensors
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage sensors" ON sensors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('CEO', 'ADMIN', 'OPERATOR')
        )
    );

-- Event Log RLS (Append-only, everyone can read)
CREATE POLICY "Authenticated users can view event log" ON event_log
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert events" ON event_log
    FOR INSERT WITH CHECK (true);

-- Mobile Money RLS
CREATE POLICY "Users can view related transactions" ON mobile_money_transactions
    FOR SELECT USING (
        shipment_id IN (
            SELECT id FROM shipments WHERE customer_id = auth.uid()
        )
        OR driver_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('CEO', 'ADMIN', 'ACCOUNTANT')
        )
    );

CREATE POLICY "Admins can manage transactions" ON mobile_money_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('CEO', 'ADMIN', 'ACCOUNTANT')
        )
    );
*/

-- ===========================================================
-- SEED DATA FOR ROUTE CONSTRAINTS (Sample)
-- ===========================================================

INSERT INTO route_constraints (
    constraint_type, start_lat, start_lng, end_lat, end_lng,
    limit_value, limit_unit, applicable_vehicle_types, applicable_countries,
    notes
) VALUES 
-- Bridge weight limits
('BRIDGE_MAX_WEIGHT', -6.7924, 39.2083, NULL, NULL, 40000, 'KG', 
 ARRAY['TRUCK_HEAD', 'LOWBED'], ARRAY['Tanzania'], 
 'Msimbazi Bridge - 40 ton limit'),

('BRIDGE_MAX_WEIGHT', -1.2921, 36.8219, NULL, NULL, 35000, 'KG',
 ARRAY['TRUCK_HEAD', 'LOWBED'], ARRAY['Kenya'],
 'Nairobi River Bridge - 35 ton limit'),

-- Tunnel height limits
('TUNNEL_HEIGHT', -6.7924, 39.2083, NULL, NULL, 4.2, 'METER',
 ARRAY['DUMP_TRUCK', 'TRUCK_HEAD'], ARRAY['Tanzania'],
 'Kariakoo Tunnel - 4.2m height limit'),

-- Width restrictions
('WIDTH_RESTRICTION', -1.6585, 29.2203, NULL, NULL, 3.5, 'METER',
 ARRAY['LOWBED', 'TRUCK_HEAD'], ARRAY['DRC'],
 'Goma narrow pass - 3.5m width limit');

-- ===========================================================
-- FUNCTIONS
-- ===========================================================

-- Function to generate shipment number
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    year_part VARCHAR(4);
    sequence_num INTEGER;
    new_number VARCHAR(20);
BEGIN
    year_part := EXTRACT(YEAR FROM NOW())::VARCHAR;
    
    -- Get the next sequence number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(shipment_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM shipments
    WHERE shipment_number LIKE 'SHP-' || year_part || '-%';
    
    new_number := 'SHP-' || year_part || '-' || LPAD(sequence_num::VARCHAR, 5, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate distance between coordinates (Haversine)
CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 DECIMAL(10, 8),
    lon1 DECIMAL(11, 8),
    lat2 DECIMAL(10, 8),
    lon2 DECIMAL(11, 8)
)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
    R DECIMAL := 6371; -- Earth's radius in km
    dlat DECIMAL;
    dlon DECIMAL;
    a DECIMAL;
    c DECIMAL;
    d DECIMAL;
BEGIN
    dlat := RADIANS(lat2 - lat1);
    dlon := RADIANS(lon2 - lon1);
    a := SIN(dlat/2) * SIN(dlat/2) +
         COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
         SIN(dlon/2) * SIN(dlon/2);
    c := 2 * ATAN2(SQRT(a), SQRT(1-a));
    d := R * c;
    RETURN ROUND(d, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to check geofence violation
CREATE OR REPLACE FUNCTION check_geofence_violation(
    vehicle_lat DECIMAL(10, 8),
    vehicle_lng DECIMAL(11, 8),
    geofence_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    geofence_record RECORD;
    distance DECIMAL;
BEGIN
    SELECT * INTO geofence_record FROM geofences WHERE id = geofence_id;
    
    IF geofence_record.geometry->>'type' = 'circle' THEN
        distance := calculate_distance_km(
            vehicle_lat, vehicle_lng,
            (geofence_record.geometry->'center'->>'lat')::DECIMAL,
            (geofence_record.geometry->'center'->>'lng')::DECIMAL
        );
        RETURN distance > (geofence_record.geometry->>'radius')::DECIMAL / 1000;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================
-- VIEWS FOR REPORTING
-- ===========================================================

-- Active shipments view
-- Note: This view references vehicles and user_profiles which may not exist yet
-- Create these tables first or run this view creation after they exist
CREATE OR REPLACE VIEW v_active_shipments AS
SELECT 
    s.*,
    c.company_name as customer_name,
    s.vehicle_id as vehicle_plate, -- Placeholder until vehicles table exists
    s.driver_id as driver_name -- Placeholder until user_profiles exists
FROM shipments s
LEFT JOIN customers c ON s.customer_id = c.user_id
WHERE s.status NOT IN ('COMPLETED', 'CANCELLED', 'ARCHIVED');

-- Enhanced version after vehicles and user_profiles exist:
-- CREATE OR REPLACE VIEW v_active_shipments_full AS
-- SELECT 
--     s.*,
--     c.company_name as customer_name,
--     v.plate_number as vehicle_plate,
--     u.name as driver_name,
--     u.phone as driver_phone
-- FROM shipments s
-- LEFT JOIN customers c ON s.customer_id = c.user_id
-- LEFT JOIN vehicles v ON s.vehicle_id = v.id
-- LEFT JOIN user_profiles u ON s.driver_id = u.id
-- WHERE s.status NOT IN ('COMPLETED', 'CANCELLED', 'ARCHIVED');

-- Daily sustainability summary
CREATE OR REPLACE VIEW v_daily_sustainability AS
SELECT 
    metric_date,
    SUM(co2_emissions_kg) as total_co2_kg,
    SUM(fuel_consumed_liters) as total_fuel_liters,
    SUM(distance_km) as total_distance_km,
    AVG(fuel_efficiency_km_per_liter) as avg_fuel_efficiency,
    SUM(idling_minutes) as total_idling_minutes,
    AVG(eco_driving_score) as avg_eco_score
FROM sustainability_metrics
GROUP BY metric_date
ORDER BY metric_date DESC;

-- Compliance expiry alerts
CREATE OR REPLACE VIEW v_compliance_expiry_alerts AS
SELECT 
    cd.*,
    CASE 
        WHEN cd.expiry_date <= CURRENT_DATE THEN 'EXPIRED'
        WHEN cd.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
        ELSE 'VALID'
    END as alert_status,
    (cd.expiry_date - CURRENT_DATE) as days_until_expiry
FROM compliance_documents cd
WHERE cd.expiry_date IS NOT NULL
AND cd.expiry_date <= CURRENT_DATE + INTERVAL '60 days'
AND cd.verification_status = 'VALID';

-- ===========================================================
-- END OF SCHEMA
-- ===========================================================
