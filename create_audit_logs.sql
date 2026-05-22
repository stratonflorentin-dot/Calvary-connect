-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    user_name VARCHAR(100),
    user_role VARCHAR(50),
    action VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT, VIEW
    table_name VARCHAR(50),
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    change_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RPC for logging audit changes
CREATE OR REPLACE FUNCTION log_audit_change(
    p_user_id UUID,
    p_user_name TEXT,
    p_user_role TEXT,
    p_action TEXT,
    p_table_name TEXT,
    p_record_id UUID,
    p_old_data JSONB,
    p_new_data JSONB,
    p_change_summary TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id, user_name, user_role, action, table_name, 
        record_id, old_data, new_data, change_summary
    ) VALUES (
        p_user_id, p_user_name, p_user_role, p_action, p_table_name,
        p_record_id, p_old_data, p_new_data, p_change_summary
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for notifying CEO/Admin
-- This is a placeholder for real notification logic (e.g., email, push, or another table)
CREATE OR REPLACE FUNCTION notify_ceo_admin_on_change(
    p_sender_id UUID,
    p_sender_name TEXT,
    p_table_name TEXT,
    p_action TEXT,
    p_record_id UUID,
    p_summary TEXT
)
RETURNS VOID AS $$
BEGIN
    -- For now, we just ensure it exists so the app doesn't crash
    -- You can add logic here to insert into a 'notifications' table
    RAISE NOTICE 'Critical change in % by %: %', p_table_name, p_sender_name, p_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all logs" ON audit_logs 
    FOR SELECT USING (auth.jwt()->>'role' IN ('CEO', 'ADMIN', 'ACCOUNTANT'));

CREATE POLICY "System can insert logs" ON audit_logs
    FOR INSERT WITH CHECK (true);
