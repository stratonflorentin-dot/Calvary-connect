-- MINIMAL VERSION - Just the core journal entry functions
-- Run this in Supabase SQL Editor

-- ============================================
-- FUNCTION: Create Expense Journal Entry
-- ============================================
CREATE OR REPLACE FUNCTION create_expense_journal_entry(
    p_expense_id UUID,
    p_expense_number TEXT,
    p_category TEXT,
    p_amount DECIMAL,
    p_description TEXT,
    p_payment_method TEXT DEFAULT 'cash'
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_expense_account TEXT;
    v_cash_account TEXT;
BEGIN
    v_expense_account := CASE UPPER(p_category)
        WHEN 'FUEL' THEN '5001'
        WHEN 'DRIVER' THEN '5002'
        WHEN 'TURNBOY' THEN '5003'
        WHEN 'TOLLS' THEN '5004'
        WHEN 'MAINTENANCE' THEN '6100'
        WHEN 'INSURANCE' THEN '6101'
        WHEN 'LICENSE' THEN '6102'
        WHEN 'TRACKING' THEN '6103'
        WHEN 'MARKETING' THEN '6200'
        WHEN 'ENTERTAINMENT' THEN '6201'
        WHEN 'RENT' THEN '6002'
        WHEN 'UTILITIES' THEN '6003'
        WHEN 'INTERNET' THEN '6004'
        WHEN 'SALARIES' THEN '6001'
        WHEN 'BANK_CHARGES' THEN '7001'
        WHEN 'INTEREST' THEN '7002'
        WHEN 'FINES' THEN '7003'
        ELSE '6001'
    END;
    
    v_cash_account := CASE UPPER(p_payment_method)
        WHEN 'CASH' THEN '1001'
        WHEN 'MOBILE' THEN '1003'
        WHEN 'BANK' THEN '1002'
        ELSE '1001'
    END;
    
    v_entry_number := generate_entry_number();
    
    INSERT INTO journal_entries (
        entry_number, entry_date, reference_type, reference_id,
        description, total_debit, total_credit, source
    )
    VALUES (
        v_entry_number, CURRENT_DATE, 'EXPENSE', p_expense_id,
        'Expense: ' || p_description, p_amount, p_amount, 'auto'
    )
    RETURNING id INTO v_entry_id;
    
    INSERT INTO journal_entry_lines (
        journal_entry_id, account_code, debit_amount, credit_amount, description, line_order
    )
    VALUES (v_entry_id, v_expense_account, p_amount, 0, p_expense_number || ': ' || p_description, 1);
    
    INSERT INTO journal_entry_lines (
        journal_entry_id, account_code, debit_amount, credit_amount, description, line_order
    )
    VALUES (v_entry_id, v_cash_account, 0, p_amount, 'Payment for ' || p_expense_number, 2);
    
    PERFORM post_journal_entry(v_entry_id);
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Create Invoice Journal Entry
-- ============================================
CREATE OR REPLACE FUNCTION create_invoice_journal_entry(
    p_invoice_id UUID,
    p_invoice_number TEXT,
    p_client_name TEXT,
    p_amount DECIMAL,
    p_vat_amount DECIMAL,
    p_total_amount DECIMAL,
    p_description TEXT,
    p_revenue_account TEXT DEFAULT '4002'
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_ar_account TEXT := '1100';
    v_vat_account TEXT := '2005';
BEGIN
    v_entry_number := generate_entry_number();
    
    INSERT INTO journal_entries (
        entry_number, entry_date, reference_type, reference_id,
        description, total_debit, total_credit, source
    )
    VALUES (
        v_entry_number, CURRENT_DATE, 'INVOICE', p_invoice_id,
        'Invoice ' || p_invoice_number || ' to ' || p_client_name, p_total_amount, p_total_amount, 'auto'
    )
    RETURNING id INTO v_entry_id;
    
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, v_ar_account, p_total_amount, 0, 'Receivable from ' || p_client_name, 1);
    
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
    VALUES (v_entry_id, p_revenue_account, 0, p_amount, 'Revenue - ' || p_description, 2);
    
    IF p_vat_amount > 0 THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, line_order)
        VALUES (v_entry_id, v_vat_account, 0, p_vat_amount, 'VAT on invoice', 3);
    END IF;
    
    PERFORM post_journal_entry(v_entry_id);
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STATUS
-- ============================================
SELECT 'Core accounting functions created successfully!' as status;
