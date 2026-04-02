# Supabase Production Setup Guide

This guide ensures FleetCommand is fully connected to Supabase for official use.

## 1. Environment Variables

Create `.env.local` file in the root of your project:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these from your Supabase dashboard:
- Go to Project Settings → API
- Copy `URL` and `anon public` key

## 2. Required Database Tables

Run these SQL statements in Supabase SQL Editor:

```sql
-- Users table (for user profiles and invite-only system)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'DRIVER',
    phone TEXT,
    avatar TEXT,
    employee_id TEXT,
    department TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- User profiles table (for extended profile data)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'DRIVER',
    phone TEXT,
    avatar_url TEXT,
    employee_id TEXT,
    department TEXT,
    password TEXT, -- For localStorage fallback only
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number TEXT NOT NULL,
    model TEXT,
    type TEXT,
    status TEXT DEFAULT 'available',
    driver_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID,
    start_location TEXT,
    end_location TEXT,
    status TEXT DEFAULT 'pending',
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    participants UUID[] DEFAULT '{}',
    created_by UUID,
    status TEXT DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    severity TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL(10,2) NOT NULL,
    category TEXT,
    description TEXT,
    submitted_by UUID,
    status TEXT DEFAULT 'pending',
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fuel approvals table
CREATE TABLE IF NOT EXISTS fuel_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID,
    driver_id UUID,
    amount DECIMAL(10,2) NOT NULL,
    liters DECIMAL(8,2),
    status TEXT DEFAULT 'pending',
    approved_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service requests table
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID,
    mechanic_id UUID,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spare parts inventory table
CREATE TABLE IF NOT EXISTS spare_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    quantity INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 5,
    price DECIMAL(10,2),
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parts requests table
CREATE TABLE IF NOT EXISTS parts_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID REFERENCES spare_parts(id),
    mechanic_id UUID,
    quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    approved_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 3. Storage Buckets

Create these storage buckets in Supabase Storage:

1. **avatars** - For user profile photos
   - Public bucket
   - Allowed file types: jpg, jpeg, png, webp
   - Max file size: 2MB

2. **receipts** - For expense receipts
   - Private bucket
   - Allowed file types: jpg, jpeg, png, pdf
   - Max file size: 5MB

3. **proof** - For driver proof photos
   - Private bucket
   - Allowed file types: jpg, jpeg, png
   - Max file size: 5MB

4. **profile-photos** - For user profile photos (alternative)
   - Public bucket
   - Allowed file types: jpg, jpeg, png, webp
   - Max file size: 2MB

## 4. Authentication Settings

In Supabase Auth settings:

1. **Site URL**: Set to your production domain (e.g., `https://yourapp.com`)
2. **Redirect URLs**: Add your app URLs
3. **Email Templates**: Customize confirmation emails
4. **Providers**: Enable Email provider (disable others for security)

## 5. Row Level Security (RLS) Policies

Add these RLS policies for production security:

```sql
-- Users table policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin can view all users" ON users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'CEO'))
    );

CREATE POLICY "Admin can update all users" ON users
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'CEO', 'HR'))
    );

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Admin can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id::text = auth.uid()::text AND role IN ('ADMIN', 'CEO'))
    );

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Admin can update all profiles" ON user_profiles
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id::text = auth.uid()::text AND role IN ('ADMIN', 'CEO', 'HR'))
    );

CREATE POLICY "Admin can insert profiles" ON user_profiles
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM user_profiles WHERE id::text = auth.uid()::text AND role IN ('ADMIN', 'CEO', 'HR'))
    );

CREATE POLICY "Admin can delete profiles" ON user_profiles
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id::text = auth.uid()::text AND role IN ('ADMIN', 'CEO'))
    );

-- Vehicles policies
CREATE POLICY "All authenticated can view vehicles" ON vehicles
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage vehicles" ON vehicles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id::text = auth.uid()::text AND role IN ('ADMIN', 'CEO', 'OPERATOR'))
    );

-- Trips policies
CREATE POLICY "Users can view own trips" ON trips
    FOR SELECT USING (driver_id::text = auth.uid()::text);

CREATE POLICY "Admin can view all trips" ON trips
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id::text = auth.uid()::text AND role IN ('ADMIN', 'CEO', 'OPERATOR'))
    );

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id::text = auth.uid()::text);
```

## 6. Functions and Triggers

Create this function for updated_at timestamps:

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_requests_updated_at BEFORE UPDATE ON service_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spare_parts_updated_at BEFORE UPDATE ON spare_parts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parts_requests_updated_at BEFORE UPDATE ON parts_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 7. Admin User Setup

After connecting to Supabase, create the admin user:

1. Go to Supabase Auth → Users
2. Invite user with email: `stratonflorentin@gmail.com`
3. Set the role to `ADMIN` in the user_profiles table:

```sql
INSERT INTO user_profiles (id, email, name, role, status)
VALUES (
    'admin-straton',
    'stratonflorentin@gmail.com',
    'Straton Florentin Tesha',
    'ADMIN',
    'active'
);
```

## 8. Verification Checklist

After setup, verify everything works:

- [ ] Environment variables are set in `.env.local`
- [ ] All tables exist in Supabase
- [ ] Storage buckets are created
- [ ] RLS policies are active
- [ ] Admin user exists in database
- [ ] Sign up works with invite-only system
- [ ] Sign in works for existing users
- [ ] File uploads work (avatars, receipts)
- [ ] Role-based access control works
- [ ] Admin can invite users

## 9. Deployment

1. Set environment variables in your hosting platform
2. Build the app: `npm run build`
3. Deploy to production
4. Test all features

## 10. Troubleshooting

If data doesn't appear:
- Check browser console for Supabase errors
- Verify RLS policies allow the operation
- Check that tables have the correct columns
- Ensure storage buckets have correct permissions

For localStorage fallback (development only):
- The app falls back to localStorage if Supabase fails
- This should NOT be used in production
- Remove localStorage fallbacks for production use
