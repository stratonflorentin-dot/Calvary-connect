-- WhatsApp-style direct messages between workers.
--
-- Reuses chat_channels (type='direct') and chat_channel_members from 004.
-- Fixes: the 004 policies on chat_channel_members reference themselves via
-- the channels policy and blow up with "infinite recursion detected", so no
-- browser session can read memberships at all.
-- Adds: last_read_at for unread counts.
--
-- Run after 010. Idempotent.

ALTER TABLE chat_channel_members ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

DROP POLICY IF EXISTS "Members can view their own membership" ON chat_channel_members;
DROP POLICY IF EXISTS "Users can join channels" ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_read ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_write ON chat_channel_members;
DROP POLICY IF EXISTS chat_members_update ON chat_channel_members;

CREATE POLICY chat_members_read ON chat_channel_members
  FOR SELECT USING (true);
CREATE POLICY chat_members_write ON chat_channel_members
  FOR INSERT WITH CHECK (true);
CREATE POLICY chat_members_update ON chat_channel_members
  FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_chat_members_user_read ON chat_channel_members (user_id, last_read_at);

NOTIFY pgrst, 'reload schema';
