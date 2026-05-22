-- Seed Chart of Accounts for Logistics Operations
-- Updated based on the new Chart of Accounts structure

-- 1. ASSETS (1000–1999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('1000', 'ASSETS', 'ASSETS', 'Total Assets', 'debit', 'Total Assets Group', NULL),
('1100', 'Current Assets', 'ASSETS', 'Current Assets', 'debit', 'Current Assets Group', '1000'),
('1101', 'Cash on Hand', 'ASSETS', 'Current Assets', 'debit', 'Cash in office', '1100'),
('1102', 'Bank Account', 'ASSETS', 'Current Assets', 'debit', 'Main bank account', '1100'),
('1103', 'Mobile Money Account', 'ASSETS', 'Current Assets', 'debit', 'M-Pesa, Tigo Pesa, Airtel Money', '1100'),
('1104', 'Accounts Receivable', 'ASSETS', 'Current Assets', 'debit', 'Client debts', '1100'),
('1105', 'Prepaid Expenses', 'ASSETS', 'Current Assets', 'debit', 'Insurance, licenses paid in advance', '1100'),
('1106', 'Fuel Inventory', 'ASSETS', 'Current Assets', 'debit', 'Stored fuel', '1100'),
('1107', 'Spare Parts Inventory', 'ASSETS', 'Current Assets', 'debit', 'Vehicle parts stock', '1100'),
('1108', 'VAT Receivable', 'ASSETS', 'Current Assets', 'debit', 'VAT to be claimed', '1100'),

('1200', 'Fixed Assets', 'ASSETS', 'Fixed Assets', 'debit', 'Fixed Assets Group', '1000'),
('1201', 'Trucks and Trailers', 'ASSETS', 'Fixed Assets', 'debit', 'Fleet vehicles', '1200'),
('1202', 'Motor Vehicles', 'ASSETS', 'Fixed Assets', 'debit', 'Staff and utility vehicles', '1200'),
('1203', 'Office Equipment', 'ASSETS', 'Fixed Assets', 'debit', 'Office furniture and machines', '1200'),
('1204', 'Computers and IT Equipment', 'ASSETS', 'Fixed Assets', 'debit', 'Laptops, servers, networking', '1200'),
('1205', 'Warehouse Equipment', 'ASSETS', 'Fixed Assets', 'debit', 'Forklifts, racks, etc.', '1200'),
('1206', 'Furniture and Fixtures', 'ASSETS', 'Fixed Assets', 'debit', 'Office and warehouse furniture', '1200'),
('1207', 'GPS Tracking Devices', 'ASSETS', 'Fixed Assets', 'debit', 'Tracking hardware', '1200'),

('1300', 'Accumulated Depreciation', 'ASSETS', 'Depreciation', 'credit', 'Depreciation Group', '1000'),
('1301', 'Accumulated Depreciation, Trucks', 'ASSETS', 'Depreciation', 'credit', 'Depreciation for Trucks', '1300'),
('1302', 'Accumulated Depreciation, Vehicles', 'ASSETS', 'Depreciation', 'credit', 'Depreciation for Vehicles', '1300'),
('1303', 'Accumulated Depreciation, Equipment', 'ASSETS', 'Depreciation', 'credit', 'Depreciation for Equipment', '1300');

-- 2. LIABILITIES (2000–2999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('2000', 'LIABILITIES', 'LIABILITIES', 'Total Liabilities', 'credit', 'Total Liabilities Group', NULL),
('2100', 'Current Liabilities', 'LIABILITIES', 'Current Liabilities', 'credit', 'Short-term obligations', '2000'),
('2101', 'Accounts Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Supplier debts', '2100'),
('2102', 'Fuel Creditors', 'LIABILITIES', 'Current Liabilities', 'credit', 'Fuel station debts', '2100'),
('2103', 'Driver Allowances Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Owed to drivers', '2100'),
('2104', 'Salaries Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Owed to staff', '2100'),
('2105', 'Tax Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Income tax obligations', '2100'),
('2106', 'VAT Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'VAT to be paid', '2100'),
('2107', 'NHIF Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Health insurance contributions', '2100'),
('2108', 'NSSF Payable', 'LIABILITIES', 'Current Liabilities', 'credit', 'Social security contributions', '2100'),

('2200', 'Long Term Liabilities', 'LIABILITIES', 'Long Term Liabilities', 'credit', 'Long-term obligations', '2000'),
('2201', 'Truck Loan', 'LIABILITIES', 'Long Term Liabilities', 'credit', 'Financing for trucks', '2200'),
('2202', 'Vehicle Financing', 'LIABILITIES', 'Long Term Liabilities', 'credit', 'Financing for other vehicles', '2200'),
('2203', 'Bank Loan', 'LIABILITIES', 'Long Term Liabilities', 'credit', 'General bank loans', '2200'),
('2204', 'Lease Obligations', 'LIABILITIES', 'Long Term Liabilities', 'credit', 'Long-term leases', '2200');

-- 3. EQUITY (3000–3999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('3000', 'EQUITY', 'EQUITY', 'Total Equity', 'credit', 'Total Equity Group', NULL),
('3101', 'Owner Capital', 'EQUITY', 'Equity', 'credit', 'Owner investment', '3000'),
('3102', 'Retained Earnings', 'EQUITY', 'Equity', 'credit', 'Past profits', '3000'),
('3103', 'Current Year Profit', 'EQUITY', 'Equity', 'credit', 'Profit for current period', '3000'),
('3104', 'Drawings', 'EQUITY', 'Equity', 'debit', 'Owner withdrawals', '3000');

-- 4. REVENUE (4000–4999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('4000', 'REVENUE', 'REVENUE', 'Total Revenue', 'credit', 'Total Revenue Group', NULL),
('4101', 'Local Transport Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Local delivery income', '4000'),
('4102', 'Cross Border Transport Revenue', 'REVENUE', 'Core Revenue', 'credit', 'International freight income', '4000'),
('4103', 'Container Transport Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Income from container hauling', '4000'),
('4104', 'Loose Cargo Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Income from non-containerized cargo', '4000'),
('4105', 'Express Delivery Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Income from urgent deliveries', '4000'),
('4106', 'Warehousing Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Storage and warehouse income', '4000'),
('4107', 'Loading and Offloading Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Handling charges', '4000'),
('4108', 'Customs Clearing Revenue', 'REVENUE', 'Core Revenue', 'credit', 'Customs documentation income', '4000'),

('4200', 'Other Income', 'REVENUE', 'Other Income', 'credit', 'Other Income Group', '4000'),
('4201', 'Fuel Surcharge Income', 'REVENUE', 'Other Income', 'credit', 'Fuel price adjustments', '4200'),
('4202', 'Commission Income', 'REVENUE', 'Other Income', 'credit', 'Brokerage or commission', '4200'),
('4203', 'Rental Income', 'REVENUE', 'Other Income', 'credit', 'Asset rental income', '4200'),
('4204', 'Other Operating Income', 'REVENUE', 'Other Income', 'credit', 'Miscellaneous operating income', '4200');

-- 5. COST OF SALES / DIRECT LOGISTICS COSTS (5000–5999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('5000', 'COST OF SALES', 'COST_OF_SALES', 'Total Direct Costs', 'debit', 'Total Direct Costs Group', NULL),
('5101', 'Fuel Expense', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Fuel costs', '5000'),
('5102', 'Driver Salaries', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Base driver pay', '5000'),
('5103', 'Driver Allowances', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Trip-based allowances', '5000'),
('5104', 'Truck Repairs', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Trip maintenance', '5000'),
('5105', 'Tire Expense', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Tire replacement', '5000'),
('5106', 'Lubricants and Oil', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Engine oil, grease', '5000'),
('5107', 'Border and Port Charges', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Entry/exit fees', '5000'),
('5108', 'Cargo Handling Expense', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Loading/unloading costs', '5000'),
('5109', 'Toll Fees', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Road tolls', '5000'),
('5110', 'Vehicle Insurance', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Trip insurance', '5000'),
('5111', 'GPS Tracking Costs', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Tracking subscription', '5000'),
('5112', 'Trip Loading Expenses', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Misc trip setup', '5000'),
('5113', 'Freight Subcontractor Expense', 'COST_OF_SALES', 'Direct Costs', 'debit', 'Payments to third-party carriers', '5000');

-- 6. OPERATING EXPENSES (6000–6999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('6000', 'OPERATING EXPENSES', 'OPERATING_EXPENSES', 'Total Operating Expenses', 'debit', 'Total Operating Expenses Group', NULL),
('6101', 'Office Rent', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Office rent', '6000'),
('6102', 'Electricity and Water', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Utilities', '6000'),
('6103', 'Internet Expense', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Data costs', '6000'),
('6104', 'Telephone Expense', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Airtime and lines', '6000'),
('6105', 'Office Supplies', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Stationery, etc.', '6000'),
('6106', 'Cleaning Expense', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Office cleaning', '6000'),
('6107', 'Security Expense', 'OPERATING_EXPENSES', 'Facilities', 'debit', 'Security guards/systems', '6000'),

('6201', 'Office Salaries', 'OPERATING_EXPENSES', 'Personnel', 'debit', 'Admin staff pay', '6000'),
('6202', 'Staff Welfare', 'OPERATING_EXPENSES', 'Personnel', 'debit', 'Tea, lunch, etc.', '6000'),
('6203', 'Staff Training', 'OPERATING_EXPENSES', 'Personnel', 'debit', 'Capacity building', '6000'),
('6204', 'Recruitment Expense', 'OPERATING_EXPENSES', 'Personnel', 'debit', 'Hiring costs', '6000'),

('6301', 'Advertising Expense', 'OPERATING_EXPENSES', 'Marketing', 'debit', 'Promotions', '6000'),
('6302', 'Branding Expense', 'OPERATING_EXPENSES', 'Marketing', 'debit', 'Logo, signs, etc.', '6000'),
('6303', 'Website Expense', 'OPERATING_EXPENSES', 'Marketing', 'debit', 'Hosting and design', '6000'),
('6304', 'Social Media Marketing', 'OPERATING_EXPENSES', 'Marketing', 'debit', 'Ads on platforms', '6000'),

('6401', 'Legal Fees', 'OPERATING_EXPENSES', 'Professional', 'debit', 'Legal services', '6000'),
('6402', 'Audit Fees', 'OPERATING_EXPENSES', 'Professional', 'debit', 'Financial audits', '6000'),
('6403', 'Consultancy Fees', 'OPERATING_EXPENSES', 'Professional', 'debit', 'Expert advice', '6000'),

('6501', 'Bank Charges', 'OPERATING_EXPENSES', 'Financial', 'debit', 'Bank transaction fees', '6000'),
('6502', 'Loan Interest', 'OPERATING_EXPENSES', 'Financial', 'debit', 'Interest on loans', '6000'),
('6503', 'Foreign Exchange Loss', 'OPERATING_EXPENSES', 'Financial', 'debit', 'Currency fluctuations', '6000');

-- 7. TAXES AND COMPLIANCE (7000–7999)
INSERT INTO accounts (code, name, category, sub_category, type, description, parent_code) VALUES
('7000', 'TAXES AND COMPLIANCE', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'Total Taxes Group', NULL),
('7101', 'Corporate Tax Expense', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'Income tax', '7000'),
('7102', 'Withholding Tax', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'WHT obligations', '7000'),
('7103', 'Business License Fees', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'Annual licenses', '7000'),
('7104', 'Road License Fees', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'Vehicle licenses', '7000'),
('7105', 'Regulatory Compliance Fees', 'OTHER_EXPENSES', 'Taxes & Compliance', 'debit', 'LATRA, etc.', '7000');

-- Verify insertion
SELECT category, COUNT(*) as account_count FROM accounts GROUP BY category ORDER BY category;
