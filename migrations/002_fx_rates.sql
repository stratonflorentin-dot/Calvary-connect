-- Foreign-exchange rates.
--
-- Rows represent "1 unit of from_ccy = rate units of to_ccy on
-- effective_date." The FX service always picks the most recent row with
-- effective_date <= the query date. Historical rates are preserved so
-- backdated conversions stay stable.

CREATE TABLE IF NOT EXISTS fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_ccy text NOT NULL CHECK (char_length(from_ccy) = 3),
  to_ccy   text NOT NULL CHECK (char_length(to_ccy) = 3),
  rate     numeric(18, 6) NOT NULL CHECK (rate > 0),
  effective_date date NOT NULL,
  source   text,
  note     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (from_ccy, to_ccy, effective_date)
);

CREATE INDEX IF NOT EXISTS fx_rates_lookup_idx
  ON fx_rates (from_ccy, to_ccy, effective_date DESC);

-- Optional seed: identity rates for the common set. Safe to re-run.
INSERT INTO fx_rates (from_ccy, to_ccy, rate, effective_date, source, note)
VALUES
  ('TZS', 'TZS', 1, CURRENT_DATE, 'seed', 'identity'),
  ('USD', 'USD', 1, CURRENT_DATE, 'seed', 'identity'),
  ('EUR', 'EUR', 1, CURRENT_DATE, 'seed', 'identity'),
  ('KES', 'KES', 1, CURRENT_DATE, 'seed', 'identity')
ON CONFLICT (from_ccy, to_ccy, effective_date) DO NOTHING;
