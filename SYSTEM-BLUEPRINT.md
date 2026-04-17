# Calvary Connect - Fleet Management System Blueprint

## Executive Summary

**Calvary Connect** is a comprehensive fleet management platform designed for logistics companies operating in Central and East Africa. The system enables efficient management of vehicles, drivers, trips, inventory, maintenance, and financial operations with role-based access control.

---

## System Architecture

### 1. Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript |
| **UI Framework** | Tailwind CSS, shadcn/ui components |
| **State Management** | React Hooks, Context API |
| **Backend** | Supabase (PostgreSQL + Auth + Storage) |
| **Database** | PostgreSQL (Supabase) |
| **Authentication** | Supabase Auth with Row Level Security (RLS) |
| **File Storage** | Supabase Storage |
| **Maps & Routing** | Google Maps Embed API |
| **AI Integration** | Grok API (for route suggestions and distance calculations) |
| **Icons** | Lucide React |

### 2. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                              │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐ │
│  │   Web App    │ │  Mobile View  │ │   Admin Dashboard   │ │
│  │  (Next.js)   │ │  (Responsive) │ │   (Role-based)    │ │
│  └──────────────┘ └──────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                  API LAYER (Supabase)                       │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐ │
│  │   REST API   │ │ Real-time    │ │   Storage API      │ │
│  │              │ │ Subscriptions│ │   (Photos/Docs)    │ │
│  └──────────────┘ └──────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│              DATA LAYER (PostgreSQL)                        │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐ │
│  │  User Data   │ │  Fleet Data  │ │   Financial Data   │ │
│  │  (RLS Secured)│ │  (Trips/Vehicles)│ │  (Chart of Accounts)│ │
│  └──────────────┘ └──────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. **Authentication & Authorization Module**

#### User Roles & Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| **CEO** | System owner with full access | All operations, role switching, audit access |
| **ADMIN** | System administrator | User management, trip oversight, financial reports |
| **OPERATOR** | Operations manager | Trip management, driver assignment, vehicle dispatch |
| **DRIVER** | Truck driver | Trip view-only, proof of delivery, location updates |
| **MECHANIC** | Maintenance staff | Service requests, vehicle inspection, inventory |
| **ACCOUNTANT** | Finance manager | Chart of accounts, journal entries, financial reports |
| **HR** | Human resources | Employee records, driver allowances, payroll |

#### User Status System

| Status | Description | Auto-Detection |
|--------|-------------|----------------|
| **Active** | Currently using system | After first login |
| **Invited** | Pre-added, pending signup | On user creation |
| **Dormant** | No activity for 30+ days | Automated detection |
| **Suspended** | Access revoked | Manual only |
| **Inactive** | Manually deactivated | Manual only |

#### Security Features
- Row Level Security (RLS) policies on all tables
- Automatic profile creation on signup
- Invite-only registration system
- Password hashing with bcrypt
- Session-based authentication

---

### 2. **Fleet Management Module**

#### Vehicle Types

| Type | Description | Trailer Required |
|------|-------------|------------------|
| **DUMP_TRUCK** | Mining/construction trucks | No |
| **TRUCK_HEAD** | Prime mover for trailers | Yes |
| **TRAILER** | Various trailer types | N/A |
| **ESCORT_CAR** | Security/pilot vehicles | No |

#### Trailer Sub-Types
- Tanker (fuel, chemicals)
- Flatbed (machinery, containers)
- Lowbed (heavy equipment)
- Tipper (construction materials)
- Refrigerated (perishables)
- Skeletal (containers)

#### Vehicle Lifecycle
```
AVAILABLE → ASSIGNED → IN_TRANSIT → MAINTENANCE → AVAILABLE
                ↓           ↓
              LOADING   UNLOADING
```

---

### 3. **Trip Management Module**

#### Trip Status Flow

```
PENDING → APPROVED → ASSIGNED → LOADED → IN_TRANSIT → DELIVERED → COMPLETED
    ↓          ↓          ↓          ↓          ↓           ↓
 CANCELLED  REJECTED   DELAYED   ACCIDENT  RETURNED   INVOICED
```

#### Trip Types

| Type | VAT Rate | Description |
|------|----------|-------------|
| **Local** | 18% | Domestic trips within country |
| **Transit** | 0% | International/cross-border trips |

#### Trip Categories (Local only)
- Town Trip (within city)
- Regional Trip (inter-city)

#### Route Management
- **80+ African Cities** in database (Central & East Africa)
- Real-time distance calculation
- Estimated time calculation
- Cargo-specific route recommendations
- Google Maps route visualization
- Safe route analysis with security alerts

---

### 4. **Driver Management Module**

#### Driver Features
- Profile management with photo
- Trip assignment notifications
- Proof of delivery (photo upload)
- Digital trip sheets
- Allowance tracking
- Performance monitoring

#### Driver Allowance Calculation
```
Base Amount: 500 TZS
+ Distance × 0.5 (per km)
+ Time × 100 (per hour)
+ Cargo Type Bonus:
  - Perishable: +200
  - Hazardous: +300
  - Heavy Machinery: +150
```

