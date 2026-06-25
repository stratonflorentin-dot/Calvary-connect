-- ============================================================================
-- AUDIT LOG SYSTEM - Track all database changes
-- ============================================================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT,
    user_role TEXT,
    action TEXT NOT NULL, -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
    table_name TEXT NOT NULL, -- purchases, sales, vehicles, etc.
    record_id UUID, -- ID of the affected record
    old_data JSONB, -- Previous data (for updates/deletes)
    new_data JSONB, -- New data (for creates/updates)
    change_summary TEXT, -- Human-readable description
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to insert audit logs
DROP POLICY IF EXISTS "Allow users to insert audit logs" ON audit_logs;
CREATE POLICY "Allow users to insert audit logs" 
ON audit_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Only CEO and Admin can view all audit logs
DROP POLICY IF EXISTS "CEO and Admin can view audit logs" ON audit_logs;
CREATE POLICY "CEO and Admin can view audit logs" 
ON audit_logs FOR SELECT 
TO authenticated 
USING (
    -- Check if user's role in JWT is CEO or ADMIN
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' IN ('CEO', 'ADMIN')
);

-- Users can view their own audit logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs" 
ON audit_logs FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Create function to automatically log changes
CREATE OR REPLACE FUNCTION log_audit_change(
    p_user_id UUID,
    p_user_name TEXT,
    p_user_role TEXT,
    p_action TEXT,
    p_table_name TEXT,
    p_record_id UUID,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_change_summary TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id, user_name, user_role, action, table_name, 
        record_id, old_data, new_data, change_summary,
        ip_address, user_agent
    ) VALUES (
        p_user_id, p_user_name, p_user_role, p_action, p_table_name,
        p_record_id, p_old_data, p_new_data, p_change_summary,
        current_setting('request.headers', true)::jsonb->>'x-real-ip',
        current_setting('request.headers', true)::jsonb->>'user-agent'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_audit_change TO authenticated;

-- ============================================================================
-- NOTIFICATIONS TABLE - For real-time alerts
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id), -- Recipient
    sender_id UUID REFERENCES auth.users(id), -- Who triggered it
    sender_name TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- info, success, warning, error
    category TEXT, -- 'audit', 'system', 'alert'
    is_read BOOLEAN DEFAULT false,
    action_url TEXT, -- Link to relevant page
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" 
ON notifications FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- Users can only update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" 
ON notifications FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid());

-- System can insert notifications for any user
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" 
ON notifications FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" 
ON notifications FOR DELETE 
TO authenticated 
USING (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- FUNCTION TO NOTIFY CEO/ADMIN ON CRITICAL CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_ceo_admin_on_change(
    p_sender_id UUID,
    p_sender_name TEXT,
    p_table_name TEXT,
    p_action TEXT,
    p_record_id UUID,
    p_summary TEXT
) RETURNS VOID AS $$
DECLARE
    v_recipient_id UUID;
BEGIN
    -- Notify all CEOs and Admins (check from auth.users metadata)
    FOR v_recipient_id IN 
        SELECT id FROM auth.users 
        WHERE (raw_user_meta_data ->> 'role') IN ('CEO', 'ADMIN')
        AND id != p_sender_id
    LOOP
        INSERT INTO notifications (
            user_id, sender_id, sender_name, title, message, type, category, action_url
        ) VALUES (
            v_recipient_id,
            p_sender_id,
            p_sender_name,
            p_table_name || ' ' || p_action,
            p_sender_name || ' ' || p_action || ' a ' || p_table_name || ' record: ' || p_summary,
            CASE 
                WHEN p_action = 'DELETE' THEN 'warning'
                WHEN p_table_name IN ('purchases', 'sales', 'invoices') AND p_action IN ('CREATE', 'UPDATE') THEN 'success'
                ELSE 'info'
            END,
            'audit',
            '/finance'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Audit logging and notification system created successfully!' as status;
