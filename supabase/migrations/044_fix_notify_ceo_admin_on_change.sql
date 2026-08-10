-- Fixes a live, currently-broken function: notify_ceo_admin_on_change
-- (originally defined in database/migrations/001-master-production-setup.sql,
-- carried forward as-is into supabase/migrations/000_legacy_base_schema.sql
-- for historical fidelity — see that file's header) inserts into
-- `notifications` using columns that don't exist: sender_id, sender_name,
-- category, data.
--
-- The real notifications schema (supabase/migrations/001_erp_workflow_tables.sql
-- — a plain `CREATE TABLE notifications`, not `IF NOT EXISTS`, so it's the
-- actual creator; a later migration's `CREATE TABLE IF NOT EXISTS
-- notifications (...)` with an `is_read` column was a silent no-op against
-- an already-existing table) is: id, user_id, title, message, type,
-- module, entity_type, entity_id, read, read_at, action_url, created_at.
-- Confirmed independently by src/services/notification-service.ts's
-- createNotification (the function every other working notification path
-- in the app uses) and src/components/navigation/sidebar.tsx's unread-count
-- query, both of which already use `read`, not `is_read`.
--
-- src/services/audit-service.ts calls this RPC live on every logged CRUD
-- action, wrapped in a try/catch that only console.errors on failure — so
-- this has likely never successfully delivered a single notification to
-- CEO/ADMIN in production; it's been silently failing every time.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION notify_ceo_admin_on_change(
    p_sender_id UUID,
    p_sender_name TEXT,
    p_table_name TEXT,
    p_action TEXT,
    p_record_id UUID,
    p_summary TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_recipient_id UUID;
BEGIN
    FOR v_recipient_id IN
        SELECT id FROM user_profiles
        WHERE role IN ('CEO', 'ADMIN')
        AND id != p_sender_id
    LOOP
        INSERT INTO notifications (
            user_id, title, message, type, module, entity_type, entity_id, action_url
        ) VALUES (
            v_recipient_id,
            p_table_name || ' ' || p_action,
            p_sender_name || ' ' || p_action || ' a ' || p_table_name || ' record: ' || p_summary,
            CASE
                WHEN p_action = 'DELETE' THEN 'warning'
                WHEN p_table_name IN ('purchases', 'sales', 'invoices') AND p_action IN ('CREATE', 'UPDATE') THEN 'success'
                ELSE 'info'
            END,
            'audit',
            p_table_name,
            p_record_id::text,
            '/finance'
        );
    END LOOP;
END;
$$;

INSERT INTO public.schema_migrations (version) VALUES ('044_fix_notify_ceo_admin_on_change.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
