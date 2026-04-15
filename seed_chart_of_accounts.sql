-- Seed Chart of Accounts for Logistics Operations
-- Insert all accounts with their specified codes

-- Clear existing accounts first (if re-running)
-- DELETE FROM journal_entry_lines WHERE account_code IN (SELECT code FROM accounts);
-- DELETE FROM accounts;

-- 1. ASSETS (1000–1999)
-- Parent: Cash & Bank (1000)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('1000', 'Cash & Bank', 'ASSETS', 'Current Assets', 'debit', 'Cash and bank account group', NULL),
('1001', 'Petty Cash', 'ASSETS', 'Current Assets', 'debit', 'Cash on Hand for small expenses', '1000'),
('1002', 'Bank Account', 'ASSETS', 'Current Assets', 'debit', 'Main operating bank account', '1000'),
('1003', 'Mobile Money', 'ASSETS', 'Current Assets', 'debit', 'M-Pesa, Tigo Pesa, Airtel Money balances', '1000'),
('1004', 'Cash in Transit', 'ASSETS', 'Current Assets', 'debit', 'Money sent but not yet received', '1000');

-- Parent: Receivables (1100)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('1100', 'Accounts Receivable', 'ASSETS', 'Current Assets', 'debit', 'Money owed by clients for services', NULL),
('1101', 'Transit Receivables', 'ASSETS', 'Current Assets', 'debit', 'Outstanding payments for transit freight', '1100'),
('1102', 'Local Delivery Receivables', 'ASSETS', 'Current Assets', 'debit', 'Outstanding payments for local deliveries', '1100'),
('1103', 'Driver Advances', 'ASSETS', 'Current Assets', 'debit', 'Money given to drivers before trips', '1100'),
('1104', 'Staff Advances', 'ASSETS', 'Current Assets', 'debit', 'Non-driver staff advances', '1100');

-- Other Current Assets
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('1200', 'Prepaid Expenses', 'ASSETS', 'Current Assets', 'debit', 'Insurance premiums, licenses paid in advance', NULL),
('1300', 'Fuel Inventory', 'ASSETS', 'Current Assets', 'debit', 'Fuel stored for fleet operations', NULL),
('1301', 'Spare Parts Inventory', 'ASSETS', 'Current Assets', 'debit', 'Vehicle spare parts in stock', NULL);

-- Non-Current Assets - Fixed Assets (1500)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('1500', 'Fixed Assets', 'ASSETS', 'Non-Current Assets', 'debit', 'Fixed assets group', NULL),
('1501', 'Vehicles', 'ASSETS', 'Non-Current Assets', 'debit', 'Trucks, vans, and other fleet vehicles', '1500'),
('1502', 'Trailers', 'ASSETS', 'Non-Current Assets', 'debit', 'Trailer assets', '1500'),
('1503', 'Office Equipment', 'ASSETS', 'Non-Current Assets', 'debit', 'Office furniture and equipment', '1500'),
('1504', 'IT Systems', 'ASSETS', 'Non-Current Assets', 'debit', 'Computers, servers, software', '1500'),
('1600', 'Accumulated Depreciation', 'ASSETS', 'Non-Current Assets', 'credit', 'Total depreciation of fixed assets', '1500');

