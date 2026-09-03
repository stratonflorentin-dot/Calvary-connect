-- Two confirmed RLS gaps around journal posting, found while auditing the
-- finance schema for the Calvary Connect redesign:
--
-- 1. journal_entries_update (034_lock_down_finance_rls.sql) is a bare
--    `USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT'))` with no
--    WITH CHECK and no status-transition restriction. post_journal_entry()
--    (006_finance_foundation.sql) does the real work — role check,
--    already-posted guard, is_period_open() check, ΣDR=ΣCR balance check —
--    before flipping status/is_posted. But nothing stops a raw
--    `supabase.from("journal_entries").update({status:'posted', ...})` from
--    a CEO/ADMIN/ACCOUNTANT browser session from skipping ALL of that and
--    posting directly.
--
-- 2. journal_entry_lines has NO trigger at all (confirmed: grepped every
--    migration for `ON journal_entry_lines` — only indexes and RLS
--    policies exist, no BEFORE UPDATE/DELETE guard). trg_guard_posted_journal
--    (006) only covers journal_entries. So even once (1) is closed, a
--    privileged role can still directly edit a POSTED entry's actual
--    debit/credit line amounts without ever touching journal_entries.status
--    — guard_posted_journal() never fires, the entry looks untouched, and
--    the books are silently wrong.
--
-- Fix: tighten journal_entries_update to only allow draft-to-draft edits
-- (USING checks the pre-update/OLD row, WITH CHECK the post-update/NEW row —
-- together this blocks any UPDATE where either side isn't 'draft', which
-- covers both "edit a posted row" and "smuggle straight to posted via raw
-- update"), and add a new trigger on journal_entry_lines that blocks
-- UPDATE/DELETE once its parent journal_entries row is posted.
--
-- post_journal_entry() / reverse_journal_entry() continue to work
-- unaffected: they're SECURITY DEFINER, owned by the same role that owns
-- these tables, and Postgres exempts a table's owner from its own RLS
-- policies unless FORCE ROW LEVEL SECURITY is set — which nothing in this
-- schema's migration history sets on either table (verified: no
-- `FORCE ROW LEVEL SECURITY` anywhere in supabase/migrations/). The DO
-- block below asserts that assumption at apply time instead of silently
-- trusting it, since posting would break for everyone if it were wrong.
--
-- Idempotent: safe to run more than once.

DO $$
DECLARE
  v_forced boolean;
BEGIN
  SELECT relforcerowsecurity INTO v_forced FROM pg_class WHERE relname = 'journal_entries' AND relnamespace = 'public'::regnamespace;
  IF v_forced THEN
    RAISE EXCEPTION 'journal_entries has FORCE ROW LEVEL SECURITY set — this migration''s assumption that SECURITY DEFINER functions bypass RLS as the table owner does not hold. Stop and re-check post_journal_entry()/reverse_journal_entry() before proceeding.';
  END IF;
  SELECT relforcerowsecurity INTO v_forced FROM pg_class WHERE relname = 'journal_entry_lines' AND relnamespace = 'public'::regnamespace;
  IF v_forced THEN
    RAISE EXCEPTION 'journal_entry_lines has FORCE ROW LEVEL SECURITY set — same concern as journal_entries above.';
  END IF;
END $$;

-- ── journal_entries: draft-to-draft only for direct client writes ──────────
DROP POLICY IF EXISTS journal_entries_update ON journal_entries;
CREATE POLICY journal_entries_update ON journal_entries
  FOR UPDATE
  USING (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT') AND status = 'draft')
  WITH CHECK (current_user_role() IN ('CEO','ADMIN','ACCOUNTANT') AND status = 'draft');

-- ── journal_entry_lines: no direct edits/deletes once the parent is posted ─
CREATE OR REPLACE FUNCTION public.guard_posted_journal_lines()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_status text;
  v_is_posted boolean;
BEGIN
  v_parent_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  SELECT status, is_posted INTO v_status, v_is_posted
    FROM journal_entries WHERE id = v_parent_id;
  IF v_status = 'posted' OR v_is_posted THEN
    RAISE EXCEPTION 'Posted journal entries are immutable — create a reversal';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_posted_journal_lines ON journal_entry_lines;
CREATE TRIGGER trg_guard_posted_journal_lines
  BEFORE UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION guard_posted_journal_lines();

NOTIFY pgrst, 'reload schema';
