-- Accounting Functions and Triggers for Logistics COA
-- These functions automate accounting entries for common operations

-- Function to generate journal entry number
CREATE OR REPLACE FUNCTION generate_entry_number()
RETURNS TEXT AS $$
DECLARE
    year TEXT;
    sequence_num INTEGER;
    entry_number TEXT;
BEGIN
    year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    -- Get next sequence number for the year
    SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM '\d+$') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM journal_entries
    WHERE entry_number LIKE 'JE-' || year || '-%';
    
    entry_number := 'JE-' || year || '-' || LPAD(sequence_num::TEXT, 6, '0');
    RETURN entry_number;
END;
$$ LANGUAGE plpgsql;

-- Function to post a journal entry (update account balances)
CREATE OR REPLACE FUNCTION post_journal_entry(entry_id UUID)
RETURNS VOID AS $$
DECLARE
    line RECORD;
BEGIN
    -- Update each account balance based on journal lines
    FOR line IN 
        SELECT account_code, debit_amount, credit_amount 
        FROM journal_entry_lines 
        WHERE journal_entry_id = entry_id
    LOOP
        UPDATE accounts
        SET current_balance = current_balance + line.debit_amount - line.credit_amount,
            updated_at = NOW()
        WHERE code = line.account_code;
    END LOOP;
    
    -- Mark entry as posted
    UPDATE journal_entries
    SET is_posted = true,
        posted_at = NOW()
    WHERE id = entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create journal entry for trip revenue
