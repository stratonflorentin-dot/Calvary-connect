-- rate_sheet_edits has RLS enabled but zero policies, so the
-- log_rate_sheet_changes() trigger (fires on every rate_sheets
-- insert/update/delete, running as the invoking user — it isn't
-- SECURITY DEFINER) can't insert its audit row: "new row violates
-- row-level security policy for table rate_sheet_edits". That blocks
-- every rate sheet edit/delete.
--
-- Mirrors the existing audit_trail table's policy shape exactly:
-- inserts are system/trigger-driven so are allowed broadly, reads
-- are restricted to signed-in users, and there is deliberately no
-- UPDATE/DELETE policy — audit rows are immutable once written.
CREATE POLICY "System can insert rate sheet edits"
  ON public.rate_sheet_edits
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view rate sheet edits"
  ON public.rate_sheet_edits
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
