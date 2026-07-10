-- Chat messages carry the sender's display name so the UI can show who wrote
-- what — including the legacy offline-admin session that has no
-- user_profiles row, and realtime payloads that arrive without a join.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_name text;
NOTIFY pgrst, 'reload schema';
