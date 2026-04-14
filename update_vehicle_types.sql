-- Update vehicle types enum in the database
-- Add trailer_sub_type column for trailers

-- Add trailer_sub_type column if it doesn't exist
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS trailer_sub_type TEXT;

-- Update existing vehicle types to match new enum
UPDATE vehicles 
SET type = 'DUMP_TRUCK' 
WHERE type IN ('TRUCK', 'truck', 'Dump Truck', 'Dump_Truck');

UPDATE vehicles 
SET type = 'TRUCK_HEAD' 
WHERE type IN ('HOSE', 'hose', 'Hose', 'Truck Head', 'Truck_Head');

UPDATE vehicles 
SET type = 'ESCORT_CAR' 
WHERE type IN ('ESCORT', 'escort', 'Escort', 'Escort Car', 'Car');

UPDATE vehicles 
SET type = 'TRAILER' 
WHERE type IN ('trailer', 'Trailer', 'TRAILER');

-- Set trailer sub-type for existing trailers (default to LOWBED)
UPDATE vehicles 
SET trailer_sub_type = 'LOWBED' 
WHERE type = 'TRAILER' AND trailer_sub_type IS NULL;
