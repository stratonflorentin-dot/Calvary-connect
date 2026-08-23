-- The "Scan Now" fuel-anomaly upsert (src/lib/fuel-fraud-detection.ts,
-- insertNewAnomalies) does `.upsert(anomalies, { onConflict: "dedupe_key" })`,
-- which PostgREST translates to a plain `ON CONFLICT (dedupe_key)` clause.
-- Postgres will only use a partial unique index as an ON CONFLICT arbiter
-- when the INSERT statement's own WHERE predicate matches the index's
-- predicate exactly — something the Supabase JS client has no way to supply.
-- Migration 075 created idx_fuel_anomalies_dedupe_key as a PARTIAL index
-- (WHERE dedupe_key IS NOT NULL), so every scan run failed with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Fix: replace it with a full (non-partial) unique index. This is behavior
-- preserving — dedupe_key is always populated by the code path that inserts
-- through this table (never NULL), and Postgres unique indexes already treat
-- NULL <> NULL, so any legacy NULL-dedupe_key rows still don't collide.

DROP INDEX IF EXISTS public.idx_fuel_anomalies_dedupe_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_anomalies_dedupe_key
  ON public.fuel_anomalies (dedupe_key);
