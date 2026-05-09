-- ==========================================================================
-- PRODUCTION DATA CLEANUP FOR CALVARY CONNECT
-- Purpose: remove demo/test/dummy records from operational tables only.
-- Run in Supabase SQL Editor after backing up your database.
-- ==========================================================================

BEGIN;

-- Financial operations
DELETE FROM bank_accounts
WHERE LOWER(COALESCE(account_name, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(bank_name, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(account_number, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%';

DELETE FROM invoices
WHERE LOWER(COALESCE(client_name, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(invoice_number, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(description, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%';

DELETE FROM expenses
WHERE LOWER(COALESCE(description, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(category, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(expense_number, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR COALESCE(amount, 0) = 0;

DELETE FROM sales
WHERE LOWER(COALESCE(client_name, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%';

DELETE FROM purchases
WHERE LOWER(COALESCE(client_name, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(receipt_id, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%';

-- Fleet operations
DELETE FROM trips
WHERE LOWER(COALESCE(origin, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(destination, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(cargo, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(client, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%';

DELETE FROM vehicles
WHERE LOWER(COALESCE(plate_number, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(make, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(model, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%';

DELETE FROM customers
WHERE LOWER(COALESCE(name, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%'
   OR LOWER(COALESCE(company_name, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%';

-- Reports and workflow records
DELETE FROM reports
WHERE LOWER(COALESCE(title, '')) SIMILAR TO '%(dummy|dumyy|demo|test|sample|mock|placeholder)%';

COMMIT;

SELECT 'Production cleanup complete. Demo/dummy operational records removed.' AS status;
