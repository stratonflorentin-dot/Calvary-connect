-- =============================================================================
-- Calvary Connect — Migration 027: Fix chat message notifications trigger
-- Project: qaqonhjeqtlatqsrqcnx
--
-- Run this ENTIRE script in the Supabase SQL Editor. Idempotent.
--
-- ROOT CAUSE (verified live on 2026-07-15):
--   Every INSERT into chat_messages fails with
--     42703: column "severity" of relation "notifications" does not exist
--   The trigger from migration 014 inserts into notifications using columns
--   (severity, is_read) that do not exist on the live table, which has
--   (type, module, read) instead — and type + module are NOT NULL.
--   Because the trigger aborts, the ENTIRE message insert rolls back:
--   zero rows in chat_messages, so no message ever reaches another user
--   and no realtime event is ever emitted.
--
-- FIX:
--   1. Recreate the trigger function against the REAL notifications schema.
--   2. SECURITY DEFINER so notifications RLS can never block a message.
--   3. Wrap the notification insert in an exception handler so that even if
--      the notifications schema drifts again, chat messages still send.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_chat_message_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_channel_name TEXT;
    v_sender_name TEXT;
    v_other_member RECORD;
BEGIN
    SELECT
        COALESCE(c.name, 'Direct Message'),
        COALESCE(NEW.sender_name, u.name, 'Team member')
    INTO v_channel_name, v_sender_name
    FROM chat_channels c
    LEFT JOIN user_profiles u ON u.id = NEW.sender_id
    WHERE c.id = NEW.channel_id;

    FOR v_other_member IN (
        SELECT user_id
        FROM chat_channel_members
        WHERE channel_id = NEW.channel_id
          AND user_id IS DISTINCT FROM NEW.sender_id
    ) LOOP
        BEGIN
            INSERT INTO notifications (
                user_id,
                title,
                message,
                type,
                module,
                read,
                action_url,
                sender_name
            ) VALUES (
                v_other_member.user_id,
                CASE
                    WHEN v_channel_name = 'Direct Message' THEN 'New message from ' || v_sender_name
                    ELSE 'New message in ' || v_channel_name
                END,
                CASE
                    WHEN char_length(NEW.content) > 100 THEN left(NEW.content, 100) || '...'
                    ELSE NEW.content
                END,
                'info',
                'chat',
                false,
                '/chat',
                v_sender_name
            );
        EXCEPTION WHEN OTHERS THEN
            -- A notification failure must NEVER abort the chat message itself.
            RAISE WARNING 'chat notification insert failed for user %: %',
                v_other_member.user_id, SQLERRM;
        END;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_chat_message_notifications ON chat_messages;
CREATE TRIGGER trigger_chat_message_notifications
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.create_chat_message_notifications();

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN RAISE NOTICE 'Migration 027 complete — chat message inserts unblocked'; END $$;

-- =============================================================================
-- Verification (run after applying):
--   1. Send a message in the app — it must appear for the other user instantly.
--   2. SELECT COUNT(*) FROM chat_messages;   -- must grow past 0
-- =============================================================================
