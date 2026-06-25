-- ACCOUNTING INTEGRATION: Connect Expenses & Invoices to Chart of Accounts
-- Run this in Supabase SQL Editor

-- ============================================
-- FUNCTION: Create Expense Journal Entry
-- Automatically creates journal entry when expense is recorded
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
    -- Map expense category to chart of accounts
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
        ELSE '6001' -- Default to office salaries
    END;
    
    -- Determine cash/bank account based on payment method
    v_cash_account := CASE UPPER(p_payment_method)
        WHEN 'CASH' THEN '1001'
        WHEN 'MOBILE' THEN '1003'
        WHEN 'BANK' THEN '1002'
        ELSE '1001'
    END;
    
    -- Generate entry number
    v_entry_number := generate_entry_number();
    
    -- Create journal entry
    INSERT INTO journal_entries (
        entry_number, 
        entry_date, 
        reference_type, 
        reference_id,
        description, 
        total_debit, 
        total_credit,
        source
    )
    VALUES (
        v_entry_number, 
        CURRENT_DATE, 
        'EXPENSE',
        p_expense_id,
        'Expense: ' || p_description, 
        p_amount, 
        p_amount,
        'auto'
    )
    RETURNING id INTO v_entry_id;
    
    -- Debit expense account
    INSERT INTO journal_entry_lines (
        journal_entry_id, 
        account_code, 
        debit_amount, 
        credit_amount, 
        description, 
        line_order
    )
    VALUES (
        v_entry_id, 
        v_expense_account, 
        p_amount, 
        0, 
        p_expense_number || ': ' || p_description, 
        1
    );
    
    -- Credit cash/bank account
    INSERT INTO journal_entry_lines (
        journal_entry_id, 
        account_code, 
        debit_amount, 
        credit_amount, 
        description, 
        line_order
    )
    VALUES (
        v_entry_id, 
        v_cash_account, 
        0, 
        p_amount, 
        'Payment for ' || p_expense_number, 
        2
    );
    
    -- Post the entry
    PERFORM post_journal_entry(v_entry_id);
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Create Invoice Journal Entry
-- Automatically creates journal entry when invoice is issued
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
    -- Generate entry number
    v_entry_number := generate_entry_number();
    
    -- Create journal entry
    INSERT INTO journal_entries (
        entry_number, 
        entry_date, 
        reference_type, 
        reference_id,
        description, 
        total_debit, 
        total_credit,
        source
    )
    VALUES (
        v_entry_number, 
        CURRENT_DATE, 
        'INVOICE',
        p_invoice_id,
        'Invoice ' || p_invoice_number || ' to ' || p_client_name, 
        p_total_amount, 
        p_total_amount,
        'auto'
    )
    RETURNING id INTO v_entry_id;
    
    -- Debit Accounts Receivable (full amount including VAT)
    INSERT INTO journal_entry_lines (
        journal_entry_id, 
        account_code, 
        debit_amount, 
        credit_amount, 
        description, 
        line_order
    )
    VALUES (
        v_entry_id, 
        v_ar_account, 
        p_total_amount, 
        0, 
        'Receivable from ' || p_client_name, 
        1
    );
    
    -- Credit Revenue Account (amount excl VAT)
    INSERT INTO journal_entry_lines (
        journal_entry_id, 
        account_code, 
        debit_amount, 
        credit_amount, 
        description, 
        line_order
    )
    VALUES (
        v_entry_id, 
        p_revenue_account, 
        0, 
        p_amount, 
        'Revenue - ' || p_description, 
        2
    );
    
    -- Credit VAT Payable (VAT amount) - if VAT > 0
    IF p_vat_amount > 0 THEN
        INSERT INTO journal_entry_lines (
            journal_entry_id, 
            account_code, 
            debit_amount, 
            credit_amount, 
            description, 
            line_order
        )
        VALUES (
            v_entry_id, 
            v_vat_account, 
            0, 
            p_vat_amount, 
            'VAT on invoice', 
            3
        );
    END IF;
    
    -- Post the entry
    PERFORM post_journal_entry(v_entry_id);
    
    -- Update client balances
    INSERT INTO client_balances (client_name, total_invoiced, current_balance, last_invoice_date)
    VALUES (p_client_name, p_total_amount, p_total_amount, CURRENT_DATE)
    ON CONFLICT (client_name) 
    DO UPDATE SET
        total_invoiced = client_balances.total_invoiced + p_total_amount,
        current_balance = client_balances.current_balance + p_total_amount,
        last_invoice_date = CURRENT_DATE,
        updated_at = NOW();
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Update Expense with Journal Entry
-- Call this after inserting an expense
-- ============================================
CREATE OR REPLACE FUNCTION process_expense_journal(
    p_expense_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_expense RECORD;
    v_journal_id UUID;
BEGIN
    -- Get expense details
    SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expense not found: %', p_expense_id;
    END IF;
    
    -- Create journal entry
    v_journal_id := create_expense_journal_entry(
        p_expense_id,
        v_expense.expense_number,
        v_expense.category,
        v_expense.amount,
        v_expense.description,
        COALESCE(v_expense.payment_method, 'cash')
    );
    
    -- Update expense with journal reference
    UPDATE expenses 
    SET journal_entry_id = v_journal_id
    WHERE id = p_expense_id;
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Update Invoice with Journal Entry
-- Call this after inserting an invoice
-- ============================================
CREATE OR REPLACE FUNCTION process_invoice_journal(
    p_invoice_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_invoice RECORD;
    v_journal_id UUID;
    v_revenue_account TEXT;
BEGIN
    -- Get invoice details
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
    END IF;
    
    -- Determine revenue account based on trip type or default
    SELECT revenue_account_code INTO v_revenue_account
    FROM trip_accounting 
    WHERE trip_id = v_invoice.trip_id;
    
    -- Default to Local Delivery Revenue if no trip linked
    v_revenue_account := COALESCE(v_revenue_account, '4002');
    
    -- Create journal entry
    v_journal_id := create_invoice_journal_entry(
        p_invoice_id,
        v_invoice.invoice_number,
        v_invoice.client_name,
        v_invoice.amount,
        v_invoice.vat_amount,
        v_invoice.total_amount,
        v_invoice.description,
        v_revenue_account
    );
    
    -- Update invoice with journal reference
    UPDATE invoices 
    SET journal_entry_id = v_journal_id
    WHERE id = p_invoice_id;
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-create journal entry on expense insert
-- ============================================
CREATE OR REPLACE FUNCTION expense_auto_journal()
RETURNS TRIGGER AS $$
DECLARE
    v_journal_id UUID;
BEGIN
    -- Only process if status is approved or reimbursed
    IF NEW.status IN ('approved', 'reimbursed') THEN
        v_journal_id := create_expense_journal_entry(
            NEW.id,
            NEW.expense_number,
            NEW.category,
            NEW.amount,
            NEW.description,
            COALESCE(NEW.payment_method, 'cash')
        );
        
        NEW.journal_entry_id := v_journal_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS expense_auto_journal_trigger ON expenses;

-- Create trigger (commented out by default - enable if you want auto-journal)
-- CREATE TRIGGER expense_auto_journal_trigger
--     AFTER INSERT ON expenses
--     FOR EACH ROW
--     EXECUTE FUNCTION expense_auto_journal();

-- ============================================
-- STATUS MESSAGE
-- ============================================
SELECT 'Accounting integration functions created successfully!' as status;
