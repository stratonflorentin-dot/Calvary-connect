-- Add payment_status column to trips table
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';

-- Comment for documentation
COMMENT ON COLUMN trips.payment_status IS 'Payment status: PENDING, PAID (full payment), ADVANCE (advance payment)';
