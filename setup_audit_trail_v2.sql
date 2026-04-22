-- ==========================================
-- AUDIT TRAIL SETUP SQL (V2 - CHECKS TABLE EXISTENCE)
-- Run this in Supabase SQL Editor
-- ==========================================

-- 1. DROP EXISTING AUDIT TABLE IF EXISTS
DROP TABLE IF EXISTS audit_logs CASCADE;

-- 2. CREATE AUDIT LOGS TABLE
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- 3. CREATE INDEXES
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_performed_at ON audit_logs(performed_at);
CREATE INDEX idx_audit_logs_performed_by ON audit_logs(performed_by);

-- 4. ADD AUDIT COLUMNS TO EXISTING TABLES ONLY

-- Expenses (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'created_by') THEN
            ALTER TABLE expenses ADD COLUMN created_by UUID REFERENCES auth.users(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'updated_by') THEN
            ALTER TABLE expenses ADD COLUMN updated_by UUID REFERENCES auth.users(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'deleted_at') THEN
            ALTER TABLE expenses ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        END IF;
    END IF;
END $$;

-- Invoices (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'created_by') THEN
            ALTER TABLE invoices ADD COLUMN created_by UUID REFERENCES auth.users(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'updated_by') THEN
            ALTER TABLE invoices ADD COLUMN updated_by UUID REFERENCES auth.users(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'deleted_at') THEN
            ALTER TABLE invoices ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        END IF;
    END IF;
END $$;

-- Journal Entries (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'created_by') THEN
            ALTER TABLE journal_entries ADD COLUMN created_by UUID REFERENCES auth.users(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'updated_by') THEN
            ALTER TABLE journal_entries ADD COLUMN updated_by UUID REFERENCES auth.users(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'deleted_at') THEN
            ALTER TABLE journal_entries ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        END IF;
    END IF;
END $$;

-- Journal Entry Lines (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entry_lines') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entry_lines' AND column_name = 'created_by') THEN
            ALTER TABLE journal_entry_lines ADD COLUMN created_by UUID REFERENCES auth.users(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entry_lines' AND column_name = 'deleted_at') THEN
            ALTER TABLE journal_entry_lines ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        END IF;
    END IF;
END $$;

-- 5. CREATE AUDIT LOGGING FUNCTION
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, performed_by, performed_at)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD), auth.uid(), NOW());
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, performed_by, performed_at)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid(), NOW());
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_values, performed_by, performed_at)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), auth.uid(), NOW());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CREATE TRIGGERS ONLY FOR EXISTING TABLES
DO $$
BEGIN
    -- Expenses trigger
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        DROP TRIGGER IF EXISTS expenses_audit ON expenses;
        CREATE TRIGGER expenses_audit
            AFTER INSERT OR UPDATE OR DELETE ON expenses
            FOR EACH ROW EXECUTE FUNCTION log_audit();
    END IF;
    
    -- Invoices trigger
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        DROP TRIGGER IF EXISTS invoices_audit ON invoices;
        CREATE TRIGGER invoices_audit
            AFTER INSERT OR UPDATE OR DELETE ON invoices
            FOR EACH ROW EXECUTE FUNCTION log_audit();
    END IF;
    
    -- Journal Entries trigger
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
        DROP TRIGGER IF EXISTS journal_entries_audit ON journal_entries;
        CREATE TRIGGER journal_entries_audit
            AFTER INSERT OR UPDATE OR DELETE ON journal_entries
            FOR EACH ROW EXECUTE FUNCTION log_audit();
    END IF;
END $$;

-- 7. FIX RLS POLICIES FOR EXISTING TABLES
DO $$
BEGIN
    -- Expenses RLS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON expenses;
        CREATE POLICY "Allow all operations for authenticated users" ON expenses
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    
    -- Invoices RLS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON invoices;
        CREATE POLICY "Allow all operations for authenticated users" ON invoices
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    
    -- Journal Entries RLS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
        ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON journal_entries;
        CREATE POLICY "Allow all operations for authenticated users" ON journal_entries
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    
    -- Journal Entry Lines RLS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entry_lines') THEN
        ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON journal_entry_lines;
        CREATE POLICY "Allow all operations for authenticated users" ON journal_entry_lines
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Audit logs RLS (this table exists, we just created it)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON audit_logs;
CREATE POLICY "Allow read for authenticated users" ON audit_logs
    FOR SELECT TO authenticated USING (true);

