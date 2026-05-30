# Rate Sheet Setup Instructions

## Overview
The rate sheet system is now fully editable through the admin dashboard. All transport routes and pricing can be managed without code changes.

## Files Created/Updated

### New Files:
1. **`src/lib/rate-sheet-service.ts`** - Database service for rate CRUD operations
2. **`src/components/rate-sheet-manager.tsx`** - UI component for managing rates
3. **`src/app/admin/settings/page.tsx`** - Admin settings page
4. **`rate_sheets_setup.sql`** - Database migration script

### Updated Files:
- **`src/app/sales/transport-agreement-generator.tsx`** - Now fetches rates from database

## Setup Steps

### 1. Create the Database Table
Run the SQL migration in your Supabase SQL editor:

```sql
-- Execute the contents of rate_sheets_setup.sql
-- This creates the rate_sheets table with default routes
```

Or copy and paste the contents of `rate_sheets_setup.sql` directly into your Supabase SQL editor.

### 2. Access the Rate Manager
After deployment:
1. Navigate to `/admin/settings` in your application
2. You'll see "Manage Transport Routes & Rates" section
3. Only admins/managers/CEOs can access this page

### 3. Managing Routes

#### Add a New Route:
- Click "Add Route"
- Fill in:
  - Route Name (e.g., "NAIROBI - KENYA")
  - Destination
  - Origin (defaults to "DAR PORT")
  - Pricing for 20ft, 40ft, and loose cargo
  - Transit days
  - Truck type
  - Currency
- Click "Create Route"

#### Edit a Route:
- Click the edit icon (pencil) on any route
- Update the fields
- Click "Update Route"

#### Delete a Route:
- Click the delete icon (trash) on any route
- Confirm deletion

### 4. Default Routes
The system comes pre-populated with 12 regional routes:
- KIGALI - RWANDA: $3,100
- LUSAKA - ZAMBIA: $4,000
- SOLWEZI - ZAMBIA: $4,800
- BUJUMBURA - BURUNDI: $3,200
- LILONGWE - MALAWI: $4,000
- BLANTYRE - MALAWI: $4,400
- KITWE - ZAMBIA: $4,000-$4,400
- GOMA - DRC: $4,400
- BUKAVU - DRC: $4,800
- LUBUMBASHI - DRC: $6,400
- KOLWEZI - DRC: $7,200
- LIKASI - DRC: $8,500

All prices are in USD and can be updated as needed.

### 5. Real-time Updates
When you create or update a rate:
- The changes are immediately stored in Supabase
- Contract generation automatically uses the latest rates
- No need to restart the application
- The RateSheetPreview component refreshes on page load

### 6. Integration with Contract Generation
The TransportAgreementGenerator automatically:
1. Fetches all active routes from the database
2. Populates the destination dropdown with available routes
3. Includes pricing details in generated contracts
4. Shows "Manage Rates" link for quick navigation to settings

## Database Schema

```sql
CREATE TABLE rate_sheets (
  id UUID PRIMARY KEY,
  route_name VARCHAR(255) NOT NULL UNIQUE,
  origin VARCHAR(255) DEFAULT 'DAR PORT',
  destination VARCHAR(255) NOT NULL,
  container_20ft DECIMAL(10, 2),
  container_40ft DECIMAL(10, 2),
  loose_cargo DECIMAL(10, 2),
  truck_type VARCHAR(50) DEFAULT 'C28',
  transit_days INTEGER DEFAULT 3,
  currency VARCHAR(10) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Security
- RLS (Row Level Security) enabled
- Public can read active routes
- Only authenticated users can modify
- Consider adding role-based restrictions for additional security

## Troubleshooting

**Routes not showing in contract generator:**
- Ensure database migration was run
- Check that routes have `is_active = true`
- Verify admin user has correct permissions

**Changes not appearing:**
- Refresh the page to reload from database
- Check Supabase connection

**Admin page access denied:**
- Verify user has admin/manager/CEO role
- Update user role in your authentication system

## Next Steps
1. Run the SQL migration in Supabase
2. Deploy to Vercel
3. Navigate to /admin/settings to manage rates
4. Create contracts with the new system
