-- fuel-approvals/page.tsx failed with "Could not embed because more than
-- one relationship was found for 'fuel_requests' and 'user_profiles'".
--
-- Root cause: fuel_requests.driver_id has TWO foreign keys pointing at
-- user_profiles.id — the original fuel_requests_driver_id_fkey, plus a
-- duplicate fk_fuel_requests_driver_id that migration 046
-- (046_fuel_requests_vehicle_fk.sql) added defensively without checking
-- whether a driver_id FK already existed under a different name.
-- PostgREST can no longer pick a relationship for the driver:user_profiles(name)
-- embed shorthand.
--
-- Separately, migration 046's vehicle_id handling only converted the
-- column's type and added its FK *if the column already existed* — it
-- never actually created vehicle_id when missing. It has been missing
-- ever since, so vehicle:vehicles(...) has never actually worked either.
-- Adding it now so the page's vehicle embed has something real to embed.

ALTER TABLE public.fuel_requests DROP CONSTRAINT IF EXISTS fk_fuel_requests_driver_id;

ALTER TABLE public.fuel_requests
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
