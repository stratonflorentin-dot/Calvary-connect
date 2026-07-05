-- SQL migration for Internal Messaging / Chat system

-- 1. Create chat_channels table
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  type TEXT NOT NULL CHECK (type IN ('group', 'trip', 'direct')),
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create chat_channel_members table
CREATE TABLE IF NOT EXISTS chat_channel_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (channel_id, user_id)
);

-- 3. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. Row Level Security Policies

-- Channels Policies
DROP POLICY IF EXISTS "Users can view channels they are member of" ON chat_channels;
CREATE POLICY "Users can view channels they are member of" ON chat_channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_channel_members 
      WHERE chat_channel_members.channel_id = chat_channels.id 
      AND chat_channel_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create channels" ON chat_channels;
CREATE POLICY "Users can create channels" ON chat_channels
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Members Policies
DROP POLICY IF EXISTS "Members can view their own membership" ON chat_channel_members;
CREATE POLICY "Members can view their own membership" ON chat_channel_members
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can join channels" ON chat_channel_members;
CREATE POLICY "Users can join channels" ON chat_channel_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Messages Policies
DROP POLICY IF EXISTS "Users can view messages in their channels" ON chat_messages;
CREATE POLICY "Users can view messages in their channels" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_channel_members 
      WHERE chat_channel_members.channel_id = chat_messages.channel_id 
      AND chat_channel_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send messages to their channels" ON chat_messages;
CREATE POLICY "Users can send messages to their channels" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_channel_members 
      WHERE chat_channel_members.channel_id = chat_messages.channel_id 
      AND chat_channel_members.user_id = auth.uid()
    )
    AND sender_id = auth.uid()
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_channels_trip ON chat_channels(trip_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_channel ON chat_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

-- 6. Trigger for automatic audit trail of channel creations
DROP TRIGGER IF EXISTS audit_chat_channels ON chat_channels;
CREATE TRIGGER audit_chat_channels AFTER INSERT OR UPDATE OR DELETE ON chat_channels
FOR EACH ROW EXECUTE FUNCTION audit_log();
