# Calvary Logistics OS - Blueprint v2.0
## Fleet Management System for Calvary Investment Company Ltd

---

## Executive Summary

**Calvary Logistics OS** is a world-class, enterprise-grade logistics operating system designed specifically for Calvary Investment Company Ltd (calvary.co.tz), headquartered in Dar es Salaam, Tanzania. The platform transforms traditional fleet management into a comprehensive digital logistics ecosystem that serves freight companies operating across Central, Eastern, and Southern Africa.

### Strategic Vision

Calvary Logistics OS delivers **20-35% operational cost reduction** through intelligent automation, achieves **>95% on-time delivery performance**, and provides **real-time visibility** from origin to destination. The system supports Calvary's core service offerings:

- **Local Freight**: Domestic distribution within Tanzania
- **Cross-Border Transit**: Seamless international logistics across 11+ countries
- **Heavy/Oversized Cargo**: Specialized lowbed transport with route constraint management
- **Cold Chain Logistics**: Reefer temperature-controlled transport for pharmaceuticals, medical supplies, and perishables with full FDA/WHO compliance

### Competitive Differentiation

| Feature | Industry Standard | Calvary Logistics OS |
|---------|-------------------|---------------------|
| Customer Visibility | Phone/email updates only | Real-time GPS tracking + customer portal self-service |
| Proof of Delivery | Paper-based, 2-3 day delay | Digital POD with photo + geotag, instant confirmation |
| Cold Chain Compliance | Manual temperature logs | Continuous IoT monitoring with automated alerts & compliance reports |
| Cross-Border | Manual documentation, frequent delays | Digital compliance docs, pre-clearance integration, border wait tracking |
| Driver Experience | Radio/phone dispatch | Offline-first mobile app with digital trip sheets, instant allowance calculation |
| Payment Collection | Cash/invoice 30-day cycle | Mobile money integration (M-Pesa, Tigo Pesa, Airtel Money) with instant reconciliation |

---

## System Architecture

### 1. Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend (Web)** | Next.js 14 (App Router), React 18, TypeScript | Customer portal, admin dashboards, ops center |
| **Frontend (Mobile)** | React Native (iOS/Android) + PWA fallback | Driver app with offline-first architecture |
| **UI Framework** | Tailwind CSS, shadcn/ui components | Consistent, responsive design system |
| **State Management** | React Hooks, Context API, TanStack Query | Server state synchronization |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime) | Core platform infrastructure |
| **Database** | PostgreSQL 15 (Supabase) | Primary data store with RLS |
| **Cache Layer** | Redis (Upstash/Supabase) | Session storage, real-time tracking cache |
| **Authentication** | Supabase Auth with MFA | Secure multi-factor authentication |
| **File Storage** | Supabase Storage + Cloudinary | Documents, photos, signatures |
| **Maps & Routing** | Google Maps Platform + OpenStreetMap | Routes, geocoding, distance calculation |
| **GPS Tracking** | GPS device API integration + Geofencing | Real-time vehicle location, immobilization |
| **IoT Platform** | Custom MQTT broker + TimescaleDB | Temperature sensors, fuel monitoring, OBD-II |
| **AI/ML Engine** | Grok API + OpenRouteService | Predictive ETAs, intelligent routing, demand forecasting |
| **Notifications** | Twilio (SMS), WhatsApp Business API, Firebase FCM | Multi-channel customer & driver communication |
| **Payments** | M-Pesa Open API, Tigo Pesa, Airtel Money API | Mobile money collection & driver payments |
| **Search** | Meilisearch/Algolia | Fast cargo/shipment lookup |

### 2. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXPERIENCE LAYER                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │  Customer Portal │  │  Driver Mobile   │  │   Operations Command Center    │  │
│  │  (Web - Next.js) │  │  (React Native)  │  │   (Next.js - Real-time)       │  │
│  │  Self-service     │  │  Offline-first   │  │   Dispatch, fleet, finance    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API & INTEGRATION LAYER                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐ │
│  │   Supabase   │ │   GraphQL    │ │  WhatsApp     │ │  Payment APIs      │ │
│  │   REST API   │ │   Gateway    │ │  Business     │ │  M-Pesa/Tigo/      │ │
│  │  Realtime    │ │  (Hasura)    │ │  API          │ │  Airtel Money      │ │
│  │  Subscriptions│ │              │ │               │ │                    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTELLIGENCE LAYER                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐ │
│  │   Grok AI    │ │   Predictive │ │  Route       │ │  Geofencing        │ │
│  │   Assistant  │ │   Analytics  │ │  Optimization│ │  Engine            │ │
│  │  (Chat/RAG)  │ │  (ETAs/Demand)│ │  (OSRM/ORS)  │ │  (Geolib)          │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA & IOT LAYER                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐ │
│  │  PostgreSQL  │ │  TimescaleDB │ │    MQTT      │ │   Redis Cache      │ │
│  │  (Core Data) │ │  (IoT Time-  │ │   Broker     │ │   (Sessions/       │ │
│  │  RLS Secured │ │   Series)    │ │  (EMQX)      │ │   Real-time)       │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEVICE LAYER (IoT)                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐ │
│  │  GPS Tracker │ │ Temp Sensors │ │  Fuel Sensor │ │    OBD-II          │ │
│  │  (Vehicle)   │ │ (Reefer)     │ │  (Capacitive)│ │    Diagnostics     │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REAL-TIME DATA PIPELINES                              │
└─────────────────────────────────────────────────────────────────────────────┘

GPS Tracking Flow:
┌─────────┐    HTTP/MQTT     ┌─────────────┐    WebSocket    ┌─────────────┐
│  GPS    │ ───────────────→ │  MQTT/REST  │ ─────────────→ │  Web App    │
│ Device  │    (30s-60s)    │   Gateway   │    (Realtime)   │  Dashboard  │
└─────────┘                  └─────────────┘                 └─────────────┘
                                    │
                                    ↓
                              ┌─────────────┐
                              │ TimescaleDB │
                              │  (History)  │
                              └─────────────┘

IoT Temperature Flow:
┌─────────┐    MQTT     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Reefer  │ ──────────→ │ MQTT Broker │ ─→ │ Stream Proc │ ─→ │  Alerts/    │
│ Sensor  │   (60s)     │   (EMQX)    │    │  (Node.js)  │    │  WhatsApp   │
└─────────┘             └─────────────┘    └─────────────┘    └─────────────┘
                                   │
                                   ↓
                            ┌─────────────┐
                            │ TimescaleDB │
                            │ (Sensor TS) │
                            └─────────────┘

Mobile Money Flow:
┌─────────┐    API     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Customer│ ────────→ │  M-Pesa/    │ ─→ │  Webhook    │ ─→ │  Invoice    │
│ Payment │           │  Tigo API    │    │  Handler    │    │  Updated    │
└─────────┘           └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Core Modules

### 1. **Customer Self-Service Portal** *(New v2.0)*

A dedicated B2B customer portal where shippers can self-serve without calling operations.

#### Features

