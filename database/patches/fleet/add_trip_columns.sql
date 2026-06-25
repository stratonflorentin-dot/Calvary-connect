-- Add trip type and VAT columns to trips table
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS trip_type TEXT, -- 'transit' or 'local'
ADD COLUMN IF NOT EXISTS trip_category TEXT, -- 'town' or 'regional' (for local trips)
ADD COLUMN IF NOT EXISTS sales_amount DECIMAL,
ADD COLUMN IF NOT EXISTS vat_rate INTEGER DEFAULT 18, -- 0 or 18
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL;
