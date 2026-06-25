# 🚛 Calvary Connect Fleet Management System - Complete Documentation

## 🏗️ **SYSTEM ARCHITECTURE**

### **Technology Stack**
- **Frontend**: Next.js 14+ with React 18+, TypeScript
- **Backend**: Supabase (PostgreSQL + Real-time + Auth + Storage)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Deployment**: Vercel (frontend) + Supabase (backend)
- **AI Integration**: NVIDIA Nemotron via OpenRouter API

---

## 🔄 **COMPLETE SYSTEM FLOW**

### **1. Authentication & Access Control**
```
User Login → Supabase Auth → JWT Token → Role-Based Access
├── CEO (Full Access)
├── ADMIN (Full Access) 
├── HR (User Management)
├── OPERATOR (Fleet Operations)
├── DRIVER (Trip Management)
├── MECHANIC (Maintenance)
└── ACCOUNTANT (Financial)
```

### **2. Responsive Navigation System**
```
Mobile (phones):     < 640px   - Single column, stacked cards
Tablet (portrait):   640-1024px - 2-column grids, side panels
Desktop (laptop):    1024-1440px - Full dashboard, 3-column
Large (monitor):     > 1440px   - Extended view, multiple panels
```

### **3. Core Module Flows**

#### **🚛 Fleet Management**
```
Fleet Dashboard → Vehicle Cards → Actions
├── Add Vehicle (Dialog)
├── Edit Vehicle (Dialog) 
├── View Details (Dialog)
├── Assign Driver (Dialog)
└── Filter by Type/Status
    ├── Trucks (DUMP_TRUCK, TRUCK_HEAD)
    ├── Escort Cars (ESCORT_CAR)
    ├── Trailers (TRAILER)
    ├── Reefers (REEFER, COLD_CHAIN)
    └── Lowbeds (LOWBED, HEAVY_CARGO)
```

#### **💰 Sales & Commercial**
```
Sales Dashboard → Multi-Tab Interface
├── Customers Management
│   ├── Add Customer (Dialog)
│   ├── Edit Customer (Dialog)
│   └── Customer Table (Responsive)
├── Route Quotations
│   ├── Create Quote (Dialog)
│   ├── Service Type Selection
│   └── Price Calculation
├── Transport Contracts
│   ├── Contract Management (Dialog)
│   ├── Route Configuration
│   └── Terms Setup
├── Rate Sheets
│   ├── Route Pricing Tables
│   └── Service Rates
└── Sales Pipeline
    ├── Opportunities Tracking
    └── Conversion Analytics
```

#### **👥 User Management**
```
User Dashboard → Role-Based Interface
├── Team Statistics Cards
│   ├── Total Users
│   ├── Active Users
│   ├── Pending Invites
│   ├── Dormant Users
│   ├── Drivers Count
│   └── Operators Count
├── User Invitation System
│   ├── Role Assignment
│   ├── Photo Upload
│   └── Email Invitations
├── User Profile Management
│   ├── Edit User Details
│   ├── Status Management
│   └── Permission Control
└── User Table (Responsive)
    ├── Search & Filter
    ├── Role Badges
    └── Status Indicators
```

#### **🤖 AI-Powered Insights**
```
AI Dashboard → NVIDIA Nemotron Integration
├── Revenue Forecasting
│   ├── Timeframe Selection (Week/Month/Quarter/Year)
│   ├── Service Type Analysis
│   └── Predictive Analytics
├── Expense Forecasting
│   ├── Cost Category Analysis
│   ├── Trend Prediction
│   └── Budget Recommendations
└── Fleet Performance Analysis
    ├── Vehicle Utilization
    ├── Cost Optimization
    ├── Profitability Analysis
    └── Operational Insights
```