| Feature | Description | Business Value |
|---------|-------------|----------------|
| **Shipment Booking** | Customers create shipments, select cargo type, get instant quotes | Reduces call center volume by 60% |
| **Real-Time Tracking** | Live map view with GPS location, ETA updates every 5 minutes | Customer satisfaction +40% |
| **Document Access** | Download POD, invoices, customs documents 24/7 | Reduces admin queries |
| **History & Analytics** | View past shipments, spending reports, delivery performance | Customer retention |
| **Multi-User Access** | Company admin can create sub-accounts for their team | Enterprise sales enablement |
| **Rate Calculator** | Instant pricing based on origin/destination/cargo type | Transparency, faster decisions |
| **Notifications** | WhatsApp/SMS/Email alerts for pickup, transit, delivery | Proactive communication |

#### Customer Portal Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Customer: ABC Trading Ltd                    [New Shipment] │
├─────────────────────────────────────────────────────────────┤
│  Active Shipments (3)                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ SHP-2024-001│ │ SHP-2024-002│ │ SHP-2024-003│         │
│  │ DAR → KGL   │ │ DAR → NBO   │ │ DAR → LUS   │         │
│  │ [Live Map]  │ │ In Transit  │ │ Loading...  │         │
│  │ ETA: 2h 15m │ │ ETA: 6h 30m │ │             │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  Recent Activity                    Quick Actions           │
│  • SHP-2024-002 passed Namanga   [Download POD]           │
│  • SHP-2024-001 near destination   [View Invoice]          │
│  • Payment received for SHP-122  [Book Again]           │
└─────────────────────────────────────────────────────────────┘
```

---

### 2. **Real-Time GPS & IoT Tracking** *(Core in v2.0)*

GPS tracking and IoT sensor integration moved from "future" to **core platform capability**.

#### GPS Tracking Features

| Feature | Description | Technical Implementation |
|---------|-------------|-------------------------|
| **Live Location** | Vehicle position updated every 30-60 seconds | GPS device → MQTT → TimescaleDB → WebSocket |
| **Route Deviation Alerts** | Automatic alerts if vehicle leaves planned corridor | Geofencing with 500m buffer |
| **Geofencing** | Virtual boundaries for depots, borders, high-risk zones | Polygon-based geofences |
| **Immobilization** | Remote engine cut-off for theft/security | SMS command to GPS device |
| **Speed Monitoring** | Real-time speed alerts, speeding violations | GPS speed data analysis |
| **History Playback** | 90-day route history with speed/idle analysis | TimescaleDB time-series queries |
| **ETA Prediction** | ML-powered arrival time based on traffic, distance, patterns | Grok AI + historical data |

#### IoT Sensor Integration

| Sensor Type | Data Captured | Frequency | Alert Conditions |
|-------------|---------------|-----------|------------------|
| **GPS Position** | Lat/Lng, Speed, Heading | 30-60s | Route deviation, unexpected stops |
| **Temperature (Reefer)** | Cargo temp, ambient temp | 60s | Out-of-range (2-8°C for pharma) |
| **Humidity** | Relative humidity % | 5min | >85% RH (condensation risk) |
| **Door Status** | Open/Closed | Event-driven | Unauthorized opening en-route |
| **Fuel Level** | Tank %, fuel consumption | 5min | Sudden drop (theft), low fuel |
| **OBD-II Data** | Engine RPM, coolant temp, DTC codes | 30s | Engine faults, overheating |
| **Vibration/Shock** | G-force impact detection | Event-driven | Rough handling, accident |
| **Light Sensor** | Cargo area light level | Event-driven | Unauthorized access |

#### Cold Chain Compliance Dashboard (Reefer)

```
┌─────────────────────────────────────────────────────────────┐
│  Reefer Unit: T-782 | Cargo: Pharma vaccines | Trip: T-4523 │
├─────────────────────────────────────────────────────────────┤
│  Temperature Status: ✅ COMPLIANT                            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Current: 4.2°C    Target: 2-8°C    Variance: ±0.3°C   │ │
│  │                                                       │ │
│  │ ████████████████████████████████████████████████     │ │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │
│  │ ─────────────────────────────────────────────────────  │ │
│  │      Last 24 Hours Temperature Trend                    │ │
│  └───────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Compliance Report          Excursions (0)        Status: ✓ │
│  • WHO GDP: Compliant      • No breaches          Digital  │
│  • FDA 21 CFR Part 11: OK  • MKT within spec     Signature  │
│  • Total MKT: 45.2 hours                               ✓   │
└─────────────────────────────────────────────────────────────┘
```

---

### 3. **Cargo-Specific Handling** *(Enhanced v2.0)*

Specialized workflows for Calvary's core service offerings.

#### 3.1 Lowbed / Heavy & Oversized Cargo

| Feature | Description |
|---------|-------------|
| **Route Constraint Analysis** | Bridge weight limits, tunnel heights, road width restrictions |
| **Permit Management** | Track special transport permits by country, expiry alerts |
| **Escort Vehicle Assignment** | Automatic escort car pairing for oversized loads |
| **Pilot Car Coordination** | Integration with escort driver schedules |
| **Loading Diagrams** | Upload/attach engineering drawings, loading plans |
| **Axle Load Distribution** | Calculate and validate axle weights |
| **Police/Escort Payments** | Track escort fees, police payments by jurisdiction |
| **Risk Assessment** | Pre-trip risk rating based on cargo dimensions, route difficulty |

**Route Constraint Database**
```sql
route_constraints (
  id,
  road_segment_id,
  constraint_type: ['BRIDGE_MAX_WEIGHT', 'TUNNEL_HEIGHT', 'WIDTH_RESTRICTION', 
                    'HAZARD_CURVE', 'STEEP_GRADE', 'UNPAVED_SECTION'],
  limit_value,
  applicable_vehicle_types,
  bypass_route_id,
  active_hours, -- e.g., night travel allowed for oversize
  permit_required
)
```

#### 3.2 Reefer / Cold Chain Logistics

| Feature | Description |
|---------|-------------|
| **Temperature Profile Management** | Pre-defined profiles: Pharma (2-8°C), Frozen (-18°C), Chilled (0-4°C), Ambient |
| **Mean Kinetic Temperature (MKT)** | Automatic MKT calculation for WHO/FDA compliance |
| **Excursion Alerts** | Immediate WhatsApp/SMS alerts when temp out-of-range |
| **Digital Temperature Loggers** | Continuous logging for regulatory audits |
| **Pre-Cooling Verification** | Ensure reefer at correct temp before loading |
| **Door Opening Alerts** | Alert on unauthorized door openings with location |
| **Calibration Tracking** | Sensor calibration schedules, certificates |
| **Compliance Reports** | Automated GDP (Good Distribution Practice) reports |

**Temperature Alert Workflow**
```
Sensor detects temp breach
         ↓
Immediate WhatsApp alert to driver + ops
         ↓
Driver acknowledges via mobile app
         ↓
If not resolved in 15min → Escalate to supervisor
         ↓
Auto-generate excursion report with GPS location
         ↓
Update shipment status to "Temperature Alert"
         ↓
