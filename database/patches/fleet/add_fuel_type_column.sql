-- Add fuel_type column to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT 'diesel';

-- Add comment for the column
COMMENT ON COLUMN vehicles.fuel_type IS 'Fuel type: diesel, petrol, electric, hybrid';
