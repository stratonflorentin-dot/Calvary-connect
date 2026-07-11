-- Add Voice and Video Calling to Internal Chat
-- Integrates with existing chat architecture using auth.users identity
-- Run in Supabase SQL Editor

-- ============================================================================
-- PHASE 1: Create call_sessions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES chat_channels(id) ON DELETE SET NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
    'initiated', 'ringing', 'accepted', 'declined', 'ended', 'missed', 'busy', 'failed'
  )),
  started_at TIMESTAMP WITH TIME ZONE,
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,
  end_reason TEXT, -- 'user_ended', 'call_declined', 'call_missed', 'connection_failed', 'timeout'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2: Create call_signaling table for WebRTC signaling
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_signaling (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'offer', 'answer', 'ice_candidate', 'ringing', 'accepted', 'declined', 'busy', 'ended'
  )),
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PHASE 3: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_call_sessions_caller ON call_sessions(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_receiver ON call_sessions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_channel ON call_sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_created ON call_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_signaling_call ON call_signaling(call_id);
CREATE INDEX IF NOT EXISTS idx_call_signaling_sender ON call_signaling(sender_id);
CREATE INDEX IF NOT EXISTS idx_call_signaling_type ON call_signaling(signal_type);
CREATE INDEX IF NOT EXISTS idx_call_signaling_created ON call_signaling(created_at ASC);

-- ============================================================================
-- PHASE 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_signaling ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 5: Create helper function for call participation
-- ============================================================================

CREATE OR REPLACE FUNCTION is_call_participant(p_call_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM call_sessions 
    WHERE id = p_call_id 
    AND (caller_id = p_user_id OR receiver_id = p_user_id)
  );
$$;

-- ============================================================================
-- PHASE 6: Create RLS policies for call_sessions
-- ============================================================================

-- Users can view calls they participate in
DROP POLICY IF EXISTS call_sessions_select ON call_sessions;
CREATE POLICY call_sessions_select ON call_sessions
  FOR SELECT USING (
    is_call_participant(id, auth.uid())
  );

-- Users can create calls (they are the caller)
DROP POLICY IF EXISTS call_sessions_insert ON call_sessions;
CREATE POLICY call_sessions_insert ON call_sessions
  FOR INSERT WITH CHECK (
    caller_id = auth.uid()
  );

-- Users can update calls they participate in
DROP POLICY IF EXISTS call_sessions_update ON call_sessions;
CREATE POLICY call_sessions_update ON call_sessions
  FOR UPDATE USING (
    is_call_participant(id, auth.uid())
  );

-- Users can delete calls they participate in
DROP POLICY IF EXISTS call_sessions_delete ON call_sessions;
CREATE POLICY call_sessions_delete ON call_sessions
  FOR DELETE USING (
    is_call_participant(id, auth.uid())
  );

-- ============================================================================
-- PHASE 7: Create RLS policies for call_signaling
-- ============================================================================

-- Users can view signaling for calls they participate in
DROP POLICY IF EXISTS call_signaling_select ON call_signaling;
CREATE POLICY call_signaling_select ON call_signaling
  FOR SELECT USING (
    is_call_participant(call_id, auth.uid())
  );

-- Users can insert signaling for calls they participate in
DROP POLICY IF EXISTS call_signaling_insert ON call_signaling;
CREATE POLICY call_signaling_insert ON call_signaling
  FOR INSERT WITH CHECK (
    is_call_participant(call_id, auth.uid()) AND
    sender_id = auth.uid()
  );

-- ============================================================================
-- PHASE 8: Create function to initiate a call
-- ============================================================================

CREATE OR REPLACE FUNCTION initiate_call(
  p_receiver_id UUID,
  p_call_type TEXT,
  p_channel_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call_id UUID;
  v_existing_call_id UUID;
BEGIN
  -- Check if receiver has an active call
  SELECT id INTO v_existing_call_id
  FROM call_sessions
  WHERE receiver_id = p_receiver_id
  AND status IN ('initiated', 'ringing', 'accepted')
  LIMIT 1;
  
  IF v_existing_call_id IS NOT NULL THEN
    -- Receiver is busy, create a missed call record
    INSERT INTO call_sessions (caller_id, receiver_id, channel_id, call_type, status, end_reason)
    VALUES (auth.uid(), p_receiver_id, p_channel_id, p_call_type, 'busy', 'receiver_busy')
    RETURNING id INTO v_call_id;
    
    RETURN v_call_id;
  END IF;
  
  -- Create new call session
  INSERT INTO call_sessions (caller_id, receiver_id, channel_id, call_type, status)
  VALUES (auth.uid(), p_receiver_id, p_channel_id, p_call_type, 'initiated')
  RETURNING id INTO v_call_id;
  
  RETURN v_call_id;
END;
$$;

-- ============================================================================
-- PHASE 9: Create function to answer a call
-- ============================================================================

CREATE OR REPLACE FUNCTION answer_call(p_call_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE call_sessions
  SET 
    status = 'accepted',
    answered_at = NOW(),
    started_at = COALESCE(started_at, NOW())
  WHERE id = p_call_id
  AND receiver_id = auth.uid()
  AND status IN ('initiated', 'ringing');
  
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- PHASE 10: Create function to decline a call
-- ============================================================================

CREATE OR REPLACE FUNCTION decline_call(p_call_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE call_sessions
  SET 
    status = 'declined',
    ended_at = NOW(),
    end_reason = 'call_declined'
  WHERE id = p_call_id
  AND receiver_id = auth.uid()
  AND status IN ('initiated', 'ringing');
  
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- PHASE 11: Create function to end a call
-- ============================================================================

CREATE OR REPLACE FUNCTION end_call(p_call_id UUID, p_end_reason TEXT DEFAULT 'user_ended')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started_at TIMESTAMP WITH TIME ZONE;
  v_ended_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get call timing info
  SELECT started_at, COALESCE(ended_at, NOW())
  INTO v_started_at, v_ended_at
  FROM call_sessions
  WHERE id = p_call_id
  AND (caller_id = auth.uid() OR receiver_id = auth.uid());
  
  -- Calculate duration if call was answered
  UPDATE call_sessions
  SET 
    status = 'ended',
    ended_at = NOW(),
    duration_seconds = CASE 
      WHEN answered_at IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, answered_at)))::INTEGER
      ELSE 0 
    END,
    end_reason = p_end_reason,
    updated_at = NOW()
  WHERE id = p_call_id
  AND (caller_id = auth.uid() OR receiver_id = auth.uid())
  AND status IN ('initiated', 'ringing', 'accepted');
  
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- PHASE 12: Create function to mark call as missed
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_call_missed(p_call_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE call_sessions
  SET 
    status = 'missed',
    ended_at = NOW(),
    end_reason = 'call_missed'
  WHERE id = p_call_id
  AND caller_id = auth.uid()
  AND status IN ('initiated', 'ringing');
  
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- PHASE 13: Add call history to chat_messages (optional enhancement)
-- ============================================================================

-- Add column to track call-related messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS call_id UUID REFERENCES call_sessions(id) ON DELETE SET NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'call_event'));

-- Create index for call messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_call ON chat_messages(call_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON chat_messages(message_type);

-- ============================================================================
-- PHASE 14: Enable realtime for call signaling
-- ============================================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE call_signaling;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PHASE 15: Notify PostgREST to reload schema
-- ============================================================================
NOTIFY pgrst, 'reload schema';
