-- ADVANCE PAYMENTS & CUSTOMER DEPOSITS SETUP
-- Run this in Supabase SQL Editor

-- ============================================
-- ADD CUSTOMER DEPOSITS ACCOUNT (if not exists)
-- ============================================
INSERT INTO accounts (code, name, category, sub_category, type, description)
VALUES ('2007', 'Customer Deposits', 'LIABILITIES', 'Current Liabilities', 'credit', 'Advance payments received from clients for services not yet rendered')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- FUNCTION: Record Advance Payment
-- When client pays money in advance (before invoice)
-- ============================================
CREATE OR REPLACE FUNCTION record_advance_payment(
    p_client_name TEXT,
    p_amount DECIMAL,
    p_payment_method TEXT DEFAULT 'BANK',
    p_description TEXT DEFAULT 'Advance payment'
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_cash_account TEXT;
BEGIN
    -- Determine cash/bank account
    v_cash_account := CASE UPPER(p_payment_method)
        WHEN 'CASH' THEN '1001'
        WHEN 'MOBILE' THEN '1003'
        ELSE '1002'
    END;
    
    -- Generate entry number
    v_entry_number := generate_entry_number();
    
    -- Create journal entry
    INSERT INTO journal_entries (
        entry_number, 
        entry_date, 
        reference_type, 
        description, 
        total_debit, 
        total_credit,
        source
    )
    VALUES (
        v_entry_number, 
        CURRENT_DATE, 
        'ADVANCE_PAYMENT',
        'Advance payment from ' || p_client_name || ': ' || p_description, 
        p_amount, 
        p_amount,
        'auto'
    )
    RETURNING id INTO v_entry_id;
    
    -- Debit Cash/Bank (Asset increases)
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
        p_amount, 
        0, 
        'Advance received from ' || p_client_name, 
        1
    );
    
    -- Credit Customer Deposits (Liability increases)
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
        '2007', 
        0, 
        p_amount, 
        'Deposit from ' || p_client_name || ' for future services', 
        2
    );
    
    -- Post the entry
    PERFORM post_journal_entry(v_entry_id);
    
    -- Update client balances
    INSERT INTO client_balances (client_name, total_paid, current_balance, last_payment_date)
    VALUES (p_client_name, p_amount, -p_amount, CURRENT_DATE)  -- Negative balance = they paid in advance
    ON CONFLICT (client_name) 
    DO UPDATE SET
        total_paid = client_balances.total_paid + p_amount,
        current_balance = client_balances.current_balance - p_amount,  -- Reduce what they owe (can go negative)
        last_payment_date = CURRENT_DATE,
        updated_at = NOW();
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Apply Advance to Invoice
-- When creating invoice, apply existing advance payment
-- ============================================
CREATE OR REPLACE FUNCTION apply_advance_to_invoice(
    p_invoice_id UUID,
    p_client_name TEXT,
    p_invoice_amount DECIMAL,
    p_advance_amount DECIMAL  -- Amount to apply from advance
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_actual_apply DECIMAL;
BEGIN
    -- Can't apply more than invoice amount
    v_actual_apply := LEAST(p_advance_amount, p_invoice_amount);
    
    -- Generate entry number
    v_entry_number := generate_entry_number();
    
    -- Create journal entry for advance application
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
        'ADVANCE_APPLICATION',
        p_invoice_id,
        'Apply advance payment to invoice for ' || p_client_name, 
        v_actual_apply, 
        v_actual_apply,
        'auto'
    )
    RETURNING id INTO v_entry_id;
    
    -- Debit Customer Deposits (Liability decreases - we earned it)
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
        '2007', 
        v_actual_apply, 
        0, 
        'Apply deposit from ' || p_client_name, 
        1
    );
    
    -- Credit Accounts Receivable (Asset decreases - they don't owe as much)
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
        '1100', 
        0, 
        v_actual_apply, 
        'Reduce AR for ' || p_client_name, 
        2
    );
    
    -- Post the entry
    PERFORM post_journal_entry(v_entry_id);
    
    -- Update client balances
    UPDATE client_balances 
    SET current_balance = current_balance + v_actual_apply,  -- Increase balance (less negative or positive)
        updated_at = NOW()
    WHERE client_name = p_client_name;
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Get Client Available Advance
-- Check how much advance payment a client has
-- ============================================
CREATE OR REPLACE FUNCTION get_client_advance_balance(p_client_name TEXT)
RETURNS DECIMAL AS $$
DECLARE
    v_balance DECIMAL;
    v_advance DECIMAL;
BEGIN
    -- Get current balance from client_balances
    SELECT current_balance INTO v_balance
    FROM client_balances
    WHERE client_name = p_client_name;
    
    -- If negative balance, they have advance payment
    IF v_balance IS NOT NULL AND v_balance < 0 THEN
        v_advance := ABS(v_balance);  -- Return positive amount of advance
    ELSE
        v_advance := 0;
    END IF;
    
    RETURN v_advance;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ENHANCED INVOICE FUNCTION with Advance Handling
-- ============================================
CREATE OR REPLACE FUNCTION create_invoice_with_advance(
    p_invoice_id UUID,
    p_invoice_number TEXT,
    p_client_name TEXT,
    p_amount DECIMAL,
    p_vat_amount DECIMAL,
    p_total_amount DECIMAL,
    p_description TEXT,
    p_apply_advance BOOLEAN DEFAULT false,  -- Whether to auto-apply advance
    p_revenue_account TEXT DEFAULT '4002'
)
RETURNS TABLE (invoice_journal_id UUID, advance_journal_id UUID) AS $$
DECLARE
    v_invoice_journal_id UUID;
    v_advance_journal_id UUID;
    v_available_advance DECIMAL;
    v_apply_amount DECIMAL;
BEGIN
    -- Step 1: Create standard invoice journal entry
    v_invoice_journal_id := create_invoice_journal_entry(
        p_invoice_id,
        p_invoice_number,
        p_client_name,
        p_amount,
        p_vat_amount,
        p_total_amount,
        p_description,
        p_revenue_account
    );
    
    -- Step 2: Check if client has advance payment
    v_available_advance := get_client_advance_balance(p_client_name);
    
    -- Step 3: Apply advance if requested and available
    IF p_apply_advance AND v_available_advance > 0 THEN
        -- Apply up to the invoice amount or available advance
        v_apply_amount := LEAST(v_available_advance, p_total_amount);
        
        v_advance_journal_id := apply_advance_to_invoice(
            p_invoice_id,
            p_client_name,
            p_total_amount,
            v_apply_amount
        );
    END IF;
    
    RETURN QUERY SELECT v_invoice_journal_id, v_advance_journal_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Client Advance Balances
-- Shows which clients have advance payments
-- ============================================
CREATE OR REPLACE VIEW client_advance_balances AS
SELECT 
    cb.client_name,
    cb.total_invoiced,
    cb.total_paid,
    cb.current_balance,
    CASE 
        WHEN cb.current_balance < 0 THEN ABS(cb.current_balance)
        ELSE 0 
    END as advance_available,
    CASE 
        WHEN cb.current_balance > 0 THEN cb.current_balance
        ELSE 0 
    END as amount_owed,
    cb.last_payment_date,
    cb.last_invoice_date
FROM client_balances cb
ORDER BY advance_available DESC;

-- ============================================
-- STATUS
-- ============================================
SELECT 'Advance payment system configured successfully!' as status;
SELECT 'New account created: 2007 - Customer Deposits' as info;
SELECT 'Functions created: record_advance_payment, apply_advance_to_invoice, get_client_advance_balance' as info;
SELECT 'View created: client_advance_balances' as info;
