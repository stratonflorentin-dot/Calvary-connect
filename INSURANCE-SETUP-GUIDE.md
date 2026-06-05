# Truck Insurance Management Module - Implementation Guide

## Overview

This module manages fleet insurance policies for your Tanzania-based logistics company with built-in TIRA compliance validation and COMESA cross-border coverage tracking.

### Tech Stack
- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes + Supabase (PostgreSQL)
- **Database:** PostgreSQL tables with RLS policies
- **Authentication:** Supabase Auth (existing)

---

## 📊 Module Architecture

### Database Schema
- **`truck_insurance`** - Main insurance policy records
- **`insurance_claims`** - Claims tracking (optional)
- **Views** - Reporting queries for TIRA compliance, expiring policies, cross-border coverage

### Service Layer
- **`InsuranceService`** - Business logic, CRUD operations, TIRA validation

### API Routes
```
/api/insurance                  # GET all, POST create
/api/insurance/[id]             # GET, PUT update, DELETE
/api/insurance/bulk-import      # POST CSV/JSON bulk import
/api/insurance/expiring         # GET expiring policies (within N days)
/api/insurance/compliance       # GET TIRA & cross-border compliance reports
/api/insurance/summary          # GET dashboard summary
```

### Frontend Pages
```
/hr/insurance                   # Dashboard with KPI summary
/hr/insurance/add               # Add new policy form
/hr/insurance/[id]              # View/edit policy details
/hr/insurance/bulk-import       # CSV bulk import tool
```

---

## 🚀 Setup Instructions

### Step 1: Create Database Tables

**Option A: Using Supabase SQL Editor**
1. Login to your Supabase project
2. Go to SQL Editor → New query
3. Copy entire contents of `insurance-management-migration.sql`
4. Click "Run" to execute all migrations

**Option B: Using SQL file**
- Run the SQL file directly in your PostgreSQL client

```bash
psql -h your-host -U your-user -d your-database < insurance-management-migration.sql
```

### Step 2: Verify Database Tables

After migration, check that these tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('truck_insurance', 'insurance_claims');
```

### Step 3: Update Environment Variables

Ensure your `.env.local` contains:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Step 4: Install Dependencies (if needed)

The module uses existing dependencies. If you need to add CSV parsing:
```bash
npm install papaparse
npm install --save-dev @types/papaparse
```

### Step 5: Build & Deploy

```bash
npm run build
npm run dev  # Test locally
```

---

## 💼 Business Rules Implemented

### 1. **TIRA Compliance (Tanzania)**
- ✅ Every truck must have minimum Third Party coverage
- ✅ Automatic validation endpoint: `/api/insurance/compliance?type=tira`
- ✅ Alerts when non-compliant vehicles detected

### 2. **Expiry Alerts**
- ✅ Policies within 30 days of expiry marked as "expiring_soon"
- ✅ Dashboard highlights expiring policies
- ✅ Endpoint: `/api/insurance/expiring?days=30`

### 3. **Cross-Border Coverage**
- ✅ Flag vehicles operating cross-border routes
- ✅ Require COMESA Yellow Card verification
- ✅ Dashboard shows compliance status
- ✅ Endpoint: `/api/insurance/compliance?type=cross_border`

### 4. **Premium Tracking**
- ✅ All premiums stored in TZS (Tanzanian Shilling)
- ✅ Total annual cost calculated for budget planning
- ✅ Dashboard shows total fleet insurance spend

---

## 📋 Usage Guide

### Add Single Insurance Policy

**Via Frontend:**
1. Navigate to `/hr/insurance`
2. Click "New Policy" button
3. Fill in policy details:
   - Vehicle ID
   - Insurer name
   - Policy type (Third Party, Comprehensive, etc.)
   - TIRA reference number
   - Start/expiry dates
   - Annual premium in TZS
4. Click "Add Policy"

**Via API:**
```bash
curl -X POST http://localhost:3000/api/insurance \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "uuid-here",
    "insurer_name": "Jubilee Insurance",
    "policy_type": "third_party",
    "tira_reference_number": "TZ/2024/123456",
    "start_date": "2024-01-01",
    "expiry_date": "2025-01-01",
    "annual_premium": 500000
  }'
```

### Bulk Import via CSV

**Supported Columns:**
```
vehicle_id                  # UUID of vehicle
insurer_name               # e.g., Jubilee, Alliance, NIC Tanzania
policy_type                # third_party | third_party_cargo | comprehensive | cross_border
tira_reference_number      # e.g., TZ/2024/123456
start_date                 # YYYY-MM-DD
expiry_date                # YYYY-MM-DD
annual_premium             # Amount in TZS
assigned_driver_id         # (Optional) Driver UUID
route_coverage_area        # (Optional) e.g., East Africa
is_cross_border            # (Optional) true/false
has_comesa_yellow_card     # (Optional) true/false
notes                      # (Optional) Any notes
```

**Steps:**
1. Navigate to `/hr/insurance/bulk-import`
2. Download template CSV
3. Fill in your data
4. Upload file
5. Review results

### Dashboard KPIs

Navigate to `/hr/insurance` to view:
- **Active Policies** - Total policies currently valid
- **Expiring Soon** - Policies expiring within 30 days (shows as orange alert)
- **Expired** - Policies that have expired and need renewal
- **Annual Premium** - Total fleet insurance cost in millions TZS
- **TIRA Compliance** - Percentage of trucks with valid minimum coverage
- **Cross-Border Coverage** - COMESA Yellow Card compliance

---

## 🔍 API Reference

### Get All Insurance Policies
```bash
GET /api/insurance?status=active&insurer=Jubilee&policy_type=third_party
```

**Query Parameters:**
- `status` - Filter by status (active, expiring_soon, expired)
- `insurer` - Filter by insurer name (partial match)
- `policy_type` - Filter by policy type

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "vehicle_id": "uuid",
      "insurer_name": "Jubilee Insurance",
      "policy_type": "third_party",
      "tira_reference_number": "TZ/2024/123456",
      "expiry_date": "2025-01-01",
      "annual_premium": 500000,
      "status": "active",
      "is_cross_border": false
    }
  ]
}
```

