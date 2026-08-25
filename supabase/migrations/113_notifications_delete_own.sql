-- The notification bell and Notifications Center pages added "Mark all
-- read"/"Clear all"/per-item delete buttons that call
-- .from("notifications").delete() — but 038_lock_down_rls_gaps.sql only
-- ever created SELECT/INSERT/UPDATE policies for notifications, never a
-- DELETE one. With RLS enabled and no matching policy, every delete
-- silently affects 0 rows: no error is thrown, the UI removes it from
-- local state optimistically, but the row is still there in the database
-- and reappears on refresh — this is why "notification cannot be deleted".
--
-- Matches the same ownership shape as notifications_read_own/
-- notifications_update_own (own row, or CEO/ADMIN).
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

DROP POLICY IF EXISTS notifications_delete_own ON notifications;
CREATE POLICY notifications_delete_own ON notifications
  FOR DELETE USING (user_id = auth.uid() OR current_user_role() IN ('CEO','ADMIN'));

NOTIFY pgrst, 'reload schema';
