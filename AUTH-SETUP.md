# Fleet Management System - Authentication Setup

## Current Status: Demo Mode Enabled ✅

The system is currently running in **demo mode** which bypasses authentication and automatically logs you in as the CEO admin user.

## Access Information

- **Email**: stratonflorentin@gmail.com
- **Role**: CEO (full access to all features)
- **Password**: Not required in demo mode

## Setting Up Real Authentication (Optional)

If you want to use real Supabase authentication instead of demo mode:

### 1. Create Admin User in Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- Insert admin user profile
INSERT INTO user_profiles (id, email, name, role) 
VALUES (
  'admin-user-id', 
  'stratonflorentin@gmail.com', 
  'Admin User', 
  'CEO'
) ON CONFLICT (email) DO NOTHING;
```

### 2. Disable Demo Mode

In `src/lib/supabase.ts`, remove this line:
```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('qaqonhjeqtlatqsrqcnx'); // Temporarily enable demo mode for current project
```

### 3. Sign Up/Sign In

- Visit the application
- Click "Sign Up" with email: `stratonflorentin@gmail.com`
- Create any password
- Or use "Sign In" if you already have an account

## Features Available in Demo Mode

✅ **Full Fleet Management**
- Vehicle assignment to trips
- Trip creation and management
- Vehicle details viewing
- Driver management
- All dashboard features

✅ **No Authentication Required**
- Instant access to all features
- No password needed
- Full CEO permissions

## Troubleshooting

If you see "Access Denied":
1. Refresh the page
2. Clear browser cache
3. Ensure demo mode is enabled (check console for "🚀 Demo Mode" message)

## Production Deployment

For production deployment:
1. Disable demo mode
2. Set up proper authentication
3. Configure RLS policies for security
4. Use environment-specific credentials
