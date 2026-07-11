# PostgreSQL 42P17 Fix - Application Instructions

## Confirmed Error

**PostgreSQL Error Code:** 42P17  
**Error Message:** "infinite recursion detected in policy for relation chat_channel_members"  
**HTTP Status:** 500 Internal Server Error

**Affected Tables:**
- `chat_channel_members` - HTTP 500 on SELECT
- `chat_reactions` - HTTP 500 on SELECT (dependency on chat_channel_members)

## Root Cause

RLS policies on `chat_channel_members` were querying the same table, causing infinite recursion:

```
chat_channel_members policy
-> SELECT FROM chat_channel_members
-> RLS policy triggers again
-> infinite recursion
```

## Solution Applied

**Migration File:** `supabase/migrations/020_fix_42p17_recursive_rls.sql`

**What it does:**
1. **Audits existing policies** - Logs all current policies before changes
2. **Removes all recursive policies** - Drops all policies causing recursion
3. **Creates safe helper function** - `is_chat_channel_member()` with SECURITY DEFINER to bypass RLS
4. **Rebuilds all policies** - Non-recursive policies using the safe helper
5. **Fixes chat_reactions** - Uses helper to avoid recursion through chat_messages
6. **Fixes chat_messages** - Uses helper for all membership checks
7. **Fixes chat_channels** - Uses helper for membership checks

**Additional Fix in Migration 017:**
- Updated `find_or_create_direct_chat()` to be fully atomic
- Added auth.users validation
- Added savepoint for transaction safety
- Verifies both memberships are created before returning

## Application Steps

### Step 1: Open Supabase SQL Editor

1. Navigate to https://supabase.com/dashboard
2. Sign in if required
3. Select project: `qaqonhjeqtlatqsrqcnx`
4. Click "SQL Editor" in the left sidebar
5. Click "New Query"

### Step 2: Apply Migration 020

1. Open file: `supabase/migrations/020_fix_42p17_recursive_rls.sql`
2. Copy all content
3. Paste into SQL Editor
4. Click "Run"
5. Wait for completion
6. **Check the output** - You should see:
   - "=== AUDITING EXISTING CHAT POLICIES ==="
   - List of existing policies
   - "=== END AUDIT ==="
   - "Helper function verification complete"
   - No error messages

### Step 3: Verify Migration Applied

Run this query in SQL Editor to verify:

```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'chat_channels',
    'chat_channel_members',
    'chat_messages',
    'chat_reactions'
)
ORDER BY tablename, policyname;
```

**Expected policies:**
- `chat_channel_members_select`
- `chat_channel_members_insert`
- `chat_channel_members_update`
- `chat_channel_members_delete`
- `chat_channels_select`
- `chat_channels_insert`
- `chat_channels_update`
- `chat_channels_delete`
- `chat_messages_select`
- `chat_messages_insert`
- `chat_messages_update`
- `chat_messages_delete`
- `chat_reactions_select`
- `chat_reactions_insert`
- `chat_reactions_update`
- `chat_reactions_delete`

### Step 4: Verify Helper Function

Run this query:

```sql
SELECT 
    proname,
    prosecdef,
    proconfig
FROM pg_proc
WHERE proname = 'is_chat_channel_member';
```

**Expected:**
- `prosecdef` = `t` (true) - indicates SECURITY DEFINER
- No errors

### Step 5: Test with Application

1. Refresh the application (hard refresh: Ctrl+Shift+R)
2. Open Internal Chat
3. Check browser console

**Expected Results:**
- ✅ No HTTP 500 errors on `chat_channel_members`
- ✅ No HTTP 500 errors on `chat_reactions`
- ✅ No 42P17 errors
- ✅ "Unable to load conversations" should be gone
- ✅ Conversations should load

### Step 6: Test Direct Chat Creation

1. Click "New" button
2. Select a colleague
3. Wait for conversation to open

**Expected Results:**
- ✅ Channel is created
- ✅ Both membership rows exist
- ✅ Channel is immediately readable
- ✅ No "Channel not found after creation"
- ✅ No PGRST116 errors

### Step 7: Test Messaging

1. Send a message in the direct chat
2. Verify message appears

**Expected Results:**
- ✅ Message sends successfully
- ✅ No errors in console

## Troubleshooting

### If Migration Fails

**Error: "policy does not exist"**
- This is expected - the migration uses `DROP POLICY IF EXISTS`
- Continue with the migration

**Error: "function does not exist"**
- This is expected - the migration uses `DROP FUNCTION IF EXISTS`
- Continue with the migration

**Error: Other SQL error**
- Check the exact error message
- Verify you're using the correct project: `qaqonhjeqtlatqsrqcnx`
- Ensure you have sufficient permissions

### If Errors Persist After Migration

**Still seeing HTTP 500:**
- Clear browser cache
- Hard refresh the application
- Check browser console for new errors
- Verify the migration actually ran (check pg_policies)

**Still seeing 42P17:**
- Verify migration 020 was applied
- Check if any other policies exist that weren't dropped
- Run the audit query again to see current policies

**Channel creation still fails:**
- Verify migration 017 was also applied (contains the atomic RPC)
- Check Supabase logs for PostgreSQL errors
- Verify both users exist in auth.users

## Verification Checklist

After applying migration 020:

- [ ] Migration ran without errors
- [ ] Audit output shows existing policies were logged
- [ ] Helper function verification complete message appears
- [ ] pg_policies shows 16 policies (4 per table)
- [ ] Helper function has prosecdef = t
- [ ] Application loads without HTTP 500 on chat_channel_members
- [ ] Application loads without HTTP 500 on chat_reactions
- [ ] No 42P17 errors in console
- [ ] Direct chat creation works
- [ ] Messaging works

## Additional Required Migrations

After migration 020, also apply:

**Migration 019:** `supabase/migrations/019_add_user_profiles_rls.sql`
- Fixes "No colleagues found" error
- Enables RLS on user_profiles

**Migration 018:** `supabase/migrations/018_add_voice_video_calling.sql`
- Adds voice/video calling tables
- Adds calling RPC functions

## Final Report Required

After applying migrations and testing, provide:

1. **Exact recursive policy name found** (from audit output)
2. **Exact recursive policy condition** (from audit output)
3. **Policies dropped** (count from audit)
4. **Helper function created** (verification query result)
5. **New policies created** (count from pg_policies)
6. **chat_reactions root cause** (dependency on recursive policy)
7. **Channel creation root cause** (partial creation due to RLS failure)
8. **RPC status** (atomic with savepoint)
9. **Migration filename applied** (020_fix_42p17_recursive_rls.sql)
10. **Confirmation migration was applied** (audit output)
11. **HTTP result for chat_channel_members** (should be 200)
12. **HTTP result for chat_reactions** (should be 200)
13. **Two-user chat test result** (success/failure)

## Contact

If you encounter issues that cannot be resolved with this guide:
- Check Supabase Dashboard logs
- Check browser console errors
- Check network tab for failed requests
- Verify project: `qaqonhjeqtlatqsrqcnx`
