-- vehicles.plate_number has a plain, table-wide UNIQUE constraint
-- (000_legacy_base_schema.sql: `plate_number TEXT UNIQUE`). But
-- 057_security_hardening.sql's vehicle deletion function is a SOFT delete —
-- it sets deleted_at/status/deletion_reason and leaves the row (and its
-- plate_number) in the table forever, for audit/history. Every place that
-- lists vehicles filters `deleted_at IS NULL`, so a sold/decommissioned
-- vehicle disappears from the fleet list — but its plate_number still
-- occupies the unique constraint, so that plate can never be used again by
-- any new vehicle. Confirmed live: "Add failed. A vehicle with this plate
-- already exists." on a plate that appears nowhere in the active fleet list.
--
-- Fix: replace the blanket UNIQUE constraint with a partial unique index
-- scoped to active vehicles only (deleted_at IS NULL) — the standard
-- pattern for uniqueness alongside soft delete. Two still-active vehicles
-- can never collide on a plate (same as before); a plate freed up by a
-- sale/decommission can be reused.

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_plate_number_key;
DROP INDEX IF EXISTS vehicles_plate_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_plate_number_active_unique
  ON vehicles (plate_number)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