CREATE OR REPLACE FUNCTION create_trip_revenue_entry(
    p_trip_id UUID,
    p_revenue_amount DECIMAL,
    p_client_name TEXT,
    p_revenue_account TEXT DEFAULT '4002',
    p_ar_account TEXT DEFAULT '1100'
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
BEGIN
    -- Generate entry number
    v_entry_number := generate_entry_number();
    
    -- Create journal entry header
    INSERT INTO journal_entries (entry_number, entry_date, reference_type, reference_id, description, total_debit, total_credit)
    VALUES (
        v_entry_number,
        CURRENT_DATE,
        'TRIP',
        p_trip_id,
        'Revenue from trip for ' || p_client_name,
        p_revenue_amount,
        p_revenue_amount
    )
    RETURNING id INTO v_entry_id;
    
    -- Debit Accounts Receivable
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, p_ar_account, p_revenue_amount, 0, 'Receivable from ' || p_client_name, 1);
    
    -- Credit Revenue Account
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, p_revenue_account, 0, p_revenue_amount, 'Trip revenue', 2);
    
    -- Post the entry
    PERFORM post_journal_entry(v_entry_id);
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create journal entry for trip expenses
CREATE OR REPLACE FUNCTION create_trip_expense_entry(
    p_trip_id UUID,
    p_fuel_cost DECIMAL,
    p_driver_wages DECIMAL,
    p_tolls DECIMAL,
    p_maintenance DECIMAL
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_total DECIMAL;
BEGIN
    v_total := COALESCE(p_fuel_cost, 0) + COALESCE(p_driver_wages, 0) + COALESCE(p_tolls, 0) + COALESCE(p_maintenance, 0);
    
    IF v_total = 0 THEN
        RETURN NULL;
    END IF;
    
    -- Generate entry number
    v_entry_number := generate_entry_number();
    
    -- Create journal entry header
    INSERT INTO journal_entries (entry_number, entry_date, reference_type, reference_id, description, total_debit, total_credit)
    VALUES (
        v_entry_number,
        CURRENT_DATE,
        'TRIP',
        p_trip_id,
        'Direct costs for trip',
        v_total,
        v_total
    )
    RETURNING id INTO v_entry_id;
    
    -- Debit various expense accounts
    IF p_fuel_cost > 0 THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
        VALUES (v_entry_id, '5001', p_fuel_cost, 0, 'Fuel expense', 1);
    END IF;
    
    IF p_driver_wages > 0 THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
        VALUES (v_entry_id, '5002', p_driver_wages, 0, 'Driver wages', 2);
    END IF;
    
    IF p_tolls > 0 THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
        VALUES (v_entry_id, '5004', p_tolls, 0, 'Tolls and road charges', 3);
    END IF;
    
    IF p_maintenance > 0 THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
        VALUES (v_entry_id, '5005', p_maintenance, 0, 'Trip-related maintenance', 4);
    END IF;
    
    -- Credit Cash or Payable (assuming paid from petty cash for now)
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '1001', 0, v_total, 'Payment of trip expenses', 99);
    
    -- Post the entry
    PERFORM post_journal_entry(v_entry_id);
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record client payment
CREATE OR REPLACE FUNCTION record_client_payment(
    p_client_name TEXT,
    p_amount DECIMAL,
    p_payment_method TEXT DEFAULT 'BANK'
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_cash_account TEXT;
BEGIN
    -- Determine cash account based on payment method
    v_cash_account := CASE p_payment_method
        WHEN 'CASH' THEN '1001'
        WHEN 'MOBILE' THEN '1003'
        ELSE '1002'
    END;
    
    -- Generate entry number
    v_entry_number := generate_entry_number();
    
    -- Create journal entry header
    INSERT INTO journal_entries (entry_number, entry_date, reference_type, description, total_debit, total_credit)
    VALUES (
        v_entry_number,
        CURRENT_DATE,
        'PAYMENT',
        'Payment received from ' || p_client_name,
        p_amount,
        p_amount
    )
    RETURNING id INTO v_entry_id;
    
    -- Debit Cash/Bank
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, v_cash_account, p_amount, 0, 'Payment received', 1);
    
    -- Credit Accounts Receivable
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, '1100', 0, p_amount, 'From ' || p_client_name, 2);
    
    -- Post the entry
    PERFORM post_journal_entry(v_entry_id);
    
    -- Update client balance
    UPDATE client_balances
    SET total_paid = total_paid + p_amount,
        current_balance = current_balance - p_amount,
        last_payment_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE client_name = p_client_name;
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record vehicle expense
CREATE OR REPLACE FUNCTION record_vehicle_expense(
    p_vehicle_id UUID,
    p_expense_type TEXT,
    p_amount DECIMAL,
    p_vendor_name TEXT,
    p_description TEXT,
    p_trip_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_expense_id UUID;
    v_entry_number TEXT;
    v_account_code TEXT;
BEGIN
    -- Map expense type to account code
    v_account_code := CASE p_expense_type
        WHEN 'FUEL' THEN '5001'
        WHEN 'MAINTENANCE' THEN '6100'
        WHEN 'INSURANCE' THEN '6101'
        WHEN 'LICENSE' THEN '6102'
        WHEN 'REPAIR' THEN '6100'
        WHEN 'TIRES' THEN '6100'
        WHEN 'TOLLS' THEN '5004'
        ELSE '6100'
    END;
    
    -- Generate entry number
    v_entry_number := generate_entry_number();
    
    -- Create journal entry header
    INSERT INTO journal_entries (entry_number, entry_date, reference_type, description, total_debit, total_credit)
    VALUES (
        v_entry_number,
        CURRENT_DATE,
        'EXPENSE',
        p_expense_type || ' expense for vehicle',
        p_amount,
        p_amount
    )
    RETURNING id INTO v_entry_id;
    
    -- Debit Expense Account
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, v_account_code, p_amount, 0, p_description, 1);
    
    -- Credit Accounts Payable or Cash
    IF p_vendor_name IS NOT NULL THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
        VALUES (v_entry_id, '2001', 0, p_amount, 'Owed to ' || p_vendor_name, 2);
    ELSE
        INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
        VALUES (v_entry_id, '1001', 0, p_amount, 'Paid from petty cash', 2);
    END IF;
    
    -- Post the entry
    PERFORM post_journal_entry(v_entry_id);
    
    -- Create vehicle expense record
    INSERT INTO vehicle_expenses (
        vehicle_id, expense_type, expense_date, amount, account_code, 
        description, trip_id, journal_entry_id, created_at
    )
    VALUES (
        p_vehicle_id, p_expense_type, CURRENT_DATE, p_amount, v_account_code,
        p_description, p_trip_id, v_entry_id, NOW()
    )
    RETURNING id INTO v_expense_id;
    
    RETURN v_expense_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update route profitability