-- 8. SOFT DELETE FUNCTION
CREATE OR REPLACE FUNCTION soft_delete(table_name TEXT, record_id UUID)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('UPDATE %I SET deleted_at = NOW(), updated_by = auth.uid() WHERE id = %L', table_name, record_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. REPORTING VIEWS (ONLY IF TABLES EXIST)
DO $$
BEGIN
    -- Only create views if both expenses and invoices exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        
        DROP VIEW IF EXISTS monthly_financial_summary;
        EXECUTE 'CREATE OR REPLACE VIEW monthly_financial_summary AS
        SELECT 
            DATE_TRUNC(''month'', COALESCE(e.date, i.issue_date)) as month,
            EXTRACT(YEAR FROM COALESCE(e.date, i.issue_date)) as year,
            EXTRACT(MONTH FROM COALESCE(e.date, i.issue_date)) as month_num,
            COALESCE(SUM(e.amount) FILTER (WHERE e.currency = ''TZS'' AND e.deleted_at IS NULL), 0) as total_expenses_tzs,
            COALESCE(SUM(e.amount) FILTER (WHERE e.currency = ''USD'' AND e.deleted_at IS NULL), 0) as total_expenses_usd,
            COALESCE(SUM(i.total_amount) FILTER (WHERE i.currency = ''TZS'' AND i.status = ''paid'' AND i.deleted_at IS NULL), 0) as total_revenue_tzs,
            COALESCE(SUM(i.total_amount) FILTER (WHERE i.currency = ''USD'' AND i.status = ''paid'' AND i.deleted_at IS NULL), 0) as total_revenue_usd,
            COALESCE(SUM(i.total_amount) FILTER (WHERE i.currency = ''TZS'' AND i.status != ''paid'' AND i.deleted_at IS NULL), 0) as outstanding_receivables_tzs,
            COALESCE(SUM(i.total_amount) FILTER (WHERE i.currency = ''USD'' AND i.status != ''paid'' AND i.deleted_at IS NULL), 0) as outstanding_receivables_usd
        FROM (
            SELECT date, amount, currency, deleted_at FROM expenses WHERE deleted_at IS NULL
            UNION ALL
            SELECT NULL, NULL, NULL, NULL
        ) e
        FULL OUTER JOIN (
            SELECT issue_date, total_amount, currency, status, deleted_at FROM invoices WHERE deleted_at IS NULL
            UNION ALL
            SELECT NULL, NULL, NULL, NULL, NULL
        ) i ON DATE_TRUNC(''month'', e.date) = DATE_TRUNC(''month'', i.issue_date)
        GROUP BY DATE_TRUNC(''month'', COALESCE(e.date, i.issue_date)),
                 EXTRACT(YEAR FROM COALESCE(e.date, i.issue_date)),
                 EXTRACT(MONTH FROM COALESCE(e.date, i.issue_date))
        ORDER BY month DESC';
        
        DROP VIEW IF EXISTS expense_by_category;
        EXECUTE 'CREATE OR REPLACE VIEW expense_by_category AS
        SELECT 
            category,
            currency,
            DATE_TRUNC(''month'', date) as month,
            SUM(amount) as total_amount,
            COUNT(*) as transaction_count
        FROM expenses
        WHERE deleted_at IS NULL
        GROUP BY category, currency, DATE_TRUNC(''month'', date)
        ORDER BY month DESC, total_amount DESC';
        
        DROP VIEW IF EXISTS revenue_by_customer;
        EXECUTE 'CREATE OR REPLACE VIEW revenue_by_customer AS
        SELECT 
            client_name as customer,
            currency,
            DATE_TRUNC(''month'', issue_date) as month,
            SUM(total_amount) as total_revenue,
            COUNT(*) as invoice_count,
            SUM(CASE WHEN status = ''paid'' THEN total_amount ELSE 0 END) as paid_amount,
            SUM(CASE WHEN status != ''paid'' THEN total_amount ELSE 0 END) as outstanding_amount
        FROM invoices
        WHERE deleted_at IS NULL
        GROUP BY client_name, currency, DATE_TRUNC(''month'', issue_date)
        ORDER BY month DESC, total_revenue DESC';
    END IF;
END $$;

SELECT 'Audit trail setup complete' as status;