#### **💳 Financial Management**
```
Finance Module → Double-Entry Accounting
├── Chart of Accounts
│   ├── Account Categories (Assets, Liabilities, Equity, Revenue, Expenses)
│   ├── Account Creation/Editing
│   └── Balance Tracking
├── Journal Entries
│   ├── Manual Entry Creation
│   ├── Multi-Line Entries
│   └── Balance Validation
├── Ledger View
│   ├── Transaction History
│   ├── Running Balances
│   └── Account Reconciliation
└── Financial Reports
    ├── Trial Balance
    ├── Income Statement
    └── Balance Sheet
```

---

## 🗄️ **DATABASE SCHEMA & RELATIONSHIPS**

### **Core Tables & Foreign Key Relationships**
```
user_profiles (id, email, role, status, avatar_url)
    ↓ (created_by, invited_by)
vehicles (id, plate_number, make, model, type, status, assigned_driver_id)
    ↓ (created_by, updated_by)
trips (id, vehicle_id, driver_id, origin, destination, status)
    ↓ (created_by, vehicle_id, driver_id)
fuel_requests (id, vehicle_id, driver_id, amount, status)
    ↓ (created_by, vehicle_id, driver_id)
expenses (id, vehicle_id, category, amount, description)
    ↓ (created_by, vehicle_id)
reports (id, vehicle_id, trip_id, type, data, created_by)
    ↓ (vehicle_id, trip_id, created_by)

customers (id, company_name, contact_person, email, phone)
    ↓ (created_by)
route_quotations (id, customer_id, service_type, origin, destination, total_amount)
    ↓ (customer_id, created_by)
transport_contracts (id, customer_id, service_types, start_date, end_date)
    ↓ (customer_id, created_by)

accounts (id, code, name, category, type, current_balance)
    ↓ (created_by, updated_by)
journal_entries (id, entry_number, entry_date, description, total_debit, total_credit)
    ↓ (created_by)
journal_entry_lines (id, journal_entry_id, account_code, debit_amount, credit_amount)
    ↓ (journal_entry_id)
```

---

## 🔐 **SECURITY & PERMISSIONS SYSTEM**

### **Row Level Security (RLS) Policies**
```
Every Table → RLS Policies → Role-Based Access
├── Authenticated Users → Read Own Data
├── ADMIN/CEO → Full Access
├── HR → User Management Only
├── OPERATOR → Fleet Operations Only
├── DRIVER → Assigned Trips/Vehicles Only
└── ACCOUNTANT → Financial Data Only
```

### **Data Protection Mechanisms**
```
- JWT Token Authentication with Expiry
- Role-Based Route Protection
- API Rate Limiting
- Input Validation & Sanitization
- SQL Injection Prevention (Supabase RLS)
- XSS Protection (React JSX)
- File Upload Security (Avatar/Images)
- CORS Configuration
- Environment Variable Protection
```

---

## 📱 **RESPONSIVE DESIGN SYSTEM**

### **Breakpoint Strategy**
```
Mobile (< 640px):
├── Single Column Layouts
├── Stacked Cards
├── Hamburger Navigation
├── Bottom Tab Navigation
└── Touch-Friendly Controls

Tablet (640-1024px):
├── 2-Column Grids
├── Side Panels
├── Collapsible Navigation
└── Optimized Tables

Desktop (1024-1440px):
├── 3-4 Column Layouts
├── Fixed Sidebar Navigation
├── Full Dashboard Views
└── Hover States & Tooltips

Large (> 1440px):
├── Extended Multi-Panel Views
├── Maximum Content Display
├── Advanced Grid Layouts
└── Enhanced Data Tables
```

### **Component Responsiveness**
```
Sidebar Navigation:
├── Mobile: Hamburger Menu + Overlay
├── Tablet: Collapsible Sidebar
├── Desktop: Fixed 240px Sidebar
└── Large: Extended Sidebar

Dashboard Grids:
├── Mobile: 1-2 Columns
├── Tablet: 2-3 Columns  
├── Desktop: 3-4 Columns
└── Large: 4+ Columns

Data Tables:
├── Mobile: Horizontal Scroll + Minimum Widths
├── Tablet: Responsive Column Hiding
├── Desktop: Full Table Display
└── Large: Enhanced Table Features

Forms & Dialogs:
├── Mobile: Full Width + Stacked Fields
├── Tablet: 2-Column Form Layouts
├── Desktop: Multi-Column Forms
└── Large: Advanced Form Layouts
```