Notify customer if excursion exceeds acceptable limits
```

---

### 4. **Cross-Border Compliance** *(New v2.0)*

Streamlined international freight with automated documentation and border management.

#### Supported Border Corridors

| Corridor | Borders | Key Features |
|----------|---------|--------------|
| **Northern** | Tanzania-Kenya, Kenya-Uganda, Uganda-Rwanda | EAC single customs territory integration |
| **Central** | Tanzania-DRC, Tanzania-Burundi, Tanzania-Rwanda | TRC (Tanzania Revenue Authority) pre-clearance |
| **Tazara** | Tanzania-Zambia | Railway-road intermodal tracking |
| **Southern** | Tanzania-Mozambique, Zambia-Malawi | SADC trade documentation |

#### Compliance Features

| Feature | Description |
|---------|-------------|
| **Digital Customs Documents** | EAWB, CMR, T1 transit declarations, customs invoices |
| **Permit Pre-Application** | Submit permits before vehicle arrives at border |
| **Temporary Importation (TI)** | Carnet management for vehicles entering foreign countries |
| **Border Wait Tracking** | Real-time queue status, estimated crossing time |
| **Transit Guarantees** | Bond management, insurance tracking |
| **Duty/VAT Calculation** | Automatic calculation based on cargo value, HS codes |
| **Document Checklist** | Per-shipment checklist: Invoice, Packing list, Certificate of Origin, etc. |
| **Digital Signatures** | Legal e-signatures on CMR, POD |
| **Compliance Calendar** | Track insurance expiry, road licenses, fitness certificates |

**Cross-Border Document Wallet**
```
┌─────────────────────────────────────────────────────────────┐
│  Shipment: SHP-2024-156 | Route: DAR → KGL                   │
│  Border Crossings: 1 (Namanga)                               │
├─────────────────────────────────────────────────────────────┤
│  Required Documents              Status      Expiry           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  ✓ Commercial Invoice            Valid       N/A            │
│  ✓ Packing List                  Valid       N/A            │
│  ✓ Certificate of Origin         Valid       2024-12-31     │
│  ✓ EAC Single Customs Document   Valid       Trip-specific  │
│  ✓ Vehicle Insurance             Valid       2024-09-15     │
│  ⚠ Temporary Import Permit       Expiring    2024-04-20     │
│  ✓ Driver License (Tanzania)     Valid       2025-03-10     │
│  ✓ Driver License (Kenya)        Valid       2024-08-22     │
│  ✓ Yellow Fever Card             Valid       2029-01-15     │
│  ⏳ Transit Guarantee Bond        Pending    Await approval   │
└─────────────────────────────────────────────────────────────┘
```

---

### 5. **Sustainability & Driver Safety** *(New v2.0)*

Calvary's commitment to "integrity, innovation, and sustainability" operationalized.

#### 5.1 Sustainability Tracking

| Metric | Tracking Method | Target |
|--------|----------------|--------|
| **CO₂ Emissions** | Fuel consumption × emission factor | < 85g CO₂/ton-km |
| **Fuel Efficiency** | GPS distance / fuel dispensed | > 3.5 km/liter |
| **Empty Running %** | Miles without cargo / total miles | < 15% |
| **Idling Time** | Engine on but stationary | < 8% of drive time |
| **Alternative Fuels** | Biodiesel, CNG usage tracking | 10% by 2026 |
| **Tire Lifecycle** | Mileage per tire set, retreading | 80,000 km |

**Sustainability Dashboard**
```
┌─────────────────────────────────────────────────────────────┐
│  Fleet Carbon Footprint - April 2024                        │
├─────────────────────────────────────────────────────────────┤
│  Total CO₂: 245.3 tonnes  │  Target: 230 tonnes (-6%)     │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  ████████████████████████████████████████░░░░░░░░░░░  │ │
│  │  Current (245t)    vs    Target (230t)              │ │
│  └───────────────────────────────────────────────────────┘ │
│  Best Performers:                                           │
│  1. T-782 (John Doe) - 4.2 km/l, 3.8t CO₂                  │
│  2. T-445 (Jane Smith) - 4.0 km/l, 4.1t CO₂                │
│  3. T-123 (Bob Wilson) - 3.9 km/l, 4.3t CO₂                │
│                                                             │
│  Improvement Actions:                                         │
│  • 3 drivers need eco-driving training                       │
│  • T-234 idling time 23% (target 8%) - investigate           │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2 Driver Safety Program

| Feature | Description |
|---------|-------------|
| **Fatigue Detection** | Driving hours tracking, mandatory rest alerts after 8h |
| **Speed Violation Alerts** | Real-time speeding alerts, weekly scorecards |
| **Harsh Driving Events** | Sudden acceleration, hard braking, sharp cornering |
| **Seatbelt Monitoring** | OBD-II seatbelt status alerts |
| **Accident Detection** | Automatic crash detection via accelerometer |
| **Emergency SOS** | Driver panic button → immediate GPS location to ops |
| **Safety Training** | Digital training modules, certification tracking |
| **Incident Reporting** | Photo/video evidence capture via mobile app |

**Driver Safety Scorecard**
```
┌─────────────────────────────────────────────────────────────┐
│  Driver: John Doe | ID: DRV-452 | Score: 94/100             │
├─────────────────────────────────────────────────────────────┤
│  Monthly Performance (April 2024)                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  ✅ Harsh Events: 2         │ Target: <5       │ +18 pts   │
│  ✅ Speed Violations: 0     │ Target: 0        │ +20 pts   │
│  ✅ Fatigue Alerts: 1       │ Target: <3       │ +18 pts   │
│  ✅ Delivery On-Time: 98%   │ Target: >95%     │ +20 pts   │
│  ✅ Customer Rating: 4.8/5   │ Target: >4.5     │ +18 pts   │
│                                                             │
│  Rewards Eligible:                                          │
│  • Safety Bonus: 50,000 TZS ✓                               │
│  • Driver of the Month nomination ✓                         │
│  • Priority route assignment ✓                               │
└─────────────────────────────────────────────────────────────┘
```

---

### 6. **Offline-First Driver Mobile App** *(New v2.0)*

React Native application with PWA fallback for drivers with intermittent connectivity.

#### Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OFFLINE-FIRST SYNC                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  React      │ ────→│  Redux      │ ────→│  SQLite/    │
│  Native     │      │  Persist    │      │  MMKV       │
│  UI         │      │  (State)    │      │  (Storage)  │
└─────────────┘      └─────────────┘      └─────────────┘
       │                                          │
       │              ┌─────────────┐             │
       └─────────────→│  Sync Queue │←────────────┘
                      │  (Offline   │
                      │   Actions)  │
                      └─────────────┘
                             │
                             ↓ (When online)
                      ┌─────────────┐
                      │  Supabase   │
                      │  Sync API   │
                      └─────────────┘