CREATE OR REPLACE FUNCTION update_route_profitability(
    p_origin TEXT,
    p_destination TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO route_profitability (
        origin, destination, route_code, total_trips, total_revenue,
        total_fuel_cost, total_driver_costs, total_tolls, total_maintenance, total_profit
    )
    SELECT 
        t.origin,
        t.destination,
        UPPER(LEFT(t.origin, 3) || '-' || LEFT(t.destination, 3)),
        COUNT(*),
        COALESCE(SUM(ta.revenue_amount), 0),
        COALESCE(SUM(ta.fuel_cost), 0),
        COALESCE(SUM(ta.driver_wages), 0),
        COALESCE(SUM(ta.tolls), 0),
        COALESCE(SUM(ta.maintenance_cost), 0),
        COALESCE(SUM(ta.profit_amount), 0)
    FROM trips t
    LEFT JOIN trip_accounting ta ON ta.trip_id = t.id
    WHERE t.origin = p_origin AND t.destination = p_destination
    GROUP BY t.origin, t.destination
    ON CONFLICT (route_code) DO UPDATE SET
        total_trips = EXCLUDED.total_trips,
        total_revenue = EXCLUDED.total_revenue,
        total_fuel_cost = EXCLUDED.total_fuel_cost,
        total_driver_costs = EXCLUDED.total_driver_costs,
        total_tolls = EXCLUDED.total_tolls,
        total_maintenance = EXCLUDED.total_maintenance,
        total_profit = EXCLUDED.total_profit,
        avg_profit_per_trip = EXCLUDED.total_profit / NULLIF(EXCLUDED.total_trips, 0),
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- View: Trial Balance
CREATE OR REPLACE VIEW trial_balance AS
SELECT 
    a.code,
    a.name,
    a.category,
    a.type,
    CASE 
        WHEN a.type = 'debit' THEN a.current_balance
        ELSE 0 
    END as debit_balance,
    CASE 
        WHEN a.type = 'credit' THEN -a.current_balance
        ELSE 0 
    END as credit_balance
FROM accounts a
WHERE a.is_active = true
ORDER BY a.code;

-- View: Profit & Loss Summary
CREATE OR REPLACE VIEW profit_loss_summary AS
SELECT 
    'REVENUE' as section,
    SUM(CASE WHEN type = 'credit' THEN current_balance ELSE -current_balance END) as amount
FROM accounts WHERE category = 'REVENUE'
UNION ALL
SELECT 
    'COST_OF_SALES',
    SUM(CASE WHEN type = 'debit' THEN current_balance ELSE -current_balance END)
FROM accounts WHERE category = 'COST_OF_SALES'
UNION ALL
SELECT 
    'GROSS_PROFIT',
    (SELECT SUM(CASE WHEN type = 'credit' THEN current_balance ELSE -current_balance END) FROM accounts WHERE category = 'REVENUE')
    - (SELECT SUM(CASE WHEN type = 'debit' THEN current_balance ELSE -current_balance END) FROM accounts WHERE category = 'COST_OF_SALES')
UNION ALL
SELECT 
    'OPERATING_EXPENSES',
    SUM(CASE WHEN type = 'debit' THEN current_balance ELSE -current_balance END)
FROM accounts WHERE category = 'OPERATING_EXPENSES'
UNION ALL
SELECT 
    'NET_PROFIT',
    (SELECT SUM(CASE WHEN type = 'credit' THEN current_balance ELSE -current_balance END) FROM accounts WHERE category = 'REVENUE')
    - (SELECT SUM(CASE WHEN type = 'debit' THEN current_balance ELSE -current_balance END) FROM accounts WHERE category = 'COST_OF_SALES')
    - (SELECT SUM(CASE WHEN type = 'debit' THEN current_balance ELSE -current_balance END) FROM accounts WHERE category = 'OPERATING_EXPENSES');
