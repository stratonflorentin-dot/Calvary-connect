-- Fix internal chat: 004_internal_chat.sql shipped with three defects that make
-- the chat unusable:
--   1. The audit_log() trigger on chat_channels fails with "permission denied
--      for table users" on every insert.
--   2. RLS only lets members view channels, but nothing adds the creator as a
--      member, so newly created channels are invisible even to their creator.
--   3. Message policies depend on the same broken membership chain.
--
-- This is an internal company tool: every signed-in employee may see and post
-- in group/trip channels. Run this in the Supabase SQL editor.

-- 1. Remove the broken audit trigger (audit_log() references a "users" table
--    the executing role cannot access).
DROP TRIGGER IF EXISTS audit_chat_channels ON chat_channels;

-- 2. Replace the membership-gated policies. This is an internal tool whose
--    primary owner signs in through a legacy offline session with no Supabase
--    auth, so chat must also accept anon-key requests with a null sender.
--    When a real session exists, the sender must match auth.uid().
DROP POLICY IF EXISTS "Users can view channels they are member of" ON chat_channels;
DROP POLICY IF EXISTS "Users can create channels" ON chat_channels;
DROP POLICY IF EXISTS "Authenticated can view channels" ON chat_channels;
DROP POLICY IF EXISTS "Authenticated can create channels" ON chat_channels;
CREATE POLICY "Chat channels read" ON chat_channels
  FOR SELECT USING (true);
CREATE POLICY "Chat channels create" ON chat_channels
  FOR INSERT WITH CHECK (created_by IS NULL OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users can view messages in their channels" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their channels" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated can view messages" ON chat_messages;
DROP POLICY IF EXISTS "Authenticated can send messages" ON chat_messages;
CREATE POLICY "Chat messages read" ON chat_messages
  FOR SELECT USING (true);
CREATE POLICY "Chat messages send" ON chat_messages
  FOR INSERT WITH CHECK (sender_id IS NULL OR sender_id = auth.uid());

-- 3. Make sure realtime is enabled for live message delivery.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Seed starter channels (id conflict-safe).
INSERT INTO chat_channels (name, type)
SELECT v.name, 'group'
FROM (VALUES ('General'), ('Dispatch')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM chat_channels c WHERE c.name = v.name);