```

#### App Features

| Feature | Online Capability | Offline Capability |
|---------|-------------------|-------------------|
| **Trip Assignment View** | Real-time updates | Last-synced assignments |
| **Digital Trip Sheet** | Auto-submit on complete | Save locally, sync later |
| **GPS Tracking** | Real-time to server | Store path, upload batch |
| **Proof of Delivery** | Instant upload | Queue photos, auto-upload |
| **Digital Signature** | Real-time | Capture, sync on connection |
| **Chat with Dispatch** | WebSocket real-time | Queue messages |
| **Document Access** | Live download | Pre-synced trip docs |
| **Fuel/Expense Logging** | Real-time entry | Store, batch sync |
| **Break/Rest Tracking** | Real-time | Local timer, sync events |
| **SOS/Emergency** | Immediate alert | SMS fallback if no data |

#### Driver App Screens

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   LOGIN         │ │   TRIP LIST     │ │   ACTIVE TRIP   │
│                 │ │                 │ │                 │
│  📷 Photo       │ │  Today's Trips  │ │  [Live Map]     │
│  ID: _______    │ │  ━━━━━━━━━━━━  │ │                 │
│  PIN: ____      │ │  → KGL (2)     │ │  Next: Namanga  │
│                 │ │  → NBO (1)     │ │  ETA: 45 min    │
│  [Login]        │ │  → DAR (3)     │ │                 │
│  [Offline Mode] │ │                 │ │  [Arrived]      │
│                 │ │  [Start Trip]   │ │  [Issue]        │
└─────────────────┘ └─────────────────┘ └─────────────────┘

┌─────────────────┐ ┌─────────────────┐
│   POD CAPTURE   │ │   REEFER MONITOR│
│                 │ │                 │
│  📷 [Camera]    │ │  Temp: 4.2°C    │
│  [Retake]       │ │  Status: ✅ OK   │
│                 │ │                 │
│  Signature:     │ │  Last 4h:       │
│  ___________    │ │  ████████████   │
│                 │ │                 │
│  [Submit POD]   │ │  [Temp Log]     │
└─────────────────┘ └─────────────────┘
```

---

### 7. **Enhanced Trip Management** *(v2.0)*

Upgraded with AI, predictive capabilities, and mobile-first workflows.

#### Trip Status Flow (Enhanced)

```
DRAFT → CONFIRMED → ASSIGNED → PRE-TRIP CHECK → LOADING → DEPARTED → 
  │         │           │           │              │         │
  └────────→ CANCELLED  └────────→ REJECTED      └────────→ DELAYED
                                      
IN_TRANSIT → BORDER_CROSSING → DESTINATION_ARRIVED → UNLOADING → 
    │              │                   │                  │
    └────────────→ DEVIATION          └────────────────→ ACCIDENT
    
POD_CAPTURED → COMPLETED → INVOICED → PAID → ARCHIVED
     │            │          │         │
     └────────────→ EXCEPTION  └──────→ DISPUTED
```

#### AI-Powered Features

| Feature | Description | AI Model |
|---------|-------------|----------|
| **Predictive ETA** | ML-based arrival time using traffic, weather, historical patterns | Time-series forecasting |
| **Intelligent Routing** | Optimized routes considering traffic, fuel stops, driver hours | OpenRouteService + Grok |
| **Demand Forecasting** | Predict cargo volume by route, optimize fleet positioning | Seasonal ARIMA |
| **Risk Prediction** | Identify high-risk shipments (delays, damage, theft) | Classification model |
| **Optimal Pricing** | Dynamic pricing based on demand, distance, cargo type | Regression model |
| **Driver Matching** | Match driver experience to cargo complexity (lowbed, reefer) | Recommendation engine |
| **Chat Assistant** | Natural language queries: "Where is shipment ABC?" | Grok RAG |

#### AI Chat Assistant Example

```
┌─────────────────────────────────────────────────────────────┐
│  Calvary AI Assistant                                         │
├─────────────────────────────────────────────────────────────┤
│  User: What's the status of shipment SHP-2024-156?          │
│                                                             │
│  AI: Shipment SHP-2024-156 is IN TRANSIT                    │
│      • Cargo: Pharmaceuticals (Temperature controlled)       │
│      • Current location: 15km from Namanga border crossing   │
│      • ETA at destination (Kigali): Today 14:30 (+/- 30min) │
│      • Temperature: 4.2°C ✅ (within 2-8°C spec)            │
│      • Driver: John Doe (Contact: +255 712 345 678)         │
│                                                             │
│  [View on Map] [Notify Customer] [Contact Driver]           │
└─────────────────────────────────────────────────────────────┘
```

---

### 8. **Enhanced Financial Module** *(v2.0)*

Expanded with mobile money integration and automated reconciliation.

#### Payment Methods

| Method | Integration | Use Case |
|--------|-------------|----------|
| **M-Pesa** | Vodacom Open API | Tanzania customer payments |
| **Tigo Pesa** | Tigo API | Tanzania customer payments |
| **Airtel Money** | Airtel API | Tanzania customer payments |
| **Bank Transfer** | SWIFT/RTGS | Corporate invoicing |
| **Credit Terms** | AR aging | Trusted customers (Net 30) |

#### Mobile Money Flow

```
Customer Booking → Invoice Generated → SMS/WhatsApp Payment Link
                                           ↓
                              ┌─────────────────────┐
                              │  M-Pesa/Tigo/Airtel  │
                              │  STK Push / QR Code  │
                              └─────────────────────┘
                                           ↓
                              Customer Enters PIN → Payment Confirmed
                                           ↓
                              Webhook → System Updates Invoice → Receipt
                                           ↓
                              WhatsApp Receipt to Customer
```

#### Driver Payment Integration

| Payment Type | Method | Timing |
|--------------|--------|--------|
| **Daily Allowance** | Tigo Pesa | Auto-paid on trip completion |
| **Fuel Advance** | M-Pesa | On fuel request approval |
| **Border Fees** | Cash/Company card | Reimbursed with receipt |
| **Safety Bonus** | Mobile money | Monthly on scorecard |
| **Emergency Advance** | Instant transfer | On manager approval |

---

### 9. **WhatsApp Business Integration** *(New v2.0)*

Native WhatsApp Business API for customer and driver communication.

#### WhatsApp Features

| Feature | Trigger | Message Type |
|---------|---------|--------------|
| **Booking Confirmation** | Trip created | Template with trip ID, driver contact |
| **Pickup Notification** | Driver departed | "Your driver John is on the way (ETA 30min)" |
| **Transit Updates** | Every 2 hours or geofence | Location + ETA + map link |
| **Delivery Alert** | 30min from destination | "Arriving soon - please prepare" |
| **POD Confirmation** | POD captured | Photo + signature + timestamp |
| **Invoice** | Trip completed | PDF invoice with payment link |
| **Payment Receipt** | Mobile money received | Confirmation with transaction ID |
| **Temperature Alert** | Reefer excursion | URGENT: Temperature breach alert |
| **Delay Notification** | ETA deviation >1 hour | "Delayed due to traffic at border" |
| **Two-Way Chat** | Customer reply | AI-assisted human handoff |

---

### 10. **Inventory & Maintenance** *(Enhanced from v1.0)*

#### Enhanced Parts Management

| Feature | Description |
|---------|-------------|
| **Barcode/QR Scanning** | Mobile app scanning for parts lookup, stock counts |
| **Predictive Stock** | ML-based reorder suggestions based on usage patterns |
| **Vendor Management** | Supplier catalog, pricing, lead times |
| **Purchase Orders** | Auto-PO generation at reorder point |
| **Warranty Tracking** | Part warranty expiry alerts |
| **Serial Number Tracking** | Track individual high-value parts |

