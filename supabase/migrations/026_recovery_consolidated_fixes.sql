-- =============================================================================
-- Calvary Connect — Migration 026: Consolidated Recovery Fixes
-- Project: qaqonhjeqtlatqsrqcnx
--
-- Run this ENTIRE script in the Supabase SQL Editor.
-- It is fully idempotent — safe to run multiple times on the live database.
-- It only ALTERs/adds; it never drops tables or deletes business data.
--
-- Fixes (each section is commented):
--   1. chat_channel_members RLS: members of a channel can see ALL membership
--      rows of their channels (needed to resolve "the other person" in a DM)
--      without 42P17 recursion (helper is SECURITY DEFINER).
--   2. Deterministic direct-chat key (direct_key) with a UNIQUE index, and a
--      race-safe find_or_create_direct_chat.
--   3. UNIQUE (channel_id, user_id) so membership upserts (mark-as-read) work.
--   4. journal_entries: defaults for legacy NOT NULL columns (date,
--      total_debit, total_credit) so inserts stop failing with 23502.
--   5. vehicles: add columns the form uses (registration_expiry,
--      next_maintenance_due) and normalize the status CHECK constraint to
--      accept both legacy ('active', ...) and current app statuses
--      ('available', 'in_use', ...).
--   6. chat_typing table + RLS (used by typing indicators).
--   7. Realtime publication membership for tables the UI subscribes to.
-- =============================================================================

DO $$ BEGIN RAISE NOTICE 'Migration 026 starting — %', NOW(); END $$;

-- =============================================================================
-- SECTION 1: SECURITY DEFINER helpers (recreate deterministically)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_chat_channel_member(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_channel_members
    WHERE channel_id = p_channel_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_chat_channel_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_call_participant(p_call_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM call_sessions
    WHERE id = p_call_id
    AND (caller_id = p_user_id OR receiver_id = p_user_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_call_participant(UUID, UUID) TO authenticated;

-- =============================================================================
-- SECTION 2: Drop ALL existing policies on chat + call tables dynamically.
-- Previous migrations (004, 005, 011, 015, 017, 019, 020, 021, 022, 025) each
-- dropped policies by name and missed strays — the source of lingering 42P17.
-- Iterating pg_policies guarantees a clean slate regardless of history.
-- =============================================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'chat_channels', 'chat_channel_members', 'chat_messages',
        'chat_reactions', 'chat_typing', 'call_sessions', 'call_signaling'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
  RAISE NOTICE 'All existing chat/call policies dropped';
END $$;

-- =============================================================================
-- SECTION 3: Membership uniqueness (mark-as-read upsert depends on it)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.chat_channel_members'::regclass
      AND contype = 'u'
      AND conkey = (
        SELECT array_agg(attnum ORDER BY attnum)
        FROM pg_attribute
        WHERE attrelid = 'public.chat_channel_members'::regclass
          AND attname IN ('channel_id', 'user_id')
      )
  ) THEN
    -- Remove duplicate memberships first (keep the earliest row)
    DELETE FROM chat_channel_members a
    USING chat_channel_members b
    WHERE a.channel_id = b.channel_id
      AND a.user_id = b.user_id
      AND a.id > b.id;

    ALTER TABLE chat_channel_members
      ADD CONSTRAINT chat_channel_members_channel_user_key UNIQUE (channel_id, user_id);
    RAISE NOTICE 'UNIQUE (channel_id, user_id) added to chat_channel_members';
  ELSE
    RAISE NOTICE 'UNIQUE (channel_id, user_id) already present';
  END IF;
END $$;

-- =============================================================================
-- SECTION 4: Recreate non-recursive RLS policies
--
-- KEY DESIGN POINT: chat_channel_members SELECT allows a member to see ALL
-- membership rows of channels they belong to. The check goes through the
-- SECURITY DEFINER helper, which bypasses RLS internally — so there is NO
-- recursion (42P17 requires the policy itself to re-enter the same policy).
-- Without this, the client can never resolve who the other DM participant is,
-- which caused "Direct chat" placeholder names, self-chat confusion, and
-- hidden call buttons.
-- =============================================================================

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_signaling ENABLE ROW LEVEL SECURITY;

-- chat_channel_members
CREATE POLICY chat_channel_members_select ON chat_channel_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_chat_channel_member(channel_id, auth.uid())
  );

-- Insert own membership, or add members to a channel you created (group chats)
CREATE POLICY chat_channel_members_insert ON chat_channel_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = channel_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY chat_channel_members_update ON chat_channel_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY chat_channel_members_delete ON chat_channel_members
  FOR DELETE USING (user_id = auth.uid());

-- chat_channels
CREATE POLICY chat_channels_select ON chat_channels
  FOR SELECT USING (public.is_chat_channel_member(id, auth.uid()));

CREATE POLICY chat_channels_insert ON chat_channels
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY chat_channels_update ON chat_channels
  FOR UPDATE USING (public.is_chat_channel_member(id, auth.uid()));

-- chat_messages
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT USING (public.is_chat_channel_member(channel_id, auth.uid()));

CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT WITH CHECK (
    public.is_chat_channel_member(channel_id, auth.uid())
    AND sender_id = auth.uid()
  );

CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY chat_messages_delete ON chat_messages
  FOR DELETE USING (sender_id = auth.uid());

-- chat_reactions
CREATE POLICY chat_reactions_select ON chat_reactions
  FOR SELECT USING (
    public.is_chat_channel_member(
      (SELECT channel_id FROM chat_messages WHERE id = message_id),
      auth.uid()
    )
  );

CREATE POLICY chat_reactions_insert ON chat_reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND public.is_chat_channel_member(
      (SELECT channel_id FROM chat_messages WHERE id = message_id),
      auth.uid()
    )
  );

