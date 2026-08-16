-- Fix PostgreSQL 42P17: Infinite Recursion in RLS Policies (meetings)
-- Root cause: the "meetings" SELECT policy subqueries meeting_attendees, and
-- the meeting_attendees policy subqueries meetings back — evaluating either
-- table's RLS re-triggers the other's, looping until Postgres aborts with
-- "infinite recursion detected in policy for relation \"meetings\"".
-- Same class of bug, same fix pattern, as 020_fix_42p17_recursive_rls.sql
-- (chat tables) — a SECURITY DEFINER helper breaks the cycle by reading the
-- other table without going through its RLS.

-- ============================================================================
-- STEP 1: DROP THE RECURSIVE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view meetings they are attendees of" ON meetings;
DROP POLICY IF EXISTS "Admins create and manage meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view and update their own attendance" ON meeting_attendees;

-- ============================================================================
-- STEP 2: NON-RECURSIVE HELPER FUNCTIONS
-- ============================================================================
-- CREATE OR REPLACE updates the function body in place and preserves its
-- identity, so anything that comes to depend on it later (a future policy,
-- the way chat_typing_select ended up depending on is_chat_channel_member)
-- keeps working if this migration is ever re-run. A preceding DROP FUNCTION
-- would instead fail with "cannot drop function ... because other objects
-- depend on it" the moment such a dependent exists — exactly what happened
-- re-running 020_fix_42p17_recursive_rls.sql after 022_production_chat_and_calls.sql
-- added chat_typing on top of it.

CREATE OR REPLACE FUNCTION public.is_meeting_attendee(
    p_meeting_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.meeting_attendees ma
        WHERE ma.meeting_id = p_meeting_id
        AND ma.user_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_meeting_creator(
    p_meeting_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.meetings m
        WHERE m.id = p_meeting_id
        AND m.created_by = p_user_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_meeting_attendee(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_meeting_attendee(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.is_meeting_creator(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_meeting_creator(UUID, UUID) TO anon;

-- ============================================================================
-- STEP 3: SAFE meetings POLICIES
-- ============================================================================

CREATE POLICY "Users can view meetings they are attendees of" ON meetings
  FOR SELECT USING (
    created_by = auth.uid()
    OR public.is_meeting_attendee(id, auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('ADMIN','CEO','HR'))
  );

CREATE POLICY "Admins create and manage meetings" ON meetings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('ADMIN','CEO','HR'))
  );

-- ============================================================================
-- STEP 4: SAFE meeting_attendees POLICY
-- ============================================================================

CREATE POLICY "Users can view and update their own attendance" ON meeting_attendees
  FOR ALL USING (
    auth.uid() = user_id
    OR public.is_meeting_creator(meeting_id, auth.uid())
  );

-- ============================================================================
-- STEP 5: VERIFY
-- ============================================================================

DO $$
DECLARE
    v_test_result BOOLEAN;
BEGIN
    SELECT public.is_meeting_attendee(NULL::UUID, NULL::UUID) INTO v_test_result;
    RAISE NOTICE 'is_meeting_attendee NULL test: %', v_test_result;

    SELECT public.is_meeting_creator(NULL::UUID, NULL::UUID) INTO v_test_result;
    RAISE NOTICE 'is_meeting_creator NULL test: %', v_test_result;
END $$;

NOTIFY pgrst, 'reload schema';
