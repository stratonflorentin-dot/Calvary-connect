# Role Playbook — how each role works, mapped to the app

_Grounds the "role by role" program in how these jobs actually run in a cross-border trucking
operation (Dar → Tunduma → Lusaka corridor), then maps each role to its pages and the gaps to close.
Role boundaries vary by company — treat duties as typical, confirm against how Calvary actually runs._

Research sources: dispatcher/ops/fleet duties & KPIs —
[Truckbase dispatcher KPIs](https://www.truckbase.com/blog/top-10-truck-dispatcher-kpis-for-optimizing-fleet-operations),
[Fleetio fleet-manager guide](https://www.fleetio.com/blog/your-complete-guide-to-being-a-fleet-manager),
[Indeed transport manager](https://www.indeed.com/hire/job-description/fleet-manager);
accountant/storekeeper/mechanic —
[jobdescription.org fleet mechanic](https://jobdescription.org/jobs/transportation/fleet-mechanic),
[City storekeeper JD](https://www.citystaug.com/DocumentCenter/View/5241/Storekeeper-II-Fleet),
trucking-accounting postings. TZ tax/finance context in [finance-tz-standards-audit.md](docs/finance-tz-standards-audit.md).

## Per-role map

### OPERATOR (dispatcher + operations)
- **Mandate:** the coordination hub — assign loads to trucks/drivers, keep trips moving, hit on-time delivery.
- **Core tasks:** build & dispatch trips, monitor live positions, resolve exceptions, confirm PODs, watch SLAs.
- **KPIs:** on-time delivery, driver/asset utilization, empty running, load acceptance, exceptions open.
- **App pages:** `/dispatch`, `/trips`, `/map`, `/operations/dashboard`, `/operations/pod`, `/approvals`, `OperatorView`.
- **Gaps / improve:** surface **on-time %, utilization, empty-leg** on the dashboard (currently queue-focused); exception/overdue trip tile; one-click POD follow-up.

### DRIVER
- **Mandate:** execute the trip safely and document it.
- **Core tasks:** see assigned trips, start/deliver, log fuel, upload POD, report vehicle issues, raise expenses/advances.
- **KPIs:** on-time, fuel efficiency, incident count, POD completeness.
- **App pages:** `/driver/trips`, `/driver/fuel`, `/driver/expenses`, `/driver/maintenance`, `/proof`, `/operations/pod`, `DriverView`.
- **Gaps / improve:** mobile-first polish (this is a phone role); clearer "next action" on current trip; offline-sync status visible (sync exists in provider).

### MECHANIC
- **Mandate:** keep vehicles safe, legal, and available.
- **Core tasks:** work maintenance queue, weekly fleet checks, record actual cost, request parts, flag outside repairs for approval.
- **KPIs:** preventive-maintenance compliance, downtime, repeat repairs, cost per vehicle.
- **App pages:** `/service-requests`, `/maintenance`, `/parts-requests`, `/spare-parts`, `/fleet`, `MechanicView`.
- **Gaps / improve:** **PM-due compliance %** KPI; downtime per vehicle; link parts request → maintenance record so costs roll up.

### ACCOUNTANT
- **Mandate:** the books — AR/AP, bank, GL, tax, reporting.
- **Core tasks:** invoice clients, verify vendor bills (fuel/parts coded to the right truck), pay expenses, reconcile bank, run VAT/WHT & statutory, close the period, produce IFRS statements.
- **KPIs:** DSO/aging, cash position, reconciliation status, tax filed on time, close cycle time.
- **App pages:** `/finance/*` (GL, journals, trial balance, AR/AP, banking, reports, tax-reports), `AccountantView`.
- **Gaps / improve:** apply the **TZ tax upgrades** (PAYE/SDL/WHT — done, pending TRA figures); **VAT withholding** + **EFD fiscal receipts** (open); cost-per-vehicle coding on vendor bills; aging/DSO tile on dashboard.

### CASHIER
- **Mandate:** front-line cash — petty cash, disbursements, cash requests, day-end.
- **Core tasks:** issue/record petty cash, disburse approved cash requests, reconcile the till, hand off to accounting at day-end.
- **KPIs:** till variance, unretired advances, overdue floats.
- **App pages:** `/finance/petty-cash`, `/finance/cash-requests`, `/finance/accounting/day-end-closings`, `/finance/accounting/journal-entries`, `CashierView`.
- **Gaps / improve:** **unretired-advance** and **overdue-float** tiles; day-end variance front-and-centre; cashier default lands on petty-cash (already set).

### SALESMAN
- **Mandate:** win and keep freight business.
- **Core tasks:** manage leads → quotations → contracts; convert to bookings/shipments; track revenue; client comms.
- **KPIs:** pipeline value, win rate, quote→booking conversion, revenue booked.
- **App pages:** `/sales`, `/sales/leads`, `/sales/dashboard`, `/quotations`, `/customers`, `/admin/contracts`, `/bookings`, `/shipments`, `/email`, `SalesmanDashboard`.
- **Gaps / improve:** **conversion-rate** and **pipeline-by-stage** on dashboard; stale-lead/quote follow-up queue; quote→contract→shipment continuity check.

### HR
- **Mandate:** people — hiring, leave, discipline, performance, payroll inputs, driver compliance.
- **Core tasks:** employee records, leave approvals, disciplinary/separation cases, performance reviews, run payroll, track driver licence/compliance expiry.
- **KPIs:** headcount, leave liability, open cases, licence-expiry risk, payroll on time.
- **App pages:** `/users`, `/drivers`, `/hr/*` (leave, disciplinary, separation, performance, meetings, insurance, my-hr), `/allowances` (payroll), `/admin/hr/*`, `HRView`.
- **Gaps / improve:** **licence/compliance-expiry** tile (driver-compliance page exists — surface it); open-cases and pending-leave tiles; payroll-run status.

### WAREHOUSE_STAFF
- **Mandate:** stores — receive, store, issue parts/supplies; keep perpetual inventory accurate.
- **Core tasks:** receive stock, issue against parts requests, reorder low stock, stock counts.
- **KPIs:** stockouts, low-stock items, request turnaround, shrinkage.
- **App pages:** `/inventory`, `/parts-requests`, `/spare-parts`, `WarehouseView` (added Phase 0.4).
- **Gaps / improve:** **issue-against-request** flow from the dashboard; reorder suggestions; stock-count feature.

### ADMIN / CEO
- **Mandate:** oversight and control.
- **Core tasks:** full access, approvals, exec KPIs, audit, settings, role/permission management, AI insights.
- **App pages:** everything; `/premium-dashboard`, `/management`, `/audit`, `/settings`, `/ai-insights`, `/company-ai`, `AdminDashboard`/`CeoView`.
- **Gaps / improve:** exec KPI accuracy (ties to the finance/ops metrics above); ensure role-permission overrides UI reflects the now-enforced guard.

## Cross-cutting improvement themes (from the map)

1. **Dashboards should lead with each role's real KPIs**, not just work queues — on-time/utilization (Operator), PM-compliance/downtime (Mechanic), aging/cash (Accountant), pipeline/conversion (Salesman), expiry/cases (HR), stockouts (Warehouse), variance/unretired (Cashier).
2. **Continuity checks** along the core chains (sales→shipment→trip→invoice; PO→receive→bill→pay; maintenance→parts→cost).
3. **Mobile-first** for Driver.
4. Finance depth already tracked in the finance audit (VAT withholding, EFD).

## Suggested execution

Improve one role's dashboard per pass (KPI tiles + quick actions matched to the playbook), highest-use
first: **Operator → Accountant → Mechanic → Salesman → HR → Cashier → Driver**. Each pass is a small,
self-contained, build-verifiable change; runtime per-role verification needs a login for that role.
