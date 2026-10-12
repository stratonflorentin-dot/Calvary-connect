# Devin Task List: API Anything Integration for Calvary Connect Logistics System

## Overview
This document provides a comprehensive task list for Devin to integrate **API Anything** (https://github.com/goodnight000/api-anything) into the Calvary Connect fleet management system. The goal is to extract APIs from logistics-relevant websites and integrate them into the Tanzanian fleet management platform.

---

## Repository Context
- **Main Project**: `D:\my projects\fleet management` (Calvary Connect - Next.js 15, Supabase, MapLibre)
- **API Anything Repo**: `D:\my projects\fleet management\temp-api-anything` (cloned from https://github.com/goodnight000/api-anything)
- **Target**: Build logistics-specific API integrations for Tanzanian market

---

## Phase 1: Setup & Foundation (Week 1)

### Task 1.1: Install & Verify API Anything
- [ ] Navigate to `D:\my projects\fleet management\temp-api-anything`
- [ ] Run `npm ci && npm install -g "$(npm pack --silent)"`
- [ ] Verify installation: `api-anything call hacker-news search query=sqlite`
- [ ] Configure MCP server: `claude mcp add --scope user api-anything -- api-anything mcp`
- [ ] Test MCP connection in Claude Code

### Task 1.2: Explore Existing Operations
- [ ] List all available sites: `api-anything ops`
- [ ] Document all 22 operations across 9 sites
- [ ] Test each operation to understand response formats
- [ ] Create a catalog of available data sources

### Task 1.3: Set Up Development Environment
- [ ] Install Chrome/Chromium for operation creation
- [ ] Configure browser profiles for login import
- [ ] Set up `~/.api-anything` credentials directory
- [ ] Create test scripts for each operation

---

## Phase 2: Logistics-Relevant API Extraction (Weeks 2-3)

### Task 2.1: Freight & Shipping Sites
**Priority: HIGH** - Core logistics operations

| Site | Operations Needed | Use Case |
|------|------------------|----------|
| **Freightos** | Rate search, booking, tracking | Spot rate comparison, instant booking |
| **Flexport** | Shipment tracking, customs docs | International freight visibility |
| **FreightRight** | Rate quotes, carrier matching | Carrier procurement |
| **DAT Solutions** | Load board, rate analytics | Spot market rates, lane analysis |
| **Truckstop.com** | Load search, carrier onboarding | Capacity sourcing |
| **Convoy** | Instant quotes, tracking | Digital brokerage |
| **Uber Freight** | Load matching, real-time tracking | Carrier network |

### Task 2.2: African Logistics Sites
**Priority: CRITICAL** - Tanzania-specific

| Site | Operations Needed | Use Case |
|------|------------------|----------|
| **Sendy** (Kenya) | Quote, book, track | Last-mile delivery East Africa |
| **Lori Systems** | Load matching, tracking | Cross-border East Africa |
| **Kobo360** | Truck booking, tracking | Nigeria/Ghana/West Africa |
| **Truck Lagbe** | Truck booking | Bangladesh (model for Africa) |
| **Alerzo** | B2B distribution | Nigeria retail logistics |
| **Jetstream Africa** | Cross-border freight | Ghana/Nigeria corridors |
| **Trella** | Trucking marketplace | Egypt/Middle East |

### Task 2.3: Port & Customs APIs
**Priority: HIGH** - Border operations

| Site | Operations Needed | Use Case |
|------|------------------|----------|
| **Tanzania Ports Authority** | Vessel schedules, berth status | Port operations planning |
| **TRA Customs (Tanzania)** | Declaration status, duty calc | Customs clearance |
| **Kenya Revenue Authority** | Customs clearance | Kenya border ops |
| **Uganda Revenue Authority** | Customs clearance | Uganda border ops |
| **Rwanda Revenue Authority** | Customs clearance | Rwanda border ops |
| **Zambia Revenue Authority** | Customs clearance | Zambia border ops |

### Task 2.4: Fuel & Maintenance
**Priority: MEDIUM** - Cost optimization

| Site | Operations Needed | Use Case |
|------|------------------|----------|
| **Shell/BP/Total** | Fuel prices, station locator | Fuel cost optimization |
| **Vivo Energy** | Fuel cards, pricing | Fleet fuel management |
| **Oryx Energies** | Fuel pricing Africa | Regional fuel costs |
| **Truck parts suppliers** | Parts pricing, availability | Maintenance procurement |

### Task 2.5: Mapping & Routing
**Priority: HIGH** - Route optimization

| Site | Operations Needed | Use Case |
|------|------------------|----------|
| **Google Maps/OSRM** | Route calc, traffic, tolls | Already in MapLibre |
| **HERE Maps** | Truck routing, restrictions | Truck-specific routing |
| **TomTom** | Traffic, routing, POIs | Real-time traffic |
| **OpenStreetMap** | Free routing, offline | Offline capability |

---

## Phase 3: Custom Operation Creation (Weeks 3-4)

### Task 3.1: Create Tanzanian Logistics Operations
For each priority site, create operations using the API Anything skill:

```bash
# Example pattern for each site
api-anything add <site-name> <operation-name> \
  --trigger '<url-with-{placeholder}>' \
  --example <param1>=<value1> --example2 <param1>=<value2> \
  --match <css-selector> \
  --html '<field-extraction-json>'
```

### Task 3.2: Specific Operations to Build

#### 3.2.1 Tanzania Ports Authority
- [ ] `vessel_schedule` - Get vessel arrivals/departures
- [ ] `berth_status` - Real-time berth occupancy
- [ ] `cargo_tracking` - Container status at port

#### 3.2.2 TRA Customs
- [ ] `declaration_status` - Check customs declaration status
- [ ] `duty_calculator` - Calculate import duties/taxes
- [ ] `transit_bond` - Manage transit bonds for landlocked countries

#### 3.2.3 Sendy / Lori Systems
- [ ] `quote_delivery` - Get instant delivery quotes
- [ ] `book_delivery` - Book last-mile delivery
- [ ] `track_shipment` - Real-time tracking

#### 3.2.4 Fuel Price Aggregator
- [ ] `fuel_prices` - Current prices by station/region
- [ ] `station_locator` - Nearest stations with prices

#### 3.2.5 Border Crossing APIs
- [ ] `border_wait_times` - Real-time queue times
- [ ] `required_documents` - Document checklist per border
- [ ] `transit_bond_status` - Bond validation

---

## Phase 4: Integration into Calvary Connect (Weeks 4-6)

### Task 4.1: Create API Service Layer
- [ ] Build `src/lib/external-apis.ts` - Unified service for all external APIs
- [ ] Implement caching layer (Redis) for API responses
- [ ] Add rate limiting and retry logic
- [ ] Create TypeScript types for all API responses

### Task 4.2: Integrate into Existing Features

#### 4.2.1 Fleet Map Enhancement
- [ ] Add real-time fuel prices to map markers
- [ ] Show border wait times on map
- [ ] Display port congestion alerts
- [ ] Add SGR train positions to map

#### 4.2.2 Dispatch Optimization
- [ ] Integrate spot rates from Freightos/DAT
- [ ] Add carrier scorecards from external data
- [ ] Auto-suggest backhaul opportunities
- [ ] Dynamic pricing based on market rates

#### 4.2.3 Cold Chain Monitoring
- [ ] Integrate port reefer status
- [ ] Add customs clearance ETAs
- [ ] Border crossing temperature logs

#### 4.2.4 Financial Integration
- [ ] Real-time fuel costs in CPM calculations
- [ ] Customs duties in landed cost
- [ ] M-Pesa payment verification

### Task 4.3: Build API Management UI
- [ ] Admin page to monitor API health
- [ ] Rate limit dashboard
- [ ] Cache hit/miss metrics
- [ ] Manual cache invalidation
- [ ] API key management

---

## Phase 5: Advanced Features (Weeks 6-8)

### Task 5.1: Predictive Analytics
- [ ] Demand forecasting using external market data
- [ ] Fuel price forecasting
- [ ] Border delay prediction
- [ ] Seasonal rate trends

### Task 5.2: Automated Workflows
- [ ] Auto-book capacity when rates drop
- [ ] Auto-re-route around border delays
- [ ] Auto-switch fuel suppliers
- [ ] Auto-generate customs docs

### Task 5.3: Partner Marketplace
- [ ] Expose APIs for other Tanzanian logistics companies
- [ ] Revenue sharing model
- [ ] White-label API access

---

## Technical Specifications for Devin

### Environment Variables Needed
```env
# API Anything
API_ANYTHING_MCP=true
API_ANYTHING_CACHE_TTL=300

# External APIs (to be configured as operations are built)
FREIGHTOS_API_KEY=
DAT_API_KEY=
SENDY_API_KEY=
LORI_API_KEY=
TRA_CUSTOMS_API_KEY=
TPA_API_KEY=
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
TIGO_PESA_API_KEY=
AIRTEL_MONEY_API_KEY=
SHELL_FUEL_API_KEY=
VIVO_ENERGY_API_KEY=
```

### File Structure to Create
```
src/
├── lib/
│   ├── external-apis.ts          # Main service layer
│   ├── api-cache.ts              # Redis caching
│   ├── rate-limiter.ts           # Per-API rate limiting
│   ├── api-types.ts              # TypeScript interfaces
│   └── api-health.ts             # Health monitoring
├── app/api/external/
│   ├── freight-rates/route.ts
│   ├── fuel-prices/route.ts
│   ├── border-wait-times/route.ts
│   ├── port-status/route.ts
│   ├── customs/route.ts
│   └── sgr-schedules/route.ts
├── components/external-apis/
│   ├── FuelPriceMap.tsx
│   ├── BorderWaitTimes.tsx
│   ├── PortCongestion.tsx
│   └── MarketRates.tsx
└── scripts/
    ├── sync-external-rates.ts
    ├── warm-api-cache.ts
    └── monitor-api-health.ts
```

### API Response Standards
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryAfter?: number;
  };
  meta: {
    source: string;
    cached: boolean;
    fetchedAt: string;
    expiresAt: string;
  };
}
```

---

## Testing Requirements

### Unit Tests
- [ ] Each external API service
- [ ] Cache invalidation logic
- [ ] Rate limiting enforcement
- [ ] Error handling & retries

### Integration Tests
- [ ] End-to-end API calls
- [ ] Cache hit/miss scenarios
- [ ] Rate limit exceeded handling
- [ ] Auth token refresh

### Load Tests
- [ ] 1000 req/min sustained
- [ ] Cache warm-up performance
- [ ] Concurrent user simulation

---

## Deliverables for Devin

### Week 1 Deliverables
- [ ] API Anything installed and working
- [ ] All 22 existing operations tested and documented
- [ ] Development environment ready

### Week 2-3 Deliverables
- [ ] 15+ new operations for logistics sites
- [ ] Operation catalog with parameters/examples
- [ ] Test scripts for each operation

### Week 4-6 Deliverables
- [ ] `external-apis.ts` service layer
- [ ] 6+ API route endpoints
- [ ] 4+ React components for map/dashboard
- [ ] Admin monitoring UI

### Week 7-8 Deliverables
- [ ] Predictive analytics integration
- [ ] 3+ automated workflows
- [ ] Documentation & runbooks

---

## Success Criteria

| Metric | Target |
|--------|--------|
| API response time (cached) | <50ms |
| API response time (fresh) | <2s |
| Cache hit rate | >85% |
| API uptime | >99.5% |
| Operations created | 20+ |
| Sites integrated | 10+ |
| Cost per API call | <$0.01 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Site blocks API Anything | Browser fallback built-in; repair mechanism |
| Site changes break operations | Auto-repair on replay failure |
| Rate limits exceeded | Built-in rate limiting + exponential backoff |
| Auth tokens expire | Auto-refresh from browser profile |
| Site terms of service | Review each site's ToS before production |

---

## Communication Protocol

- **Daily standup**: 9:00 AM EAT (async via GitHub issues)
- **Weekly demo**: Friday 3:00 PM EAT
- **Blockers**: Immediate Slack/GitHub notification
- **Code review**: All PRs require review before merge

---

## Resources for Devin

- **API Anything Docs**: `D:\my projects\fleet management\temp-api-anything\docs\`
- **Skill Guide**: `D:\my projects\fleet management\temp-api-anything\skills\api-anything\SKILL.md`
- **Benchmarks**: `D:\my projects\fleet management\temp-api-anything\bench\README.md`
- **Calvary Connect Codebase**: `D:\my projects\fleet management\src\`
- **Existing API Patterns**: `D:\my projects\fleet management\src\lib\api-gateway.ts`

---

## Next Steps

1. **Devin starts with Task 1.1** - Install and verify API Anything
2. **Daily progress updates** via GitHub issues
3. **Week 1 review** - Adjust scope based on learnings
4. **Iterate** - Build, test, integrate, repeat

---

*This task list is a living document. Update as priorities shift and discoveries are made.*