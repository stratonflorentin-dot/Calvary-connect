
-- Create a trigger to send notifications when new chat messages are inserted

-- First, let's create a function that creates the notifications
CREATE OR REPLACE FUNCTION create_chat_message_notifications()
RETURNS TRIGGER AS $$
DECLARE
    v_channel_name TEXT;
    v_sender_name TEXT;
    v_member UUID;
    v_other_member RECORD;
BEGIN
    -- Get the channel name and sender name
    SELECT 
        COALESCE(c.name, 'Direct Message'),
        COALESCE(NEW.sender_name, u.name)
    INTO v_channel_name, v_sender_name
    FROM chat_channels c
    LEFT JOIN user_profiles u ON u.id = NEW.sender_id
    WHERE c.id = NEW.channel_id;

    -- Insert notifications for all channel members except the sender
    FOR v_other_member IN (
        SELECT user_id 
        FROM chat_channel_members 
        WHERE channel_id = NEW.channel_id 
        AND user_id != NEW.sender_id
    ) LOOP
        INSERT INTO notifications (
            user_id,
            title,
            message,
            severity,
            is_read,
            action_url
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
            false,
            '/chat'
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now create the trigger that executes this function after insert on chat_messages
DROP TRIGGER IF EXISTS trigger_chat_message_notifications ON chat_messages;
CREATE TRIGGER trigger_chat_message_notifications
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION create_chat_message_notifications();

-- Update RLS policies if needed - let's make sure that the system (postgres) can insert notifications
-- Wait, actually, the function runs as the definer (postgres by default), so it should be able to insert!

-- Also, let's update notifications table to have a 'sender_name' column if not exists!
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_name TEXT;
