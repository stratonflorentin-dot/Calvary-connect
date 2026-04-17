-- USER ACTIVITY TRACKING SYSTEM
-- Adds granular status tracking and automatic behavior detection

-- ============================================
-- 1. ADD ACTIVITY TRACKING COLUMNS
-- ============================================

-- Add columns to track user activity
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS status_reason TEXT; -- Why status changed (e.g., "No login for 30 days")

-- Update status to include more granular options
-- Note: Using CHECK constraint would require migration, so we'll handle in app
COMMENT ON COLUMN user_profiles.status IS 'User status: active, invited, dormant, suspended, inactive';

-- ============================================
-- 2. CREATE ACTIVITY TRACKING FUNCTIONS
-- ============================================

-- Function to record user login
CREATE OR REPLACE FUNCTION record_user_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET 
    last_login_at = NOW(),
    last_activity_at = NOW(),
    login_count = login_count + 1,
    status = CASE 
      WHEN status IN ('invited', 'dormant') THEN 'active'
      ELSE status 
    END,
    status_reason = CASE 
      WHEN status IN ('invited', 'dormant') THEN 'Reactivated on login'
      ELSE status_reason 
    END,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.sessions to track logins
DROP TRIGGER IF EXISTS on_user_login ON auth.sessions;
CREATE TRIGGER on_user_login
  AFTER INSERT ON auth.sessions
  FOR EACH ROW
  EXECUTE FUNCTION record_user_login();

-- Function to update last activity on any user action
CREATE OR REPLACE FUNCTION update_user_activity(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET 
    last_activity_at = NOW(),
    status = CASE 
      WHEN status = 'dormant' THEN 'active'
      ELSE status 
    END,
    updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. AUTOMATIC STATUS DETECTION FUNCTION
-- ============================================

-- Function to automatically update user statuses based on behavior
CREATE OR REPLACE FUNCTION detect_user_behavior_status()
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  old_status VARCHAR,
  new_status VARCHAR,
  reason TEXT
) AS $$
BEGIN
  -- Mark invited users (pre-added but never logged in after 7 days)
  RETURN QUERY
  UPDATE user_profiles
  SET 
    status = 'invited',
    status_reason = 'Pre-added but never signed up',
    updated_at = NOW()
  WHERE 
    login_count = 0 
    AND invited_at IS NOT NULL
    AND invited_at < NOW() - INTERVAL '7 days'
    AND status NOT IN ('suspended', 'inactive')
  RETURNING 
    id, 
    email, 
    'pending'::VARCHAR as old_status,
    status::VARCHAR as new_status,
    status_reason as reason;

  -- Mark dormant users (no activity for 30 days)
  RETURN QUERY
  UPDATE user_profiles
  SET 
    status = 'dormant',
    status_reason = 'No activity for 30 days',
    updated_at = NOW()
  WHERE 
    last_activity_at < NOW() - INTERVAL '30 days'
    AND status = 'active'
  RETURNING 
    id, 
    email, 
    'active'::VARCHAR as old_status,
    status::VARCHAR as new_status,
    status_reason as reason;

  -- Mark dormant users (no login for 60 days even with activity)
  RETURN QUERY
  UPDATE user_profiles
  SET 
    status = 'dormant',
    status_reason = 'No login for 60 days',
    updated_at = NOW()
  WHERE 
    (last_login_at < NOW() - INTERVAL '60 days' OR last_login_at IS NULL)
    AND created_at < NOW() - INTERVAL '60 days'
    AND status = 'active'
    AND login_count > 0
  RETURNING 
    id, 
    email, 
    'active'::VARCHAR as old_status,
    status::VARCHAR as new_status,
    status_reason as reason;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. MANUAL STATUS MANAGEMENT FUNCTIONS
-- ============================================

-- Function to invite a user (pre-add with invited status)
CREATE OR REPLACE FUNCTION invite_user(
  p_email VARCHAR,
  p_name VARCHAR,
  p_role VARCHAR,
  p_invited_by UUID
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Generate temporary ID
  new_user_id := gen_random_uuid();
  
  INSERT INTO user_profiles (
    id,
    email,
    name,
    role,
    status,
    status_reason,
    invited_at,
    invited_by,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    p_email,
    p_name,
    p_role,
    'invited',
    'Waiting for user to complete signup',
    NOW(),
    p_invited_by,
    NOW(),
    NOW()
  );
  
  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to suspend a user
CREATE OR REPLACE FUNCTION suspend_user(
  p_user_id UUID,
  p_reason TEXT,
  p_suspended_by UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET 
    status = 'suspended',
    status_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Log the suspension
  INSERT INTO audit_logs (
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    performed_by,
    created_at
  ) VALUES (
    'SUSPEND_USER',
    'user_profiles',
    p_user_id,
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'suspended', 'reason', p_reason),
    p_suspended_by,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reactivate a user
CREATE OR REPLACE FUNCTION reactivate_user(
  p_user_id UUID,
  p_reason TEXT,
  p_reactivated_by UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET 
    status = 'active',
    status_reason = p_reason,
    last_activity_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. VIEWS FOR MONITORING
-- ============================================

-- View: User Activity Overview
CREATE OR REPLACE VIEW user_activity_overview AS
SELECT 
  p.id,
  p.email,
  p.name,
  p.role,
  p.status,
  p.status_reason,
  p.login_count,
  p.last_login_at,
  p.last_activity_at,
  p.invited_at,
  inviter.name as invited_by_name,
  CASE 
    WHEN p.status = 'invited' THEN 
      EXTRACT(DAY FROM NOW() - p.invited_at)::INTEGER
    WHEN p.status = 'dormant' THEN 
      EXTRACT(DAY FROM NOW() - COALESCE(p.last_activity_at, p.last_login_at))::INTEGER
    ELSE NULL
  END as days_in_current_status,
  CASE 
    WHEN p.last_activity_at > NOW() - INTERVAL '1 hour' THEN 'online'
    WHEN p.last_activity_at > NOW() - INTERVAL '24 hours' THEN 'recent'
    WHEN p.last_activity_at > NOW() - INTERVAL '7 days' THEN 'this_week'
    WHEN p.last_login_at IS NULL THEN 'never_logged_in'
    ELSE 'inactive'
  END as activity_indicator
FROM user_profiles p
LEFT JOIN user_profiles inviter ON p.invited_by = inviter.id
ORDER BY 
  CASE p.status 
    WHEN 'invited' THEN 1
    WHEN 'dormant' THEN 2
    WHEN 'suspended' THEN 3
    WHEN 'active' THEN 4
    ELSE 5
  END,
  p.last_activity_at DESC NULLS LAST;

-- ============================================
-- 6. INITIAL DATA MIGRATION
-- ============================================

-- Update existing users based on their activity
UPDATE user_profiles
SET 
  last_login_at = created_at,
  last_activity_at = created_at,
  status = CASE 
    WHEN login_count > 0 OR last_login_at IS NOT NULL THEN 'active'
    ELSE 'invited'
  END,
  invited_at = COALESCE(invited_at, created_at)
WHERE last_login_at IS NULL AND last_activity_at IS NULL;

-- ============================================
-- 7. VERIFICATION
-- ============================================

SELECT 'Activity tracking columns added' as status;
SELECT 
  status, 
  COUNT(*) as user_count,
  AVG(login_count) as avg_logins
FROM user_profiles 
GROUP BY status;

SELECT * FROM user_activity_overview LIMIT 10;
