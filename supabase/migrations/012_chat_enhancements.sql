
-- Migration: Chat Enhancements (Delivery Status, Typing, Presence, Reactions, etc.)
-- Idempotent - run multiple times safely

-- 1. Add delivery status to chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed'));
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Add columns for replies and edits
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_by TEXT; -- 'me', 'everyone', or null
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 3. Add attachments support
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 4. Create chat_reactions table
CREATE TABLE IF NOT EXISTS chat_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- 5. Enable RLS on chat_reactions
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_reactions_read ON chat_reactions;
DROP POLICY IF EXISTS chat_reactions_write ON chat_reactions;
DROP POLICY IF EXISTS chat_reactions_delete ON chat_reactions;

CREATE POLICY chat_reactions_read ON chat_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_messages
      JOIN chat_channel_members ON chat_messages.channel_id = chat_channel_members.channel_id
      WHERE chat_messages.id = chat_reactions.message_id
      AND chat_channel_members.user_id = auth.uid()
    )
  );
CREATE POLICY chat_reactions_write ON chat_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM chat_messages
      JOIN chat_channel_members ON chat_messages.channel_id = chat_channel_members.channel_id
      WHERE chat_messages.id = chat_reactions.message_id
      AND chat_channel_members.user_id = auth.uid()
    )
  );
CREATE POLICY chat_reactions_delete ON chat_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Create chat_typing table (or use presence, but table for persistence)
CREATE TABLE IF NOT EXISTS chat_typing (
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  typing_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

ALTER TABLE chat_typing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_typing_read ON chat_typing;
DROP POLICY IF EXISTS chat_typing_write ON chat_typing;

CREATE POLICY chat_typing_read ON chat_typing
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_channel_members
      WHERE chat_channel_members.channel_id = chat_typing.channel_id
      AND chat_channel_members.user_id = auth.uid()
    )
  );
CREATE POLICY chat_typing_write ON chat_typing
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM chat_channel_members
      WHERE chat_channel_members.channel_id = chat_typing.channel_id
      AND chat_channel_members.user_id = auth.uid()
    )
  );

-- 7. Add columns to user_profiles for presence and last seen (if not exists)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS presence_status TEXT NOT NULL DEFAULT 'offline' CHECK (presence_status IN ('online', 'away', 'offline'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON chat_messages(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON chat_messages(reply_to);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON chat_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_typing_channel ON chat_typing(channel_id);

NOTIFY pgrst, 'reload schema';