#### IoT-Enabled Maintenance

| Feature | Description |
|---------|-------------|
| **Predictive Maintenance** | OBD-II fault code analysis → maintenance scheduling |
| **Condition-Based Alerts** | Engine temp, oil pressure, brake wear warnings |
| **Service History** | Complete vehicle lifecycle maintenance record |
| **Downtime Tracking** | Vehicle availability %, MTTR, MTBF |
| **Maintenance Budgeting** | Cost forecasting based on fleet age/mileage |

---

## Expanded Database Schema v2.0

### New Core Entities

```sql
-- =================== SHIPMENTS (Customer-Facing) ===================
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_number VARCHAR(20) UNIQUE NOT NULL, -- SHP-2024-XXXXX
    customer_id UUID REFERENCES customers(id),
    booking_reference VARCHAR(50),
    
    -- Routing
    origin_city VARCHAR(100) NOT NULL,
    origin_country VARCHAR(50) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    destination_country VARCHAR(50) NOT NULL,
    planned_route JSONB, -- Array of waypoints with constraints
    
    -- Cargo Details
    cargo_description TEXT,
    cargo_type VARCHAR(50), -- 'GENERAL', 'REFRIGERATED', 'HAZARDOUS', 'OVERSIZED'
    cargo_weight_kg DECIMAL(10,2),
    cargo_volume_m3 DECIMAL(8,2),
    temperature_profile VARCHAR(20), -- 'PHARMA_2_8', 'FROZEN_MINUS_18', etc.
    
    -- Financial
    quoted_amount DECIMAL(12,2),
    final_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'TZS',
    payment_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PARTIAL, PAID, REFUNDED
    payment_method VARCHAR(30), -- MPESA, TIGO_PESA, AIRTEL_MONEY, BANK, CREDIT
    
    -- Status & Tracking
    status VARCHAR(30) DEFAULT 'DRAFT',
    current_location JSONB, -- {lat, lng, timestamp, address}
    progress_percent INTEGER DEFAULT 0,
    
    -- Cross-Border
    border_crossings JSONB, -- [{border_name, entry_time, exit_time, documents}]
    customs_status VARCHAR(50),
    
    -- Timestamps
    requested_pickup TIMESTAMP WITH TIME ZONE,
    actual_pickup TIMESTAMP WITH TIME ZONE,
    promised_delivery TIMESTAMP WITH TIME ZONE,
    predicted_eta TIMESTAMP WITH TIME ZONE,
    actual_delivery TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================== CUSTOMERS (B2B Portal) ===================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(200) NOT NULL,
    trading_name VARCHAR(200),
    tax_id VARCHAR(50),
    business_registration VARCHAR(100),
    
    -- Contact
    primary_email VARCHAR(255),
    primary_phone VARCHAR(50),
    billing_address JSONB,
    shipping_addresses JSONB, -- Array of frequent destinations
    
    -- Portal Access
    portal_enabled BOOLEAN DEFAULT FALSE,
    portal_users JSONB, -- [{user_id, email, role, last_login}]
    
    -- Financial
    credit_limit DECIMAL(12,2) DEFAULT 0,
    credit_terms_days INTEGER DEFAULT 0, -- 0 = prepay, 30 = Net 30
    current_balance DECIMAL(12,2) DEFAULT 0,
    total_shipments INTEGER DEFAULT 0,
    total_revenue DECIMAL(15,2) DEFAULT 0,
    
    -- Preferences
    notification_preferences JSONB, -- {whatsapp: true, sms: true, email: false}
    default_cargo_type VARCHAR(50),
    frequent_routes JSONB, -- Array of origin-destination pairs
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

-- =================== IOT SENSORS & TELEMETRY ===================
CREATE TABLE sensors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(100) UNIQUE NOT NULL, -- IMEI or MAC
    device_type VARCHAR(50), -- GPS_TRACKER, TEMP_SENSOR, FUEL_SENSOR, OBD_II
    vehicle_id UUID REFERENCES vehicles(id),
    trailer_id UUID REFERENCES trailers(id),
    
    -- Configuration
    sensor_config JSONB, -- {sampling_rate, alert_thresholds, calibration_date}
    installed_at TIMESTAMP WITH TIME ZONE,
    last_calibration TIMESTAMP WITH TIME ZONE,
    warranty_expiry DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, ERROR, MAINTENANCE
    battery_level INTEGER, -- For battery-powered sensors
    firmware_version VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TimescaleDB Hypertable for high-frequency sensor data
CREATE TABLE sensor_readings (
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    sensor_id UUID REFERENCES sensors(id),
    shipment_id UUID REFERENCES shipments(id),
    
    -- Location (for GPS)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    altitude DECIMAL(8, 2),
    speed_kmh DECIMAL(5, 2),
    heading DECIMAL(5, 2),
    accuracy_meters INTEGER,
    
    -- Temperature (for reefers)
    cargo_temp_celsius DECIMAL(4, 2),
    ambient_temp_celsius DECIMAL(4, 2),
    humidity_percent DECIMAL(5, 2),
    
    -- Vehicle Health (OBD-II)
    engine_rpm INTEGER,
    coolant_temp_celsius DECIMAL(5, 2),
    engine_load_percent DECIMAL(5, 2),
    fuel_level_percent DECIMAL(5, 2),
    odometer_km DECIMAL(10, 2),
    fault_codes TEXT[], -- Array of DTC codes
    
    -- Reefer Specific
    reefer_unit_status VARCHAR(20), -- RUNNING, STANDBY, ERROR
    door_open BOOLEAN,
    
    -- Additional telemetry
    additional_data JSONB -- Flexible schema for future sensors
);

-- Convert to TimescaleDB hypertable for automatic partitioning
SELECT create_hypertable('sensor_readings', 'time', chunk_time_interval => INTERVAL '1 day');

-- =================== COMPLIANCE DOCUMENTS ===================
CREATE TABLE compliance_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(50) NOT NULL, -- PERMIT, LICENSE, INSURANCE, CERTIFICATE
    document_category VARCHAR(50), -- VEHICLE, DRIVER, CARGO, COMPANY
    
    -- Reference
    reference_number VARCHAR(100) NOT NULL,
    linked_entity_type VARCHAR(50), -- VEHICLE, DRIVER, SHIPMENT, COMPANY
    linked_entity_id UUID,
    
    -- Document Details
    issuing_authority VARCHAR(200),
    issue_date DATE NOT NULL,
    expiry_date DATE,
    
    -- Files
    document_file_url VARCHAR(500),
    verification_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VERIFIED, EXPIRED, REJECTED
    
    -- Compliance Rules
    applicable_countries TEXT[], -- ['Tanzania', 'Kenya', 'Uganda']
    mandatory_for_cargo_types TEXT[], -- ['HAZARDOUS', 'OVERSIZED']
    
    -- Alerts
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_sent_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================== IMMUTABLE EVENT LOG (Chain of Custody) ===================
-- Critical for pharma/medical compliance - append-only, cryptographically verifiable
CREATE TABLE event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Event Classification
    event_type VARCHAR(50) NOT NULL, -- PICKUP, DELIVERY, TEMP_BREACH, BORDER_CROSS, SIGNATURE
    event_category VARCHAR(50), -- OPERATIONAL, COMPLIANCE, SAFETY, FINANCIAL
    severity VARCHAR(20) DEFAULT 'INFO', -- INFO, WARNING, CRITICAL, EMERGENCY
    
    -- References
    shipment_id UUID REFERENCES shipments(id),
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES user_profiles(id),
    sensor_id UUID REFERENCES sensors(id),
    
    -- Event Details
    event_data JSONB NOT NULL, -- Rich event payload
    location JSONB, -- {lat, lng, address, accuracy}
    
    -- Evidence
    photo_urls TEXT[],
    document_urls TEXT[],
    signature_data TEXT, -- Base64 encoded signature
    
    -- Verification (for compliance)
    verified_by UUID REFERENCES user_profiles(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_method VARCHAR(50), -- BIOMETRIC, OTP, MANUAL
    
    -- Immutable chain (optional blockchain anchoring)
    previous_hash VARCHAR(64), -- For chain verification
    event_hash VARCHAR(64), -- SHA-256 of event data
    blockchain_tx_hash VARCHAR(64), -- If anchored to blockchain
    
    -- Source
    source_system VARCHAR(50) DEFAULT 'CALVARY_OS', -- GPS_DEVICE, MOBILE_APP, API, IOT_SENSOR
    source_device_id VARCHAR(100),
    
    -- RLS: Append-only, no updates/deletes allowed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient shipment timeline queries
CREATE INDEX idx_event_log_shipment ON event_log(shipment_id, event_timestamp DESC);

-- =================== MOBILE MONEY TRANSACTIONS ===================
CREATE TABLE mobile_money_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_reference VARCHAR(100) UNIQUE NOT NULL,
    
    -- Transaction Details
    provider VARCHAR(20) NOT NULL, -- MPESA, TIGO_PESA, AIRTEL_MONEY
    transaction_type VARCHAR(20) NOT NULL, -- COLLECTION, DISBURSEMENT, REFUND
    
    -- Amount
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TZS',
    fees DECIMAL(10,2) DEFAULT 0,
    
    -- Parties
    sender_phone VARCHAR(20),
    sender_name VARCHAR(100),
    recipient_phone VARCHAR(20),
    recipient_name VARCHAR(100),
    
    -- Links
    invoice_id UUID,
    shipment_id UUID REFERENCES shipments(id),
    driver_id UUID REFERENCES user_profiles(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED, REVERSED
    provider_transaction_id VARCHAR(100),
    provider_status VARCHAR(50),
    
    -- Timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Webhook/Reconciliation
    webhook_received BOOLEAN DEFAULT FALSE,
    webhook_payload JSONB,
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP WITH TIME ZONE
);

-- =================== ROUTE CONSTRAINTS (Lowbed/Heavy) ===================
CREATE TABLE route_constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    constraint_type VARCHAR(50) NOT NULL, -- BRIDGE_WEIGHT_LIMIT, TUNNEL_HEIGHT, WIDTH_RESTRICTION
    
    -- Location
    start_lat DECIMAL(10, 8) NOT NULL,
    start_lng DECIMAL(11, 8) NOT NULL,
    end_lat DECIMAL(10, 8),
    end_lng DECIMAL(11, 8),
    
    -- Constraint Details
    limit_value DECIMAL(10, 2), -- e.g., 40000 kg, 4.2 meters
    limit_unit VARCHAR(20), -- KG, METER, PERCENT
    
    -- Applicability
    applicable_vehicle_types TEXT[], -- ['TRUCK_HEAD', 'LOWBED']
    applicable_countries TEXT[],
    
    -- Timing
    active_start_time TIME,
    active_end_time TIME,
    active_days TEXT[], -- ['Monday', 'Tuesday']
    
    -- Workaround
    bypass_route_description TEXT,
    requires_permit BOOLEAN DEFAULT FALSE,
    permit_type VARCHAR(50),
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================== SUSTAINABILITY TRACKING ===================
CREATE TABLE sustainability_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL,
    
    -- Reference
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES user_profiles(id),
    shipment_id UUID REFERENCES shipments(id),
    
    -- Emissions & Fuel
    fuel_consumed_liters DECIMAL(8, 2),
    distance_km DECIMAL(8, 2),
    co2_emissions_kg DECIMAL(8, 2),
    fuel_efficiency_km_per_liter DECIMAL(5, 2),
    
    -- Driving Behavior
    idling_minutes INTEGER,
    idling_fuel_liters DECIMAL(6, 2),
    harsh_acceleration_events INTEGER,
    harsh_braking_events INTEGER,
    speeding_events INTEGER,
    
    -- Eco Score
    eco_driving_score INTEGER, -- 0-100
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================== WHATSAPP MESSAGE LOG ===================
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Message
    message_type VARCHAR(50), -- TEMPLATE, TEXT, IMAGE, DOCUMENT
    template_name VARCHAR(100),
    recipient_phone VARCHAR(20) NOT NULL,
    recipient_type VARCHAR(20), -- CUSTOMER, DRIVER
    
    -- Content
    message_text TEXT,
    media_url VARCHAR(500),
    
    -- Links
    shipment_id UUID REFERENCES shipments(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'QUEUED', -- QUEUED, SENT, DELIVERED, READ, FAILED
    wa_message_id VARCHAR(100),
    
    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Response tracking
    reply_received BOOLEAN DEFAULT FALSE,
    reply_text TEXT,
    reply_received_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Geographic Coverage v2.0

### Expanded Coverage (11 Countries → 15+ Countries)

| Country | Major Hubs | Border Points | Specialization |
|---------|------------|---------------|----------------|
| **Tanzania** | Dar es Salaam, Arusha, Mwanza, Dodoma, Mbeya | Namanga, Tunduma, Rusumo, Mutukula, Holili | Base operations, port logistics |
| **Kenya** | Nairobi, Mombasa, Kisumu, Nakuru | Malaba, Busia, Namanga, Moyale | Northern corridor |
| **Uganda** | Kampala, Entebbe, Jinja, Mbarara, Arua | Malaba, Busia, Mutukula, Nimule | Transit to S. Sudan |
| **Rwanda** | Kigali, Rubavu, Rusumo | Gatuna, Rusumo, Kagitumba | EAC trade |
| **Burundi** | Bujumbura, Gitega, Ngozi | Kabanga, Kobero, Gatumba | Central corridor |
| **DRC** | Lubumbashi, Kinshasa, Goma, Bukavu, Uvira | Kasumbalesa, Bunagana, Kavimvira | Mining logistics |
| **Zambia** | Lusaka, Ndola, Kitwe, Livingstone | Nakonde, Kasumbalesa, Katima Mulilo | Copper belt, Tazara |
| **Malawi** | Lilongwe, Blantyre, Mzuzu | Mchinji, Muloza, Dedza | Agriculture corridor |
| **Mozambique** | Maputo, Beira, Nacala, Tete | Machipanda, Ressano Garcia, Namaacha | Coal, gas logistics |
| **South Sudan** | Juba, Nimule, Wau, Malakal | Nimule, Kaya, Jale | Humanitarian, oil |
| **Ethiopia** | Addis Ababa, Dire Dawa, Moyale, Hawassa | Moyale, Galafi, Humera | Manufacturing, coffee |
| **Zimbabwe** | Harare, Bulawayo, Mutare | Forbes Border, Nyamapanda | Mining, agriculture |
| **Botswana** | Gaborone, Francistown | Pioneer Gate, Ramatlabama | Mining corridor |
| **Namibia** | Windhoek, Walvis Bay, Rundu | Ariamsvlei, Ngoma, Oshikango | Port logistics |
| **South Africa** | Johannesburg, Durban, Cape Town | Lebombo, Beitbridge, Komatipoort | Major trade hub |

### Enhanced Trade Corridors

| Corridor | Route | Distance | Avg Transit | Key Cargo |
|----------|-------|----------|-------------|-----------|
| **Northern** | Mombasa-Nairobi-Kampala-Kigali-Bujumbura | 1,420 km | 4-5 days | General cargo, containers |
| **Central** | Dar-Dodoma-Kigoma-Goma-Bukavu | 1,680 km | 6-7 days | Mining equipment, transit |
| **Tazara** | Dar-Mbeya-Nakonde-Lusaka | 1,860 km | 4-6 days | Copper, agricultural |
| **Lobito** | Dar-Itigi-Kigoma-Lubumbashi-Lobito | 2,400 km | 8-10 days | Mining, heavy equipment |
| **Beira** | Beira-Tete-Lilongwe-Lusaka | 1,200 km | 4-5 days | Coal, agricultural |
| **Walvis Bay** | Lusaka-Mongu-Katima Mulilo-Rundu-Walvis | 2,100 km | 5-7 days | Mining, fish |

---

## Phased Implementation Roadmap

### Phase 1: MVP (Months 1-3) — Foundation

**Goal**: Core operational platform with basic tracking and customer portal

| Sprint | Deliverable | Key Features |
|--------|-------------|--------------|
| **Weeks 1-2** | Project Setup | Supabase config, CI/CD, team onboarding |
| **Weeks 3-4** | Auth & Users | SSO, roles, driver mobile app (basic) |
| **Weeks 5-6** | Fleet Management | Vehicles, trailers, assignments |
| **Weeks 7-8** | Trip Management | Basic trips, GPS tracking integration |
| **Weeks 9-10** | Customer Portal | Booking, tracking, basic notifications |
| **Weeks 11-12** | Financial Core | Chart of accounts, invoicing, mobile money (M-Pesa) |

**MVP Success Criteria:**
- [ ] 50+ vehicles tracked in real-time
- [ ] 10+ B2B customers using portal
- [ ] 100+ trips managed monthly
- [ ] Mobile money payments live
- [ ] Driver app in production

---

### Phase 2: Enhancement (Months 4-6) — Intelligence

**Goal**: Advanced features for efficiency and compliance

| Sprint | Deliverable | Key Features |
|--------|-------------|--------------|
| **Weeks 13-14** | Reefer Module | Temperature monitoring, cold chain compliance |
| **Weeks 15-16** | Lowbed Module | Route constraints, permit management, escort coordination |
| **Weeks 17-18** | Cross-Border | Digital customs docs, border wait tracking |
| **Weeks 19-20** | AI Integration | Predictive ETAs, intelligent routing, demand forecasting |
| **Weeks 21-22** | WhatsApp Integration | Full customer communication automation |
| **Weeks 23-24** | Advanced Analytics | Sustainability tracking, driver scorecards, optimization |

**Phase 2 Success Criteria:**
- [ ] 5+ reefer units with full temp compliance
- [ ] 10+ lowbed shipments with route optimization
- [ ] 95% on-time delivery rate
- [ ] 30% reduction in manual customer service
- [ ] AI predictions 85%+ accurate

---

### Phase 3: Scale (Months 7-12) — Expansion

**Goal**: Multi-country operations, advanced integrations, ecosystem

| Quarter | Deliverable | Key Features |
|---------|-------------|--------------|
| **Q3** | Regional Expansion | Kenya, Uganda operations, cross-border automation |
| **Q3** | Partner API | Open API for freight forwarders, 3PLs |
| **Q4** | IoT Ecosystem | Fuel sensors, OBD-II, predictive maintenance |
| **Q4** | Advanced Mobile | Offline-first driver app v2.0, customer mobile app |
| **Q4** | Warehouse Integration | WMS integration for end-to-end logistics |

**Phase 3 Success Criteria:**
- [ ] Operations in 3+ countries
- [ ] 5+ API partners integrated
- [ ] 500+ vehicles on platform
- [ ] 50+ B2B customers
- [ ] 20-35% operational cost reduction achieved

---

### Phase 4: Optimization (Year 2) — World-Class

**Goal**: Autonomous logistics, AI-first operations

| Feature | Description | Target |
|---------|-------------|--------|
| **Autonomous Dispatch** | AI assigns drivers, vehicles, routes automatically | 80% auto-assigned |
| **Dynamic Pricing** | Real-time rates based on demand, fuel, capacity | Margin +5% |
| **Predictive Maintenance** | IoT-driven preventive maintenance | Downtime -40% |
| **Blockchain Bills of Lading** | Immutable shipping documents | 100% digital B/L |
| **Carbon Neutral Shipping** | Offset calculation, green logistics options | 100% offset option |

---

## Integration Architecture

### Mobile Money Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    PAYMENT GATEWAY LAYER                     │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  M-Pesa API  │    │ Tigo Pesa    │    │ Airtel Money │
│  (Vodacom)   │    │ API          │    │ API          │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
              ┌────────────┴────────────┐
              │    Payment Router       │
              │  (Automatic failover)   │
              └────────────┬────────────┘
                           │
              ┌────────────┴────────────┐
              │   Calvary OS Backend     │
              │  (Webhook handlers,        │
              │   reconciliation)         │
              └───────────────────────────┘
```

