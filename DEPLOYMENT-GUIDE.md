# 🚀 Fleet Management System - Deployment Guide

## 📋 Prerequisites

1. **Supabase Project**
   - Create a new project at [supabase.com](https://supabase.com)
   - Get your Project URL and Anon Key from Settings > API

2. **Environment Setup**
   - Copy your Supabase credentials to `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## 🗃️ Database Setup

### Option 1: Use Complete Setup SQL
1. Go to Supabase Dashboard > SQL Editor
2. Copy and run the contents of `complete-existing-setup.sql`
3. This will create all tables and insert sample data

### Option 2: Use Quick Setup
1. Run `quick-setup.sql` for minimal tables
2. Then run `ready-to-copy.sql` for sample data

## 🔐 Authentication Setup

1. Go to Supabase Dashboard > Authentication > Settings
2. Enable email/password authentication
3. Add admin user:
   - Email: `stratonflorentin@gmail.com`
   - Password: `Tony@5002`

## 🚀 Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Application
```bash
npm run build
```

### 3. Start Production Server
```bash
npm start
```

## 🌐 Access Your System

- **Local**: http://localhost:3000
- **Login**: stratonflorentin@gmail.com / Tony@5002
- **Default Role**: CEO (can switch to any role)

## 🎯 Features Available

- ✅ **Fleet Management** - Add/edit vehicles
- ✅ **Trip Dispatch** - Create and track trips
- ✅ **Driver Management** - Assign drivers to trips
- ✅ **Maintenance** - Track service requests
- ✅ **Financial** - Expense tracking and reports
- ✅ **Real-time Updates** - Live status tracking
- ✅ **Role-based Access** - 6 different user roles
- ✅ **Mobile Responsive** - Works on all devices

## 🔧 Configuration Options

### Environment Variables
```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional (for production)
NODE_ENV=production
```

### Database Tables Created
- `vehicles` - Fleet vehicles
- `trips` - Trip management
- `users` - User management
- `expenses` - Financial tracking
- `maintenance_requests` - Service requests
- `parts_requests` - Spare parts
- `reports` - System reports
- `allowances` - Driver allowances

## 🛠️ Troubleshooting

### Demo Mode Still Active?
- Check that `.env.local` has real Supabase URL
- Restart development server after changing env vars

### Database Connection Issues?
- Verify Supabase URL and keys are correct
- Check Supabase project status
- Ensure RLS policies are set correctly

### Authentication Problems?
- Check email auth is enabled in Supabase
- Verify admin user exists in auth.users table
- Check password requirements

## 📞 Support

For deployment issues:
1. Check this guide first
2. Review Supabase dashboard logs
3. Verify environment variables
4. Test database connection in SQL Editor

---

**Ready to deploy! 🎉**
