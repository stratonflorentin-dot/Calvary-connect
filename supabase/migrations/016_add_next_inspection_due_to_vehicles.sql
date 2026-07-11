-- Add next_inspection_due column to vehicles table
-- This field allows tracking when the next vehicle inspection is due
-- Similar to next_service_date which already exists for maintenance

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS next_inspection_due DATE;

-- Add comment for documentation
COMMENT ON COLUMN vehicles.next_inspection_due IS 'Date when the next vehicle inspection is due (for planning purposes)';