### Get Expiring Policies
```bash
GET /api/insurance/expiring?days=30
```

**Query Parameters:**
- `days` - Number of days to look ahead (default: 30)

### Check TIRA Compliance
```bash
GET /api/insurance/compliance?type=tira
```

**Response:**
```json
{
  "check_type": "tira",
  "data": [
    {
      "vehicle_id": "uuid",
      "plate_number": "ABC-123",
      "compliant": true,
      "active_policy": { ... }
    }
  ],
  "summary": {
    "total_vehicles": 128,
    "compliant": 120,
    "non_compliant": 8,
    "compliance_rate": "93.8%"
  }
}
```

### Get Insurance Summary (Dashboard)
```bash
GET /api/insurance/summary
```

**Response:**
```json
{
  "data": {
    "total_vehicles": 128,
    "total_active_policies": 125,
    "expiring_within_30_days": 5,
    "expired_policies": 0,
    "mandatory_tira_compliance": {
      "compliant": 125,
      "non_compliant": 3
    },
    "cross_border_coverage": {
      "with_yellow_card": 12,
      "without_yellow_card": 2
    },
    "total_annual_premium": 64000000
  }
}
```

### Bulk Import
```bash
POST /api/insurance/bulk-import
Content-Type: application/json

{
  "records": [
    {
      "vehicle_id": "uuid",
      "insurer_name": "Jubilee",
      "policy_type": "third_party",
      "tira_reference_number": "TZ/2024/001",
      "start_date": "2024-01-01",
      "expiry_date": "2025-01-01",
      "annual_premium": 500000
    }
  ],
  "format": "csv"
}
```

**Response:**
```json
{
  "message": "Bulk import completed",
  "success": 45,
  "failed": 2,
  "errors": [
    "Row for vehicle xyz: Vehicle not found"
  ]
}
```

---

## 🔐 Security & Access Control

### Role-Based Access
- **HR Role:** Full access to manage insurance
- **ADMIN Role:** Full access (same as HR)
- **Other Roles:** No access (RLS policies enforce this)

### Row Level Security (RLS)
- All `truck_insurance` and `insurance_claims` tables have RLS enabled
- Policies ensure only HR/ADMIN users can access data
- Enable RLS: Already included in migration SQL

### Audit Logging
- All CRUD operations logged via `AuditService`
- Tracks who created/updated/deleted policies
- Visible in audit trail

---

## 📱 Integration with Fleet Management

### Vehicle Integration
- Insurance policies linked via `vehicle_id` foreign key
- Updates to vehicles automatically cascade
- Vehicle details (plate, make, model) available via joins

### Driver Integration
- Optional driver assignment via `assigned_driver_id`
- Links insurance to specific drivers on cross-border routes

### Expense Integration
- Insurance claims integrate with expense management
- Claims categorized as "insurance" expense type
- Premium costs tracked separately

---

## 🔧 Troubleshooting

### Issue: "TIRA Reference Number already exists"
**Solution:** TIRA reference numbers must be unique. Check for duplicates:
```sql
SELECT tira_reference_number, COUNT(*) 
FROM truck_insurance 
GROUP BY tira_reference_number 
HAVING COUNT(*) > 1;
```

### Issue: "Vehicle not found"
**Solution:** Ensure vehicle exists in `vehicles` table:
```sql
SELECT id, plate_number FROM vehicles WHERE id = 'your-vehicle-uuid';
```

### Issue: CSV Upload shows "Invalid format"
**Solution:** Ensure CSV has correct headers and data types:
- `annual_premium` must be numeric
- Dates must be YYYY-MM-DD format
- `vehicle_id` must be valid UUID

### Issue: Dashboard shows 0 policies but data exists
**Solution:** Check user role:
```sql
SELECT role FROM user_profiles WHERE id = current_user_id;
-- Must be 'HR' or 'ADMIN'
```

---

## 📈 Performance Considerations

### Indexes
The migration creates indexes on:
- `vehicle_id` - For policy lookups by vehicle
- `status` - For filtering active/expiring policies
- `expiry_date` - For sorting and filtering by date
- `insurer_name` - For filtering by insurer

### Queries to Monitor
```sql
-- Track policy expiries
SELECT * FROM expiring_insurance_policies;

-- TIRA compliance report
SELECT * FROM tira_compliance_report WHERE has_valid_coverage = 0;

-- Cross-border verification
SELECT * FROM cross_border_coverage_check WHERE comesa_status = 'MISSING_YELLOW_CARD';
```

---

## 📞 Support & Next Steps

### Customization Options
- Modify `policy_type` enum to add/remove policy types
- Adjust expiry alert threshold (currently 30 days)
- Add more insurers to dropdown in form
- Extend claims model for additional data

### Future Enhancements
- Email alerts for expiring policies
- Automated policy renewal reminders
- Premium payment tracking integration
- Photo/document upload for policies
- Insurance provider portal integration
- Premium comparison across insurers

### Questions?
Refer to the TypeScript types in `src/types/roles.ts` and `src/services/insurance-service.ts` for complete interface definitions.