---

## 🔄 **REAL-TIME FEATURES**

### **Live Data Updates**
```
Supabase Realtime → Live Dashboard Updates
├── Vehicle Status Changes
├── Trip Progress Updates
├── Fuel Request Notifications
├── User Activity Tracking
└── Financial Transaction Updates
```

### **Notification System**
```
In-App Notifications → Real-Time Alerts
├── New Trip Assignments
├── Fuel Request Approvals
├── Maintenance Alerts
├── Financial Updates
└── System Notifications
```

---

## 🚀 **DEPLOYMENT & PERFORMANCE**

### **Production Deployment Flow**
```
Development → Git Push → Vercel Deployment
├── Automatic Build Detection
├── TypeScript Compilation
├── React Bundle Optimization
├── Asset Minification
└── CDN Distribution

Supabase → Database & Services
├── PostgreSQL Database
├── Authentication Service
├── File Storage System
├── Real-Time WebSocket
└── Edge Function Hosting
```

### **Performance Optimizations**
```
Frontend Optimizations:
├── Code Splitting (Next.js)
├── Image Optimization (Next.js Image)
├── Lazy Loading Components
├── Responsive Image Serving
├── Database Query Optimization
├── Caching Strategies
└── Bundle Size Minimization

Backend Optimizations:
├── Database Indexing
├── Query Optimization
├── Connection Pooling
├── Real-time Subscription Management
└── Edge Function Caching
```

---

## 🎯 **KEY BUSINESS LOGIC FLOWS**

### **Trip Management Workflow**
```
Trip Creation → Vehicle Assignment → Driver Assignment → Route Planning
├── Origin/Destination Selection
├── Service Type Determination
├── Cost Calculation
├── Fuel Request Generation
├── Document Requirements
└── Status Tracking (Planned → In Progress → Completed)
```

### **Financial Operations Workflow**
```
Transaction → Double-Entry Posting → Account Updates → Balance Changes
├── Debit/Credit Validation
├── Account Balance Updates
├── Trial Balance Maintenance
├── Financial Report Generation
└── Audit Trail Creation
```

### **AI Integration Workflow**
```
Data Collection → AI API Call → Response Processing → Insight Display
├── Fleet Data Aggregation
├── NVIDIA Nemotron API Request
├── JSON Response Parsing
├── Insight Categorization
└── Interactive Result Display
```

### **User Management Workflow**
```
User Invitation → Email Registration → Profile Setup → Role Assignment
├── Role-Based Permission Granting
├── Avatar Upload & Storage
├── Activity Tracking
├── Status Management
└── Audit Trail Maintenance
```

---

## 🛠️ **DEVELOPMENT WORKFLOW**

### **File Structure**
```
src/
├── app/                    # Next.js App Router Pages
│   ├── fleet/              # Fleet Management
│   ├── sales/               # Sales & Commercial
│   ├── users/               # User Management
│   ├── finance/             # Financial Management
│   └── ai-insights/         # AI Dashboard
├── components/              # Reusable React Components
│   ├── navigation/          # Sidebar, Bottom Tabs
│   ├── fleet/              # Fleet Components
│   ├── sales/              # Sales Components
│   ├── finance/            # Finance Components
│   ├── ai/                 # AI Components
│   └── ui/                 # Base UI Components
├── lib/                    # Utilities & Config
│   ├── supabase.ts         # Database Client
│   ├── utils.ts            # Helper Functions
│   └── ai-service.ts       # AI Integration
└── hooks/                  # Custom React Hooks
    ├── use-role.ts         # Role Management
    ├── use-language.ts     # Internationalization
    └── use-supabase.ts    # Auth State
```

