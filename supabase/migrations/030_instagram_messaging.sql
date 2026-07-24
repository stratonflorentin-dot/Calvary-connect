-- Instagram DM integration (@calvarytransport.tz)
--
-- New, dedicated tables rather than extending chat_channels/chat_messages —
-- Instagram senders have no auth.uid() and no channel-membership model, and
-- altering the actively-used internal chat/call schema for an unrelated
-- concern isn't worth the risk. All writes happen server-side via the
-- service-role admin client (webhook receiver, reply server action), so RLS
-- here only needs to gate reads for staff.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Roles that own client relationships — matches who gets Instagram-related
-- notifications and who can read/reply in the inbox.
CREATE OR REPLACE FUNCTION public.can_view_instagram_inbox()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('CEO', 'ADMIN', 'SALESMAN', 'OPERATOR');
$$;

CREATE TABLE IF NOT EXISTS public.instagram_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_sender_id text NOT NULL UNIQUE,
  ig_username text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instagram_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.instagram_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content text,
  media_url text,
  ig_message_id text,
  sent_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_messages_conversation
  ON public.instagram_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_instagram_conversations_sender
  ON public.instagram_conversations(ig_sender_id);

-- Link a conversation to an existing client record — manual/future work,
-- not resolved automatically by this migration.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS instagram_handle text;

ALTER TABLE public.instagram_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_conversations_read ON public.instagram_conversations;
CREATE POLICY instagram_conversations_read ON public.instagram_conversations
  FOR SELECT USING (public.can_view_instagram_inbox());

DROP POLICY IF EXISTS instagram_messages_read ON public.instagram_messages;
CREATE POLICY instagram_messages_read ON public.instagram_messages
  FOR SELECT USING (public.can_view_instagram_inbox());

-- Media attachments (images sent via DM), mirroring the existing
-- chat-attachments bucket convention.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instagram-media',
  'instagram-media',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;