CREATE POLICY chat_reactions_delete ON chat_reactions
  FOR DELETE USING (user_id = auth.uid());

-- call_sessions
CREATE POLICY call_sessions_select ON call_sessions
  FOR SELECT USING (public.is_call_participant(id, auth.uid()));

CREATE POLICY call_sessions_insert ON call_sessions
  FOR INSERT WITH CHECK (caller_id = auth.uid());

CREATE POLICY call_sessions_update ON call_sessions
  FOR UPDATE USING (public.is_call_participant(id, auth.uid()));

CREATE POLICY call_sessions_delete ON call_sessions
  FOR DELETE USING (public.is_call_participant(id, auth.uid()));

-- call_signaling
CREATE POLICY call_signaling_select ON call_signaling
  FOR SELECT USING (public.is_call_participant(call_id, auth.uid()));

CREATE POLICY call_signaling_insert ON call_signaling
  FOR INSERT WITH CHECK (
    public.is_call_participant(call_id, auth.uid())
    AND sender_id = auth.uid()
  );

DO $$ BEGIN RAISE NOTICE 'Chat/call RLS policies recreated (non-recursive)'; END $$;

-- =============================================================================
-- SECTION 5: chat_typing table (typing indicators) + simple RLS
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_typing (
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  typing_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

ALTER TABLE chat_typing ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_typing_select ON chat_typing
  FOR SELECT USING (public.is_chat_channel_member(channel_id, auth.uid()));

CREATE POLICY chat_typing_insert ON chat_typing
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY chat_typing_update ON chat_typing
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY chat_typing_delete ON chat_typing
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- SECTION 6: user_profiles RLS — colleague discovery + own-row writes
-- (recreated deterministically; auth is still the only identity source)
-- =============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY user_profiles_select ON user_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY user_profiles_insert ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY user_profiles_update ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- =============================================================================
-- SECTION 7: Deterministic direct-chat key + race-safe RPC
--
-- direct_key = LEAST(uuid_a, uuid_b) || ':' || GREATEST(uuid_a, uuid_b)
-- A UNIQUE partial index over direct channels makes duplicate DMs impossible
-- even under concurrent creation.
-- =============================================================================

ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS direct_key TEXT;

-- Backfill direct_key for existing 2-member direct channels
UPDATE chat_channels c
SET direct_key = sub.key
FROM (
  SELECT m.channel_id,
         MIN(m.user_id::text) || ':' || MAX(m.user_id::text) AS key
  FROM chat_channel_members m
  GROUP BY m.channel_id
  HAVING COUNT(DISTINCT m.user_id) = 2
) sub
WHERE c.id = sub.channel_id
  AND c.type = 'direct'
  AND c.direct_key IS NULL;

-- Remove duplicate direct channels (same pair) before adding the unique index:
-- keep the channel that has messages, or the oldest one. Extra channels are
-- only deleted when they have NO messages (never destroy conversation data).
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT direct_key, array_agg(id ORDER BY created_at) AS ids
    FROM chat_channels
    WHERE type = 'direct' AND direct_key IS NOT NULL
    GROUP BY direct_key
    HAVING COUNT(*) > 1
  LOOP
    -- Null out direct_key on empty duplicates (safe: they become orphans the
    -- unique index ignores; no messages are lost)
    UPDATE chat_channels
    SET direct_key = NULL
    WHERE id = ANY (dup.ids[2:])
      AND NOT EXISTS (SELECT 1 FROM chat_messages WHERE channel_id = chat_channels.id);

    -- If a duplicate DOES have messages, keep only the first keyed; unkey the rest
    UPDATE chat_channels
    SET direct_key = NULL
    WHERE id = ANY (dup.ids[2:]) AND direct_key IS NOT NULL;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_direct_key_uniq
  ON chat_channels (direct_key)
  WHERE type = 'direct' AND direct_key IS NOT NULL;

-- Race-safe find-or-create
DROP FUNCTION IF EXISTS public.find_or_create_direct_chat(UUID, UUID);
DROP FUNCTION IF EXISTS public.find_or_create_direct_chat(UUID);

CREATE OR REPLACE FUNCTION public.find_or_create_direct_chat(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user UUID;
  v_channel_id UUID;
  v_key TEXT;
BEGIN
  v_current_user := auth.uid();

  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_current_user = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot create a direct chat with yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_other_user_id) THEN
    RAISE EXCEPTION 'Recipient user does not exist';
  END IF;

  v_key := LEAST(v_current_user::text, p_other_user_id::text)
           || ':' ||
           GREATEST(v_current_user::text, p_other_user_id::text);

  -- Fast path: deterministic key lookup
  SELECT id INTO v_channel_id
  FROM chat_channels
  WHERE type = 'direct' AND direct_key = v_key
  LIMIT 1;

  IF v_channel_id IS NOT NULL THEN
    -- Heal missing membership rows if a previous creation was interrupted
    INSERT INTO chat_channel_members (channel_id, user_id)
    VALUES (v_channel_id, v_current_user), (v_channel_id, p_other_user_id)
    ON CONFLICT (channel_id, user_id) DO NOTHING;
    RETURN v_channel_id;
  END IF;

  -- Legacy path: pre-026 direct channels without a key
  SELECT ccm1.channel_id INTO v_channel_id
  FROM chat_channel_members ccm1
  JOIN chat_channel_members ccm2 ON ccm1.channel_id = ccm2.channel_id
  JOIN chat_channels cc ON cc.id = ccm1.channel_id
  WHERE ccm1.user_id = v_current_user
    AND ccm2.user_id = p_other_user_id
    AND cc.type = 'direct'
    AND (SELECT COUNT(*) FROM chat_channel_members WHERE channel_id = ccm1.channel_id) = 2
  LIMIT 1;

  IF v_channel_id IS NOT NULL THEN
    UPDATE chat_channels SET direct_key = v_key
    WHERE id = v_channel_id AND direct_key IS NULL;
    RETURN v_channel_id;
  END IF;

  -- Create: the unique index makes this race-safe
  BEGIN
    INSERT INTO chat_channels (name, type, created_by, direct_key)
    VALUES (NULL, 'direct', v_current_user, v_key)
    RETURNING id INTO v_channel_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_channel_id
    FROM chat_channels
    WHERE type = 'direct' AND direct_key = v_key;
  END;

  INSERT INTO chat_channel_members (channel_id, user_id)
  VALUES (v_channel_id, v_current_user), (v_channel_id, p_other_user_id)
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN v_channel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_direct_chat(UUID) TO authenticated;

DO $$ BEGIN RAISE NOTICE 'find_or_create_direct_chat recreated with direct_key'; END $$;

-- =============================================================================
-- SECTION 8: journal_entries — legacy NOT NULL columns without defaults
-- The live table requires BOTH entry_date and date, plus total_debit and
-- total_credit, none of which had defaults; header inserts failed with 23502.
-- The app now sends real values; these defaults protect legacy call sites.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'date'
  ) THEN
    ALTER TABLE journal_entries ALTER COLUMN date SET DEFAULT CURRENT_DATE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'total_debit'
  ) THEN
    ALTER TABLE journal_entries ALTER COLUMN total_debit SET DEFAULT 0;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'total_credit'
  ) THEN
    ALTER TABLE journal_entries ALTER COLUMN total_credit SET DEFAULT 0;
  END IF;
