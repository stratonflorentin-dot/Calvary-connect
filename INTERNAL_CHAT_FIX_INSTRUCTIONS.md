# Internal Chat Fix Instructions

## Summary of Issues Found

The Internal Chat was not working because:
1. **RLS Recursion Error:** `chat_channel_members` had recursive RLS policies causing "Unable to load conversations"
2. **Foreign Key Error:** `chat_channel_members.user_id` referenced non-existent `users(id)` instead of `auth.users(id)`
3. **Missing RLS:** `user_profiles` table had no RLS policies, preventing colleague discovery ("No colleagues found")
4. **Missing Call Tables:** Voice/video calling tables were not created in the database

## Migrations to Apply

You must apply these 3 migrations in order in the Supabase SQL Editor:

### Step 1: Go to Supabase SQL Editor
1. Navigate to https://supabase.com/dashboard
2. Select project: `qaqonhjeqtlatqsrqcnx`
3. Go to SQL Editor

### Step 2: Apply Migration 017 (Fix Chat Identity Architecture)
Copy the contents of: `d:\fleet management\supabase\migrations\017_fix_chat_identity_architecture.sql`

This migration:
- Fixes foreign key reference to `auth.users(id)`
- Creates `is_chat_channel_member()` helper function to prevent RLS recursion
- Updates RLS policies for `chat_channels`, `chat_channel_members`, `chat_messages`
- Creates `find_or_create_direct_chat()` function

### Step 3: Apply Migration 018 (Add Voice/Video Calling)
Copy the contents of: `d:\fleet management\supabase\migrations\018_add_voice_video_calling.sql`

This migration:
- Creates `call_sessions` table for call state management
- Creates `call_signaling` table for WebRTC signaling
- Adds RLS policies for call tables using `is_call_participant()` helper
- Creates RPC functions: `initiate_call`, `answer_call`, `decline_call`, `end_call`
- Adds `call_id` and `message_type` columns to `chat_messages`
- Enables Supabase Realtime for signaling

### Step 4: Apply Migration 019 (Add user_profiles RLS)
Copy the contents of: `d:\fleet management\supabase\migrations\019_add_user_profiles_rls.sql`

This migration:
- Enables RLS on `user_profiles`
- Creates SELECT policy allowing authenticated users to view all profiles
- Creates UPDATE policy allowing users to update their own profile

## What Will Work After Applying Migrations

1. **"Unable to load conversations"** - Will be resolved (RLS recursion fixed)
2. **"No colleagues found"** - Will be resolved (user_profiles RLS added)
3. **Direct messaging** - Will work (foreign key fixed)
4. **Phone icon in chat header** - Will appear (already implemented in code)
5. **Video icon in chat header** - Will appear (already implemented in code)
6. **Voice calling** - Will work (call tables and RPC functions created)
7. **Video calling** - Will work (call tables and RPC functions created)

## Implementation Status

### ✅ Completed
- [x] Identified actual Internal Chat route: `/chat` → `src/app/chat/page.tsx`
- [x] Found runtime error: RLS recursion on `chat_channel_members`
- [x] Fixed migration 017 SQL error (removed backfill to non-existent `users` table)
- [x] Created migration 019 for `user_profiles` RLS
- [x] Verified call buttons are connected in chat component (lines 1178-1199)
- [x] Build successful with no errors

### ⏳ Pending (User Action Required)
- [ ] Apply migration 017 to Supabase SQL Editor
- [ ] Apply migration 018 to Supabase SQL Editor
- [ ] Apply migration 019 to Supabase SQL Editor
- [ ] Test with two authenticated user sessions

## Code Changes Made

### Files Modified
1. `supabase/migrations/017_fix_chat_identity_architecture.sql` - Fixed SQL error
2. `supabase/migrations/019_add_user_profiles_rls.sql` - New file for user_profiles RLS

### Files Previously Modified (from earlier session)
1. `src/lib/webrtc.ts` - WebRTC utility class
2. `src/components/chat/incoming-call-modal.tsx` - Incoming call UI
3. `src/components/chat/active-call-ui.tsx` - Active call UI
4. `src/app/chat/page.tsx` - Call buttons, management functions, Realtime subscriptions
5. `supabase/migrations/018_add_voice_video_calling.sql` - Call tables and functions

## Testing Checklist

After applying migrations, test with two separate browser sessions:

**Session A:** Straton / Admin
**Session B:** Accountant or HR user

1. [ ] Open Internal Chat
2. [ ] Confirm "Unable to load conversations" is gone
3. [ ] Click "New" button
4. [ ] Confirm real colleagues appear (not "No colleagues found")
5. [ ] Select a colleague
6. [ ] Confirm direct conversation opens
7. [ ] Send a message
8. [ ] Confirm recipient receives it
9. [ ] Confirm Phone icon is visible in chat header
10. [ ] Confirm Video icon is visible in chat header
11. [ ] Start voice call
12. [ ] Confirm incoming call appears for recipient
13. [ ] Accept call
14. [ ] Confirm audio connection
15. [ ] End call
16. [ ] Start video call
17. [ ] Confirm camera and microphone permission flow
18. [ ] Accept video call
19. [ ] Confirm local and remote video
20. [ ] End call
21. [ ] Refresh both sessions
22. [ ] Confirm conversation history remains

## Git Commits

- `ffbc33e` - Fix migration SQL error
- `341fc97` - Add user_profiles RLS
- `14391df` - Add Voice and Video Calling to Internal Chat (from earlier session)

All commits pushed to GitHub.
