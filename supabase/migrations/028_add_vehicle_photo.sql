-- Adds a photo to vehicles so the fleet list/detail pages and the "add
-- vehicle" form can show a picture of the truck/trailer.
--
-- The public storage bucket itself ("vehicle-photos") was already created
-- via the Supabase Storage API (not SQL) — this migration only adds the
-- column that stores its public URL. Idempotent: safe to run more than once.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN vehicles.photo_url IS 'Public URL of the vehicle photo in the vehicle-photos storage bucket.';
