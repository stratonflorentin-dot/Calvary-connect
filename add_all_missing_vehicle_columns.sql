-- Add all missing columns to vehicles table in one migration

-- Add fuel_type column
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT 'diesel';

-- Add next_service_date column
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS next_service_date DATE;

-- Add last_service_date column (commonly used with next_service_date)
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS last_service_date DATE;

-- Add fuel_capacity column if not exists
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS fuel_capacity DECIMAL(10,2);

-- Add mileage column if not exists  
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS mileage INTEGER DEFAULT 0;

-- Add trailer_sub_type column if not exists (for trailers)
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS trailer_sub_type TEXT;

-- Comments for documentation
COMMENT ON COLUMN vehicles.fuel_type IS 'Fuel type: diesel, petrol, electric, hybrid';
COMMENT ON COLUMN vehicles.next_service_date IS 'Scheduled date for next service';
COMMENT ON COLUMN vehicles.last_service_date IS 'Date of last service performed';
COMMENT ON COLUMN vehicles.fuel_capacity IS 'Fuel tank capacity in liters';
COMMENT ON COLUMN vehicles.mileage IS 'Current vehicle mileage/kilometers';
COMMENT ON COLUMN vehicles.trailer_sub_type IS 'For trailers: LOWBED, FLATBED, TANKER, etc.';