### GPS/IoT Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVICE LAYER                              │
└─────────────────────────────────────────────────────────────┘

GPS Device (Queclink/CalAmp)
    │ HTTP POST / MQTT
    ↓
┌─────────────────────────────────────────────────────────────┐
│  IoT Gateway (AWS IoT / EMQX / Custom)                       │
│  • Protocol translation                                      │
│  • Device authentication                                     │
│  • Message queuing                                            │
└─────────────────────────────────────────────────────────────┘
    │
    ├────────────────┬────────────────┐
    ↓                ↓                ↓
┌─────────┐    ┌─────────┐    ┌─────────────┐
│Real-time│    │ Timescale│    │  Alert      │
│WebSocket│    │   DB     │    │  Engine     │
│ to Web  │    │(History) │    │ (Rules)     │
└─────────┘    └─────────┘    └─────────────┘
                                     │
                                     ↓
                              ┌─────────────┐
                              │ WhatsApp/   │
                              │ SMS Alerts  │
                              └─────────────┘
```

### WhatsApp Business API Integration

```
┌─────────────────────────────────────────────────────────────┐
│              WHATSAPP BUSINESS API FLOW                        │
└─────────────────────────────────────────────────────────────┘

Customer WhatsApp
       │
       ↓
┌──────────────────┐     ┌──────────────────┐
│  Meta Business    │ ←→ │  Calvary OS       │
│  API (WhatsApp)   │     │  Webhook Handler  │
└──────────────────┘     └────────┬─────────┘
                                │
                    ┌───────────┼───────────┐
                    ↓           ↓           ↓
              ┌─────────┐ ┌─────────┐ ┌─────────┐
              │  AI     │ │  Human  │ │ Auto    │
              │ Chatbot │ │ Handoff │ │ Response│
              │ (Grok)  │ │         │ │         │
              └─────────┘ └─────────┘ └─────────┘