### **Environment Configuration**
```
.env.local                    # Local Development
.env.production             # Production Variables
├── NEXT_PUBLIC_SUPABASE_URL
├── NEXT_PUBLIC_SUPABASE_ANON_KEY
├── NVIDIA_API_KEY
└── NVIDIA_MODEL
```

---

## 🔧 **API ENDPOINTS**

### **Core System APIs**
```
/api/auth/*                   # Authentication Endpoints
/api/fleet/*                  # Fleet Management APIs
/api/sales/*                  # Sales & Commercial APIs
/api/users/*                  # User Management APIs
/api/finance/*                # Financial Management APIs
/api/ai/*                     # AI Integration APIs
├── /api/ai/forecast          # Revenue/Expense Forecasting
└── /api/ai/analyze           # Fleet Performance Analysis
```

### **Database Functions**
```
Supabase Edge Functions:
├── User Registration & Management
├── Email Notifications
├── File Upload Processing
├── Report Generation
└── Data Export Functions
```

---

## 📊 **MONITORING & ANALYTICS**

### **System Monitoring**
```
Application Monitoring:
├── Error Tracking (Sentry)
├── Performance Monitoring
├── User Analytics
├── API Response Times
└── Database Query Performance

Business Intelligence:
├── Fleet Utilization Metrics
├── Trip Completion Rates
├── Cost per Kilometer Analysis
├── Revenue per Vehicle Tracking
└── Driver Performance Metrics
```

---

## 🎨 **UI/UX DESIGN SYSTEM**

### **Component Library**
```
shadcn/ui Components:
├── Forms (Input, Select, Textarea)
├── Navigation (Sidebar, Tabs, Breadcrumb)
├── Data Display (Table, Card, Badge)
├── Feedback (Dialog, Alert, Toast)
├── Layout (Grid, Flex, Container)
└── Charts (Dashboard Analytics)
```

### **Design Tokens**
```
Color System:
├── Primary: Blue (#3B82F6)
├── Secondary: Slate (#64748B)
├── Success: Green (#10B981)
├── Warning: Amber (#F59E0B)
├── Error: Red (#EF4444)
└── Neutral: Gray (#6B7280)

Typography:
├── Headline: Inter (Bold)
├── Body: Inter (Regular)
├── Mono: JetBrains Mono (Code)
└── Sizes: xs, sm, base, lg, xl, 2xl
```

---

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**
```
Mobile Application:
├── React Native Fleet App
├── Push Notifications
├── Offline Mode Support
└── GPS Integration

Advanced Analytics:
├── Machine Learning Predictions
├── Route Optimization AI
├── Predictive Maintenance
└── Cost Optimization Algorithms

Integration Capabilities:
├── TMS (Transport Management System) Integration
├── GPS/Telematics Integration
├── Fuel Card System Integration
└── Accounting Software Integration
```

---

## 📞 **SUPPORT & MAINTENANCE**

### **System Maintenance**
```
Regular Maintenance Tasks:
├── Database Optimization
├── Security Updates
├── Performance Monitoring
├── Backup Verification
└── User Feedback Analysis
```

### **Technical Support**
```
Support Channels:
├── Documentation Portal
├── Video Tutorials
├── FAQ System
├── Community Forum
└── Direct Support Contact
```

---

## 🏁 **CONCLUSION**

This comprehensive fleet management system handles all aspects of transportation logistics:

✅ **Complete Fleet Operations** - From vehicle tracking to maintenance
✅ **Financial Management** - Double-entry accounting with real-time updates  
✅ **Sales & CRM** - Customer management and quotation system
✅ **User Management** - Role-based access with comprehensive permissions
✅ **AI-Powered Insights** - Predictive analytics and forecasting
✅ **Responsive Design** - Optimized for all device sizes
✅ **Real-Time Features** - Live updates and notifications
✅ **Security First** - Enterprise-grade security and data protection
✅ **Scalable Architecture** - Built for growth and expansion

The system provides a complete solution for modern fleet management operations with cutting-edge technology integration and user-centric design.

---

*Last Updated: May 2026*  
*Version: 2.0 - Responsive Design Implementation Complete*