END $$;

-- Keep date in sync with entry_date when callers only provide entry_date
CREATE OR REPLACE FUNCTION public.sync_journal_entry_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.date IS NULL AND NEW.entry_date IS NOT NULL THEN
    NEW.date := NEW.entry_date;
  END IF;
  IF NEW.entry_date IS NULL AND NEW.date IS NOT NULL THEN
    NEW.entry_date := NEW.date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_journal_entry_date ON journal_entries;
CREATE TRIGGER trg_sync_journal_entry_date
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_journal_entry_date();

-- =============================================================================
-- SECTION 9: vehicles — columns used by the vehicle/trailer form, and a
-- status CHECK that accepts both legacy and current app vocabularies.
-- Existing rows keep their values ('active' remains valid).
-- =============================================================================

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registration_expiry DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS next_maintenance_due DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS next_inspection_due DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS trailer_sub_type TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS service_interval_km INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_expiry TIMESTAMP WITH TIME ZONE;

-- Drop whatever status CHECK constraint history left behind, then recreate a
-- single permissive one covering every vocabulary the app has ever written.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.vehicles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.vehicles DROP CONSTRAINT %I', con.conname);
    RAISE NOTICE 'Dropped vehicles constraint %', con.conname;
  END LOOP;
END $$;

ALTER TABLE vehicles ADD CONSTRAINT vehicles_status_check CHECK (
  status IN (
    'available', 'in_use', 'maintenance', 'out_of_service',
    'active', 'sold', 'decommissioned'
  )
);

-- =============================================================================
-- SECTION 10: Realtime publication membership (idempotent)
-- =============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chat_messages', 'chat_channels', 'chat_channel_members', 'chat_reactions',
    'chat_typing', 'call_sessions', 'call_signaling', 'user_profiles',
    'driver_locations'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

-- =============================================================================
-- SECTION 11: Reload PostgREST schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN RAISE NOTICE 'Migration 026 complete — %', NOW(); END $$;

-- =============================================================================
-- Verification queries (run manually after the migration):
--
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename LIKE 'chat%' ORDER BY 1,2;
-- SELECT direct_key, COUNT(*) FROM chat_channels WHERE type='direct'
--   GROUP BY 1 HAVING COUNT(*) > 1;  -- must return 0 rows
-- SELECT column_default FROM information_schema.columns
--   WHERE table_name='journal_entries' AND column_name IN ('date','total_debit');
-- =============================================================================
