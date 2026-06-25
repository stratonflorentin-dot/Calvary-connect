-- Comprehensive diagnostic and solution script for financial data system issues (Final Fixed)

-- Step 1: Check what financial tables currently exist
SELECT 
    'financial_categories' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_categories') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
UNION ALL
SELECT 
    'expenses' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
UNION ALL
SELECT 
    'revenue' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenue') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
UNION ALL
SELECT 
    'budgets' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budgets') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
UNION ALL
SELECT 
    'invoices' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
UNION ALL
SELECT 
    'financial_reports' as table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_reports') THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
ORDER BY table_name;

-- Step 2: Check if categories have been inserted (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_categories') THEN
        RAISE NOTICE 'Financial Categories Status: %', 
            (SELECT COUNT(*) || ' total categories, ' || 
                   COUNT(CASE WHEN type = 'expense' THEN 1 END) || ' expense, ' ||
                   COUNT(CASE WHEN type = 'revenue' THEN 1 END) || ' revenue'
            FROM financial_categories);
    ELSE
        RAISE NOTICE 'Financial Categories table does not exist';
    END IF;
END $$;

-- Step 3: Check for common issues using PostgreSQL catalog tables
SELECT 
    'RLS Enabled' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = 'expenses' 
            AND c.relrowsecurity = true
        ) THEN 'YES'
        ELSE 'NO'
    END as status
UNION ALL
SELECT 
    'Indexes Present' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'expenses' 
            AND indexname LIKE 'idx_%'
        ) THEN 'YES'
        ELSE 'NO'
    END as status
UNION ALL
SELECT 
    'Triggers Present' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE event_object_table = 'expenses'
        ) THEN 'YES'
        ELSE 'NO'
    END as status;

-- Step 4: Check table structures (only if tables exist) - Fixed ORDER BY issue
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        RAISE NOTICE 'Expenses table columns: %', 
            (SELECT string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position)
            FROM information_schema.columns 
            WHERE table_name = 'expenses');
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenue') THEN
        RAISE NOTICE 'Revenue table columns: %', 
            (SELECT string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position)
            FROM information_schema.columns 
            WHERE table_name = 'revenue');
    END IF;
END $$;

-- Step 5: Check for sample data
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        RAISE NOTICE 'Expenses sample data: % records', (SELECT COUNT(*) FROM expenses);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenue') THEN
        RAISE NOTICE 'Revenue sample data: % records', (SELECT COUNT(*) FROM revenue);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budgets') THEN
        RAISE NOTICE 'Budgets sample data: % records', (SELECT COUNT(*) FROM budgets);
    END IF;
END $$;

-- Step 6: Check PostgreSQL version and capabilities
SELECT 
    'PostgreSQL Version' as info_name,
    version() as info_value
UNION ALL
SELECT 
    'Current User' as info_name,
    current_user as info_value
UNION ALL
SELECT 
    'Current Database' as info_name,
    current_database() as info_value;

-- Step 7: Alternative column structure check (more reliable)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        PERFORM pg_notify('diagnostic', 'Expenses table exists with ' || 
            (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'expenses') || ' columns');
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenue') THEN
        PERFORM pg_notify('diagnostic', 'Revenue table exists with ' || 
            (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'revenue') || ' columns');
    END IF;
END $$;