-- 2. LIABILITIES (2000–2999)
-- Current Liabilities
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('2001', 'Accounts Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Money owed to vendors and suppliers'),
('2002', 'Fuel Creditors', 'LIABILITIES', 'Current Liabilities', 'credit', 'Outstanding fuel payments'),
('2003', 'Driver Allowances Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Driver wages and allowances owed'),
('2004', 'Salaries Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Outstanding staff salaries'),
('2005', 'Taxes Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'VAT, PAYE, and other taxes owed'),
('2006', 'Customs Duties Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Import duties and customs fees owed'),
('2007', 'Customer Deposits', 'LIABILITIES', 'Current Liabilities', 'credit', 'Advance payments from clients (not revenue yet)');

-- Long-Term Liabilities
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('2500', 'Vehicle Loans', 'LIABILITIES', 'Long-Term Liabilities', 'credit', 'Loans for vehicle purchases'),
('2501', 'Bank Loans', 'LIABILITIES', 'Long-Term Liabilities', 'credit', 'General bank loans and overdrafts');

-- 3. EQUITY (3000–3999)
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('3001', 'Owner Capital', 'EQUITY', 'Equity', 'credit', 'Owner investments in the business'),
('3002', 'Retained Earnings', 'EQUITY', 'Equity', 'credit', 'Accumulated profits retained in business'),
('3003', 'Drawings', 'EQUITY', 'Equity', 'debit', 'Owner withdrawals from business');

-- 4. REVENUE (4000–4999)
-- Core Revenue
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('4001', 'Transit Freight Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Income from international transit freight'),
('4002', 'Local Delivery Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Income from local delivery services'),
('4003', 'Clearing & Forwarding Fees', 'REVENUE', 'Core Revenue', 'credit', 'Customs clearing and forwarding income'),
('4004', 'Warehousing Fees', 'REVENUE', 'Core Revenue', 'credit', 'Storage and warehousing charges');

-- Other Income
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('4100', 'Fuel Surcharge Income', 'REVENUE', 'Other Income', 'credit', 'Additional charges for fuel price fluctuations'),
('4101', 'Demurrage Charges', 'REVENUE', 'Other Income', 'credit', 'Charges for delays at loading/unloading'),
('4102', 'Late Delivery Penalties Collected', 'REVENUE', 'Other Income', 'credit', 'Penalties charged for late deliveries'),
('4103', 'Storage Penalties', 'REVENUE', 'Other Income', 'credit', 'Charges for storage beyond free period'),
('4104', 'Documentation Fees', 'REVENUE', 'Other Income', 'credit', 'Fees for preparing shipping documents');

-- 5. COST OF SALES / DIRECT COSTS (5000–5999)
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('5001', 'Fuel Expense', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Fuel costs directly tied to trips'),
('5002', 'Driver Wages - Trip Based', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Driver payments per trip'),
('5003', 'Turnboy/Assistant Wages', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Assistant crew wages for trips'),
('5004', 'Tolls & Road Charges', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Highway tolls and road fees'),
('5005', 'Vehicle Maintenance - Trip', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Maintenance costs directly from trips'),
('5006', 'Customs Clearing Costs', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Customs fees for transit goods'),
('5007', 'Insurance per Trip', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Insurance costs allocated per trip'),
('5008', 'Driver Allowances (Per Diem)', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Daily allowances for drivers on trips'),
('5009', 'Weighbridge Fees', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Weighbridge charges for cargo weighing'),
('5010', 'Parking Fees', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Parking charges during trips');

-- 6. OPERATING EXPENSES (6000–6999)
-- Admin Expenses
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('6001', 'Salaries - Office Staff', 'OPERATING_EXPENSES', 'Admin Expenses', 'debit', 'Office and administrative staff salaries'),
('6002', 'Rent', 'OPERATING_EXPENSES', 'Admin Expenses', 'debit', 'Office and warehouse rent'),
('6003', 'Utilities', 'OPERATING_EXPENSES', 'Admin Expenses', 'debit', 'Electricity, water, and other utilities'),
('6004', 'Internet & Software', 'OPERATING_EXPENSES', 'Admin Expenses', 'debit', 'Internet, software subscriptions, licenses');

-- Transport Overheads
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('6100', 'Vehicle Repairs & Maintenance', 'OPERATING_EXPENSES', 'Transport Overheads', 'debit', 'General fleet maintenance and repairs'),
('6101', 'Insurance - Annual', 'OPERATING_EXPENSES', 'Transport Overheads', 'debit', 'Annual vehicle and business insurance'),
('6102', 'Licensing & Permits', 'OPERATING_EXPENSES', 'Transport Overheads', 'debit', 'Vehicle licenses, road permits, certifications'),
('6103', 'Tracking System Costs', 'OPERATING_EXPENSES', 'Transport Overheads', 'debit', 'GPS tracking and fleet management systems');

-- Sales & Marketing
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('6200', 'Marketing & Advertising', 'OPERATING_EXPENSES', 'Sales & Marketing', 'debit', 'Advertising, promotions, website'),
('6201', 'Client Entertainment', 'OPERATING_EXPENSES', 'Sales & Marketing', 'debit', 'Client meetings, entertainment expenses');

-- 7. OTHER EXPENSES (7000–7999)
INSERT INTO accounts (code, name, category, sub_category, type, description) VALUES
('7001', 'Bank Charges', 'OTHER_EXPENSES', 'Financial', 'debit', 'Bank fees, transaction charges'),
('7002', 'Interest Expense', 'OTHER_EXPENSES', 'Financial', 'debit', 'Interest on loans and overdrafts'),
('7003', 'Fines & Penalties', 'OTHER_EXPENSES', 'Financial', 'debit', 'Traffic fines, regulatory penalties'),
('7004', 'Loss on Damaged Goods', 'OTHER_EXPENSES', 'Financial', 'debit', 'Claims paid for damaged cargo');

-- Verify insertion
SELECT category, COUNT(*) as account_count FROM accounts GROUP BY category ORDER BY category;