---

### 5. **Inventory & Parts Module**

#### Part Categories
- Engine components
- Transmission parts
- Brake systems
- Suspension parts
- Electrical parts
- Body parts
- Tires and wheels
- Fluids and lubricants

#### Inventory Operations
- Stock tracking
- Reorder level alerts
- Parts requests (drivers/mechanics)
- Purchase orders
- Stock transfers

---

### 6. **Maintenance Module**

#### Service Types
- Preventive Maintenance (scheduled)
- Corrective Maintenance (breakdown)
- Inspection (safety/compliance)
- Overhaul (major repairs)

#### Service Request Flow
```
REQUESTED → APPROVED → SCHEDULED → IN_PROGRESS → COMPLETED → VERIFIED
    ↓                                                    ↓
 CANCELLED                                          INVOICED
```

---

### 7. **Financial Module**

#### Chart of Accounts
- Assets (1000-1999)
- Liabilities (2000-2999)
- Equity (3000-3999)
- Revenue (4000-4999)
- Expenses (5000-5999)

#### Journal Entry System
- Double-entry bookkeeping
- Multi-line journal entries
- Debit/Credit validation
- Account balance tracking
- Trial balance generation

#### Financial Reports
- Income Statement
- Balance Sheet
- Trial Balance
- Cash Flow Statement
- VAT Reports

#### VAT Management
- Automatic VAT calculation (18% for local trips)
- VAT exemption for transit (0%)
- VAT reporting

---

### 8. **Cargo & Client Management**

#### Common Cargo Types
- General Cargo
- Containers
- Perishables (refrigerated)
- Hazardous Materials
- Heavy Machinery
- Mining Products (copper, cobalt, gold)
- Agricultural Products
- Petroleum Products

#### Client Management
- Client database
- Trip history by client
- Revenue tracking by client
- Credit limit monitoring

---

## Database Schema

### Core Tables

```sql
-- User Management
user_profiles (id, email, name, role, status, avatar_url, created_at, last_login_at, login_count)

-- Fleet
vehicles (id, plate_number, make, model, type, status, mileage, fuel_capacity, trailer_sub_type)
trailers (id, plate_number, type, capacity, status)

-- Operations
trips (id, trip_number, origin, destination, driver_id, vehicle_id, trailer_id, 
       cargo, client, distance, status, payment_status, trip_type, trip_category,
       sales_amount, vat_rate, vat_amount, total_amount, created_at)

driver_allowances (id, driver_id, trip_id, amount, status, reason, created_at)

-- Inventory
parts (id, name, category, stock_quantity, unit_price, reorder_level, location)
parts_requests (id, part_id, requester_id, quantity, status, priority, notes)

-- Maintenance
service_requests (id, vehicle_id, type, description, status, scheduled_date, completed_date)

-- Financial
accounts (id, code, name, type, parent_id, balance)
journal_entries (id, date, description, reference, posted)
journal_entry_lines (id, entry_id, account_id, debit, credit)
```

---

## Geographic Coverage

### Supported Countries (80+ Cities)

| Country | Major Hubs | Transit Routes |
|---------|------------|----------------|
| **Tanzania** | Dar es Salaam, Arusha, Mwanza, Dodoma, Tanga | Yes |
| **Kenya** | Nairobi, Mombasa, Kisumu, Nakuru | Yes |
| **Uganda** | Kampala, Entebbe, Jinja, Mbarara | Yes |
| **Rwanda** | Kigali, Rubavu, Rusumo Border | Yes |
| **Burundi** | Bujumbura, Gitega | Yes |
| **DRC** | Lubumbashi, Kinshasa, Goma, Bukavu | Yes |
| **Zambia** | Lusaka, Ndola, Kitwe, Livingstone | Yes |
| **Malawi** | Lilongwe, Blantyre, Mzuzu | Yes |
| **Mozambique** | Maputo, Beira, Tete | Yes |
| **South Sudan** | Juba, Nimule, Kaya | Yes |
| **Ethiopia** | Addis Ababa, Dire Dawa, Moyale | Yes |

### Major Trade Corridors
1. **Northern Corridor** (Mombasa → Nairobi → Kampala → Kigali → Bujumbura)
2. **Central Corridor** (Dar es Salaam → Dodoma → Kigoma → DRC)
3. **Tazara Route** (Dar es Salaam → Mbeya → Nakonde → Lusaka)
4. **Southern Route** (Durban → Maputo → Beira → Malawi)

---

## Integration Points

### External APIs

| Service | Purpose | Integration Type |
|---------|---------|-------------------|
| **Supabase Auth** | User authentication | SDK |
| **Supabase Database** | Data persistence | REST/WebSocket |
| **Supabase Storage** | File uploads | REST |
| **Google Maps** | Route visualization | iframe Embed |
| **Grok AI** | Route suggestions, distance calc | REST API |

### Data Flows

