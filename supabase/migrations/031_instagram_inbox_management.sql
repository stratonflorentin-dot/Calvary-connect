-- Instagram inbox management: unread tracking, staff assignment, and the
-- write access those need. Reads staff already had (030); this adds the
-- lightweight metadata writes (read state, assignment, customer link) that
-- don't warrant routing through a server action the way sending a message
-- via the Graph API does.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE public.instagram_conversations ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
ALTER TABLE public.instagram_conversations ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instagram_conversations_is_read
  ON public.instagram_conversations(is_read);
CREATE INDEX IF NOT EXISTS idx_instagram_conversations_assigned_to
  ON public.instagram_conversations(assigned_to);

DROP POLICY IF EXISTS instagram_conversations_update ON public.instagram_conversations;
CREATE POLICY instagram_conversations_update ON public.instagram_conversations
  FOR UPDATE USING (public.can_view_instagram_inbox())
  WITH CHECK (public.can_view_instagram_inbox());