```

---

## Security & Compliance v2.0

### Enhanced Security Architecture

| Layer | Implementation |
|-------|---------------|
| **Authentication** | Supabase Auth + MFA (TOTP/SMS) |
| **Authorization** | RLS policies + ABAC (Attribute-Based) |
| **Encryption** | At-rest (AES-256), in-transit (TLS 1.3) |
| **Secrets** | AWS Secrets Manager / HashiCorp Vault |
| **API Security** | Rate limiting, JWT validation, IP allowlisting |
| **Audit** | Immutable event log, SIEM integration |

### Compliance Certifications Target

| Standard | Status | Timeline |
|----------|--------|----------|
| **GDPR** | Compliant | Live |
| **ISO 27001** | In Progress | Q3 2024 |
| **SOC 2 Type II** | Planned | Q1 2025 |
| **WHO GDP** | Compliant (Cold Chain) | Live |
| **FDA 21 CFR Part 11** | Compliant (Digital signatures) | Live |
| **EAC Customs** | Compliant | Live |
| **PCI DSS** | Compliant (Payments) | Live |

---

## Performance & Scalability Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Web App Load** | < 2 seconds | Lighthouse |
| **Mobile App Start** | < 3 seconds | React Native |
| **API Response** | < 200ms (p95) | Supabase metrics |
| **GPS Update Latency** | < 5 seconds | WebSocket |
| **Concurrent Users** | 10,000+ | Load testing |
| **IoT Ingestion** | 100,000 events/min | TimescaleDB |
| **Uptime SLA** | 99.95% | Status page |
| **Database Size** | 10TB+ | PostgreSQL |

---

## Success Metrics & KPIs

### Operational KPIs

| KPI | Baseline | 6-Month Target | 12-Month Target |
|-----|----------|----------------|-----------------|
| **On-Time Delivery** | 75% | 90% | >95% |
| **Customer Satisfaction** | 3.5/5 | 4.3/5 | 4.7/5 |
| **Cost per KM** | 100% | -15% | -25% |
| **Vehicle Utilization** | 65% | 78% | 85% |
| **Empty Running** | 25% | 15% | <10% |
| **Accident Rate** | 100 | -30% | -50% |
| **Driver Retention** | 75% | 85% | 90% |

### Financial KPIs

| KPI | Baseline | 6-Month Target | 12-Month Target |
|-----|----------|----------------|-----------------|
| **Revenue Growth** | 100% | +20% | +45% |
| **Gross Margin** | 18% | 22% | 28% |
| **Days Sales Outstanding** | 45 days | 30 days | 15 days |
| **Mobile Money Adoption** | 10% | 50% | 80% |
| **Cost per Shipment** | 100% | -20% | -35% |

### Sustainability KPIs

| KPI | Baseline | 12-Month Target |
|-----|----------|-----------------|
| **CO₂ per Ton-KM** | 85g | 70g (-18%) |
| **Fuel Efficiency** | 3.2 km/l | 3.8 km/l (+19%) |
| **Idling Time** | 12% | <8% |
| **Paperless Operations** | 30% | 95% |

---

## Support & Training

### Training Program

| Audience | Format | Duration | Topics |
|----------|--------|----------|--------|
| **Drivers** | Mobile app video + hands-on | 2 hours | App usage, GPS, POD capture |
| **Dispatchers** | Webinar + documentation | 4 hours | Trip management, AI tools, alerts |
| **Customers** | Self-service portal guide | 1 hour | Booking, tracking, payments |
| **Admin/Finance** | In-person workshop | 1 day | Full system, reporting, reconciliation |
| **Mechanics** | Mobile app training | 2 hours | Parts requests, service logging |

### Support Structure

| Level | Channel | Response | Handles |
|-------|---------|----------|---------|
| **L1** | WhatsApp Bot + FAQ | Instant | Password reset, booking help, tracking |
| **L2** | Email + Phone | 2 hours | Technical issues, integration support |
| **L3** | Dedicated CSM | 4 hours | B2B customer issues, custom requests |
| **L4** | Engineering | 24 hours | Bugs, feature requests, API issues |

---

## Conclusion

**Calvary Logistics OS v2.0** represents the evolution from a traditional fleet management system to a world-class, AI-powered logistics operating system. By integrating real-time GPS/IoT tracking, mobile money payments, cold chain compliance, and predictive analytics, Calvary Investment Company Ltd will achieve:

- **20-35% operational cost reduction** through optimized routing and reduced empty miles
- **>95% on-time delivery performance** via predictive ETAs and proactive exception management
- **Competitive differentiation** in Tanzania and East African logistics market
- **Sustainable operations** with measurable carbon footprint reduction
- **Scalable growth** supporting expansion to 500+ vehicles and multi-country operations

### Key Transformation Points v1.0 → v2.0

| Aspect | v1.0 | v2.0 |
|--------|------|------|
| **Customer Experience** | Phone/email only | Self-service portal + WhatsApp + real-time tracking |
| **Proof of Delivery** | Paper-based, 2-3 days | Digital with photo + signature, instant |
| **Cold Chain** | Manual logs | Continuous IoT monitoring + automated compliance |
| **Cross-Border** | Manual paperwork | Digital documents + pre-clearance + border tracking |
| **Driver Tools** | Radio/phone | Offline-first mobile app with digital trip sheets |
| **Payments** | Cash/invoice 30-day | Mobile money instant collection + reconciliation |
| **Data** | Relational only | Time-series IoT + immutable event log + AI analytics |
| **AI Usage** | Basic route suggestions | Predictive ETAs, intelligent routing, demand forecasting |

### Investment Summary

| Phase | Timeline | Investment | ROI Timeline |
|-------|----------|------------|--------------|
| **MVP** | Months 1-3 | $75,000 | Month 6 |
| **Enhancement** | Months 4-6 | $100,000 | Month 9 |
| **Scale** | Months 7-12 | $150,000 | Month 12 |
| **Total Year 1** | 12 months | $325,000 | 18-month payback |

---

**Document Version:** 2.0  
**Last Updated:** April 2026  
**System Status:** MVP Development Ready  
**Next Review:** July 2026 (Post-MVP)

---

*Calvary Logistics OS — Transforming African Logistics Through Technology, Integrity, and Innovation.*
