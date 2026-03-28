# Financial Data System - Complete Setup & Troubleshooting Guide

## 🔧 Common Issues & Solutions

### Issue 1: "column category_id does not exist"
**Cause**: Tables not created properly or execution order issues
**Solution**: Run the diagnostic script first, then recreate tables

### Issue 2: RLS Policy Errors
**Cause**: user_profiles table doesn't exist or role column missing
**Solution**: Create user_profiles table first or modify RLS policies

### Issue 3: Index Creation Failures
**Cause**: Columns don't exist or tables not committed
**Solution**: Use the final SQL script with proper existence checking

## 📋 Step-by-Step Setup

### Step 1: Run Diagnostic
```sql
-- Run diagnose-financial-system.sql
-- This will show what tables exist and their status
```

### Step 2: Check Core Tables
```sql
-- Verify user_profiles table exists
SELECT * FROM information_schema.tables WHERE table_name = 'user_profiles';

-- Check if role column exists
SELECT * FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND column_name = 'role';
```

### Step 3: Create Missing Core Tables (if needed)
```sql
-- Create user_profiles table if missing
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Step 4: Run Financial System
```sql
-- Run financial-data-system-final.sql
-- This has robust error handling and existence checking
```

## 🚀 Quick Fix Solutions

### Solution A: Minimal Financial System
If you're having issues with the full system, try this minimal version:

```sql
-- Create just the essential tables without complex features
CREATE TABLE IF NOT EXISTS financial_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('expense', 'revenue')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    expense_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    revenue_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Solution B: Fix RLS Issues
If RLS policies are causing problems, disable them temporarily:

```sql
-- Disable RLS temporarily
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE revenue DISABLE ROW LEVEL SECURITY;
ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE financial_categories DISABLE ROW LEVEL SECURITY;
```

### Solution C: Manual Index Creation
If automatic index creation fails, create them manually:

```sql
-- Create indexes manually after tables exist
CREATE INDEX IF NOT EXISTS idx_expenses_amount ON expenses(amount);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_revenue_amount ON revenue(amount);
CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue(revenue_date);
```

## 🔍 Debugging Steps

### 1. Check Table Creation
```sql
-- List all financial tables
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name LIKE '%financial%' OR table_name IN ('expenses', 'revenue', 'budgets', 'invoices')
ORDER BY table_name;
```

### 2. Check Column Structure
```sql
-- Check expenses table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'expenses'
ORDER BY ordinal_position;
```

### 3. Check RLS Status
```sql
-- Check RLS status on financial tables
SELECT table_name, rowsecurity 
FROM information_schema.tables 
WHERE table_name IN ('expenses', 'revenue', 'budgets', 'invoices', 'financial_categories');
```

### 4. Check Indexes
```sql
-- Check indexes on financial tables
SELECT table_name, indexname, indexdef 
FROM information_schema.indexes 
WHERE table_name IN ('expenses', 'revenue', 'budgets', 'invoices')
ORDER BY table_name, indexname;
```

## 🎯 Common Error Messages & Solutions

### "relation 'user_profiles' does not exist"
**Solution**: Create user_profiles table first or modify RLS policies

### "column 'role' does not exist"
**Solution**: Add role column to user_profiles table

### "must be owner of table user_profiles"
**Solution**: Run with proper database permissions

### "function already exists"
**Solution**: Add "OR REPLACE" to function definitions

## 📞 Getting Help

If you're still experiencing issues:

1. **Run the diagnostic script** first to identify the exact problem
2. **Check the browser console** for detailed error messages
3. **Verify database permissions** - ensure you have CREATE, ALTER, and SELECT privileges
4. **Check PostgreSQL version** - some features require specific versions

## 🚀 Production Deployment

For production use:

1. **Test in development first**
2. **Backup your database** before running scripts
3. **Run scripts in order**: Core tables → Financial system → Indexes
4. **Verify all tables exist** before enabling RLS
5. **Test with sample data** to ensure everything works

## 📋 Verification Checklist

After setup, verify:

- [ ] All financial tables exist
- [ ] Categories are populated
- [ ] RLS policies are working
- [ ] Indexes are created
- [ ] Triggers are active
- [ ] Sample data can be inserted
- [ ] Queries return expected results

## 🔧 Maintenance

Regular maintenance tasks:

1. **Monitor table sizes**
2. **Update statistics**: `ANALYZE financial_categories;`
3. **Check index usage**
4. **Backup financial data regularly**
5. **Review RLS policies** for security

---

**Need more help?** 
- Run the diagnostic script and share the output
- Check the browser console for specific error messages
- Verify your database permissions and version
