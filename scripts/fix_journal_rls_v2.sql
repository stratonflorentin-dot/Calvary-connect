-- fix_journal_rls_v2.sql
-- Run this in Supabase SQL Editor to fix journal entry RLS policies
-- This enables authenticated users to create and manage journal entries

-- ============================================
-- STEP 1: Drop existing problematic policies
-- ============================================

DROP POLICY IF EXISTS "journal_entries_policy" ON journal_entries;
DROP POLICY IF EXISTS "journal_entry_lines_policy" ON journal_entry_lines;
DROP POLICY IF EXISTS "Users can view journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can update journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can view journal entry lines" ON journal_entry_lines;
DROP POLICY IF EXISTS "Users can insert journal entry lines" ON journal_entry_lines;
DROP POLICY IF EXISTS "Users can update journal entry lines" ON journal_entry_lines;
DROP POLICY IF EXISTS "Users can delete journal entry lines" ON journal_entry_lines;
DROP POLICY IF EXISTS "authenticated_journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "authenticated_journal_entry_lines" ON journal_entry_lines;

-- ============================================
-- STEP 2: Ensure RLS is enabled
-- ============================================

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Create new permissive policies
-- ============================================

-- Journal Entries - Allow all authenticated users
CREATE POLICY "authenticated_users_journal_entries_select" ON journal_entries
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_users_journal_entries_insert" ON journal_entries
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_users_journal_entries_update" ON journal_entries
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_users_journal_entries_delete" ON journal_entries
  FOR DELETE TO authenticated
  USING (true);

-- Journal Entry Lines - Allow all authenticated users
CREATE POLICY "authenticated_users_journal_entry_lines_select" ON journal_entry_lines
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_users_journal_entry_lines_insert" ON journal_entry_lines
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_users_journal_entry_lines_update" ON journal_entry_lines
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_users_journal_entry_lines_delete" ON journal_entry_lines
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- STEP 4: Grant necessary permissions
-- ============================================

GRANT ALL ON journal_entries TO authenticated;
GRANT ALL ON journal_entry_lines TO authenticated;

-- ============================================
-- VERIFICATION: Check policies are created
-- ============================================

SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('journal_entries', 'journal_entry_lines')
ORDER BY tablename, policyname;
