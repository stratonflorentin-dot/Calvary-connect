-- customers.credit_limit was a single numeric column always rendered as
-- "Tsh X" in the UI, but customers are contracted in both TZS and USD
-- (same multi-currency reality already handled elsewhere: invoices,
-- trips, rate sheets). Without a currency on the limit itself, a
-- USD-denominated credit limit displays as if it were TZS and gets
-- summed into a single misleading total.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS credit_limit_currency text NOT NULL DEFAULT 'TZS';

ALTER TABLE public.customers
  ADD CONSTRAINT customers_credit_limit_currency_check
  CHECK (credit_limit_currency IN ('TZS', 'USD'));
