# Supabase Migration Application Guide

## Current Status

### Code Fixes Applied ✅
- **PGRST116 Error:** Changed `.single()` to `.maybeSingle()` in chat queries
- **Request Loop:** Added stale channel detection and clearing
- **Direct Chat:** Added transaction safety and validation to RPC function
- **CSP:** Added font-src, style-src, frame-src directives
- **Service Worker:** Added error handling for failed fetches
- **Build:** Successful with no errors
- **Commit:** `f41bda9`

### Remaining: Apply Database Migrations ⏳

The following migrations must be applied to fix the HTTP 500 errors:

## Migration 1: Fix Chat Identity Architecture (017)

**File:** `supabase/migrations/017_fix_chat_identity_architecture.sql`

**What it fixes:**
- HTTP 500 on `chat_channel_members` (RLS recursion)
- HTTP 500 on `chat_reactions` (RLS recursion)
- Foreign key reference from `users(id)` to `auth.users(id)`
- Creates `is_chat_channel_member()` helper function
- Updates RLS policies for chat tables
- Creates `find_or_create_direct_chat()` RPC with transaction safety

**Apply in Supabase SQL Editor:**
1. Copy the entire contents of the file
2. Paste into SQL Editor
3. Run the query
4. Verify no errors

## Migration 2: Add Voice/Video Calling (018)

**File:** `supabase/migrations/018_add_voice_video_calling.sql`

**What it adds:**
- `call_sessions` table for call state management
- `call_signaling` table for WebRTC signaling
- RLS policies using `is_call_participant()` helper
- RPC functions: `initiate_call`, `answer_call`, `decline_call`, `end_call`
- Adds `call_id` and `message_type` to `chat_messages`
- Enables Supabase Realtime for signaling

**Apply in Supabase SQL Editor:**
1. Copy the entire contents of the file
2. Paste into SQL Editor
3. Run the query
4. Verify no errors

## Migration 3: Add User Profiles RLS (019)

**File:** `supabase/migrations/019_add_user_profiles_rls.sql`

**What it fixes:**
- "No colleagues found" error
- Enables RLS on `user_profiles` table
- Creates SELECT policy for authenticated users
- Creates UPDATE policy for own profile

**Apply in Supabase SQL Editor:**
1. Copy the entire contents of the file
2. Paste into SQL Editor
3. Run the query
4. Verify no errors

## Step-by-Step Instructions

1. **Open Supabase Dashboard:**
   - Navigate to https://supabase.com/dashboard
   - Sign in if required

2. **Select Project:**
   - Choose project: `qaqonhjeqtlatqsrqcnx`

3. **Open SQL Editor:**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

4. **Apply Migration 017:**
   - Open `supabase/migrations/017_fix_chat_identity_architecture.sql`
   - Copy all content
   - Paste into SQL Editor
   - Click "Run"
   - Wait for completion
   - Verify success message

5. **Apply Migration 018:**
   - Click "New Query"
   - Open `supabase/migrations/018_add_voice_video_calling.sql`
   - Copy all content
   - Paste into SQL Editor
   - Click "Run"
   - Wait for completion
   - Verify success message

6. **Apply Migration 019:**
   - Click "New Query"
   - Open `supabase/migrations/019_add_user_profiles_rls.sql`
   - Copy all content
   - Paste into SQL Editor
   - Click "Run"
   - Wait for completion
   - Verify success message

## Expected Results After Applying Migrations

### Console Errors Fixed:
- ✅ HTTP 500 on `chat_channel_members` → Gone
- ✅ HTTP 500 on `chat_reactions` → Gone
- ✅ HTTP 406 PGRST116 → Gone
- ✅ "Unable to load conversations" → Gone
- ✅ "No colleagues found" → Gone

### Features Working:
- ✅ Internal Chat loads conversations
- ✅ New Chat shows active colleagues
- ✅ Direct messaging works
- ✅ Phone icon appears in chat header
- ✅ Video icon appears in chat header
- ✅ Voice calling functional
- ✅ Video calling functional

### CSP Errors Fixed:
- ✅ Google Fonts load without CSP violation
- ✅ Visme embed loads without CSP violation (if used)
- ✅ vercel.live iframe loads without CSP violation

### Service Worker Fixed:
- ✅ No unhandled "Failed to fetch" errors
- ✅ External font failures handled gracefully

## Verification Steps

After applying migrations:

1. **Refresh the application** (hard refresh: Ctrl+Shift+R)
2. **Open Internal Chat**
3. **Verify:**
   - No "Unable to load conversations" error
   - Console shows no HTTP 500 errors
   - Console shows no PGRST116 errors
   - No CSP font errors
4. **Click "New" button**
5. **Verify:**
   - Active colleagues appear
   - Current user is excluded
6. **Select a colleague**
7. **Verify:**
   - Direct conversation opens
   - Phone icon visible
   - Video icon visible
8. **Send a message**
9. **Verify:**
   - Message appears in chat
   - No errors in console

## Troubleshooting

### If Migration Fails:
- Check the error message in SQL Editor
- Verify you're using the correct project: `qaqonhjeqtlatqsrqcnx`
- Ensure you have sufficient permissions
- Try running the migration in smaller sections

### If Errors Persist After Migration:
- Clear browser cache
- Hard refresh the application
- Check browser console for new errors
- Verify the migrations were actually applied (check Table Editor)

### If Chat Still Shows Errors:
- Verify all 3 migrations were applied
- Check Supabase logs for PostgreSQL errors
- Ensure the application is pointing to the correct Supabase project
- Verify environment variables match the project

## Contact

If you encounter issues that cannot be resolved with this guide, check:
- Supabase Dashboard logs
- Browser console errors
- Network tab for failed requests
