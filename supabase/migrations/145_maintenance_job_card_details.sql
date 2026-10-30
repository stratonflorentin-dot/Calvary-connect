ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS job_card_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS odometer_reading_km NUMERIC(12, 1),
  ADD COLUMN IF NOT EXISTS engine_hours NUMERIC(12, 1),
  ADD COLUMN IF NOT EXISTS driver_name TEXT,
  ADD COLUMN IF NOT EXISTS driver_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_company_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_contact_person TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS inspection_findings TEXT,
  ADD COLUMN IF NOT EXISTS work_performed TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_performed_other TEXT,
  ADD COLUMN IF NOT EXISTS parts_used JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS completion_notes TEXT,
  ADD COLUMN IF NOT EXISTS technician_signature TEXT,
  ADD COLUMN IF NOT EXISTS driver_confirmation_name TEXT,
  ADD COLUMN IF NOT EXISTS driver_confirmation_signature TEXT,
  ADD COLUMN IF NOT EXISTS driver_confirmation_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_maintenance_records_customer_id ON maintenance_records(customer_id);
