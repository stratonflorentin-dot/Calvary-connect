-- HR Meetings Module Migration
CREATE TABLE IF NOT EXISTS meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT NOT NULL DEFAULT 'staff_meeting' CHECK (meeting_type IN ('staff_meeting','performance_review','training','disciplinary','general')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  location TEXT,
  meeting_link TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_attendees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rsvp_status TEXT DEFAULT 'pending' CHECK (rsvp_status IN ('pending','accepted','declined','tentative')),
  responded_at TIMESTAMPTZ,
  UNIQUE(meeting_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Meetings RLS Policies
CREATE POLICY "Users can view meetings they are attendees of" ON meetings
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM meeting_attendees WHERE meeting_id = id)
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('ADMIN','CEO','HR'))
  );

CREATE POLICY "Admins create and manage meetings" ON meetings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('ADMIN','CEO','HR'))
  );

-- Meeting Attendees RLS
CREATE POLICY "Users can view and update their own attendance" ON meeting_attendees
  FOR ALL USING (auth.uid() = user_id OR auth.uid() IN (SELECT created_by FROM meetings WHERE id = meeting_id));

-- Notifications RLS
CREATE POLICY "Users can read their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_user_id ON meeting_attendees(user_id);