```
1. User Login → Supabase Auth → Profile Fetch → Dashboard
2. Create Trip → City Selection → Distance Calc → Save to DB
3. Assign Driver → Notification → Trip Start → Location Tracking
4. Delivery Complete → Photo Upload → POD Generation → Billing
5. Maintenance Request → Approval → Scheduling → Completion
6. Financial Entry → Journal Posting → Account Update → Reports
```

---

## Security Architecture

### Authentication Flow
```
Login Page → Supabase Auth → JWT Token → Profile Fetch → Role Assignment → Dashboard
```

### Authorization (RLS Policies)

```sql
-- Example: Users can only see their own profile
CREATE POLICY "Users can view own profile"
ON user_profiles FOR SELECT
USING (auth.uid() = id);

-- Example: Admins can manage all profiles
CREATE POLICY "Admins can manage all profiles"
ON user_profiles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'CEO')
  )
);
```

### Security Features
- Password hashing (bcrypt)
- Session tokens with expiration
- HTTPS enforced
- RLS on all tables
- Input sanitization
- File upload validation (type, size)
- Role-based UI hiding

---

## User Interface Structure

### Navigation Structure

```
Dashboard (Role-based overview)
├── Fleet
│   ├── Vehicles (List, Add, Edit)
│   └── Trailers
├── Trips
│   ├── All Trips (List with filters)
│   └── Create Trip (with map)
├── Operations
│   ├── Parts Requests
│   └── Service Requests
├── Finance
│   ├── Chart of Accounts
│   ├── Journal Entries
│   └── Reports
├── Inventory
│   ├── Parts List
│   └── Stock Management
├── Users (Admin only)
│   └── User Management
└── System
    ├── Audit Log
    └── Settings
```

### Mobile-Responsive Design
- Bottom navigation tabs for mobile
- Responsive grids (1-2-3 columns)
- Touch-friendly buttons
- Optimized forms for mobile

---

## Business Logic

### Key Calculations

#### 1. Trip Revenue Calculation
```
Sales Amount: 1000.00
VAT Rate: 18% (local) or 0% (transit)
VAT Amount: 180.00
Total Amount: 1180.00
```

#### 2. Driver Allowance
```
Base: 500 TZS
Distance Bonus: distance_km × 0.5
Time Bonus: hours × 100
Cargo Bonus: based on cargo type
Total = Base + Distance + Time + Cargo
```

#### 3. Fuel Efficiency
```
Efficiency = Distance (km) / Fuel Used (liters)
Target: > 3.5 km/l for trucks
```

#### 4. Vehicle Utilization
```
Utilization % = (Active Days / Total Days) × 100
Target: > 75%
```

---

## Reporting & Analytics

### Available Reports

1. **Operational Reports**
   - Trip Summary (by date, driver, vehicle)
   - Vehicle Utilization
   - Driver Performance
   - Cargo Type Analysis

2. **Financial Reports**
   - Income Statement
   - Balance Sheet
   - Cash Flow
   - VAT Report
   - Revenue by Client

3. **Maintenance Reports**
   - Service History
   - Parts Usage
   - Maintenance Costs
   - Vehicle Downtime

---

## Deployment & Infrastructure

### Environment Setup

| Environment | Database | Features |
|-------------|----------|----------|
| **Development** | Local Supabase | Full access, debug mode |
| **Staging** | Supabase Project | Testing, preview |
| **Production** | Supabase Project | Live, optimized |

### Build Configuration
```javascript
// Environment variables
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROK_API_KEY=
DEMO_MODE=false
```

### Deployment Checklist
- [ ] Supabase project configured
- [ ] Database migrations applied
- [ ] RLS policies enabled
- [ ] Storage buckets created
- [ ] Environment variables set
- [ ] Build successful
- [ ] Tests passing
- [ ] Domain configured

---

## Future Enhancements

### Planned Features
1. **GPS Tracking Integration** - Real-time vehicle location
2. **Mobile App** - Native iOS/Android apps for drivers
3. **IoT Sensors** - Fuel level, temperature monitoring
4. **AI Route Optimization** - Traffic-aware routing
5. **Automated Billing** - Invoice generation and email
6. **Multi-currency Support** - USD, TZS, KES, UGX, etc.
7. **API for Partners** - Third-party integrations
8. **Advanced Analytics** - Predictive maintenance, demand forecasting

---

## Support & Maintenance

### System Maintenance
- Database backups: Daily
- Log retention: 30 days
- Password expiry: 90 days
- Security updates: Monthly

### User Support Levels
- Level 1: Help documentation, FAQ
- Level 2: Email support
- Level 3: Admin intervention

---

## Conclusion

Calvary Connect provides a comprehensive, scalable fleet management solution tailored for African logistics operations. The system combines modern web technologies with regional expertise to deliver efficient fleet operations, financial management, and regulatory compliance.

**Key Success Factors:**
- Role-based access ensures data security
- Mobile-responsive design enables field operations
- Real-time tracking improves visibility
- Automated calculations reduce errors
- Regional city database supports local operations
- Modular architecture allows future expansion

---

**Document Version:** 1.0  
**Last Updated:** April 2026  
**System Status:** Production Ready
