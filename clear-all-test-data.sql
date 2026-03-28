-- ============================================================================
-- CLEAR ALL TEST/DEMO DATA FROM DATABASE
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Delete test purchases
DELETE FROM purchases 
WHERE LOWER(client_name) LIKE '%test%'
   OR LOWER(receipt_id) LIKE 'test-%'
   OR LOWER(receipt_id) LIKE 'rec-%';

-- Delete test sales
DELETE FROM sales 
WHERE LOWER(client_name) LIKE '%test%' 
   OR LOWER(client_name) LIKE '%demo%' 
   OR LOWER(client_name) LIKE '%sample%';

-- Delete test expenses
DELETE FROM expenses 
WHERE LOWER(description) LIKE '%test%' 
   OR amount = 0;

-- Delete test invoices
DELETE FROM invoices 
WHERE LOWER(client_name) LIKE '%test%' 
   OR LOWER(client_name) LIKE '%demo%';

-- Delete test fuel requests
DELETE FROM fuel_requests 
WHERE driver_id::text LIKE '%test%';

-- Delete test allowances
DELETE FROM allowances 
WHERE amount = 0;

-- Delete test taxes
DELETE FROM taxes 
WHERE LOWER(type) LIKE '%test%';

-- Delete test reports
DELETE FROM reports 
WHERE LOWER(title) LIKE '%test%' 
   OR LOWER(title) LIKE '%demo%';

-- Delete test vehicles
DELETE FROM vehicles 
WHERE LOWER(plate_number) LIKE '%test%';

-- Delete test trips
DELETE FROM trips 
WHERE LOWER(destination) LIKE '%test%'
   OR LOWER(origin) LIKE '%test%';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 'All test/demo data cleared successfully!' as status;
