-- Add truck/trailer, job card, and technician phone support to maintenance records
ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS trailer_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_card_number TEXT,
  ADD COLUMN IF NOT EXISTS technician_phone TEXT;

-- Optional index for trailer lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_records_trailer_id ON maintenance_records(trailer_id);
