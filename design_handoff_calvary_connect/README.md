# Handoff: Calvary Connect — fleet, driver and role screens

## Overview

Calvary Connect is the internal fleet, logistics, operations and finance platform for
Calvary Investment Company Ltd (Dar es Salaam, Tanzania). The existing app is a Next.js +
Supabase codebase with 40+ routes across seven roles.

This bundle covers a **redesign of the operational and role screens**: a live tracking
console, twenty-four role pages across all seven roles, and a wireframe board that records
the layout alternatives and the argument behind the finance rework.

Three deliverables, all HTML:

| File | What it is | Fidelity |
|---|---|---|
| `Calvary Connect - Tracking Console.dc.html` | Operator's live tracking console — 6 units, 6 detail tabs, working filters/search | **Hi-fi** |
| `Calvary Connect - Role Screens.dc.html` | All 7 roles × 4 pages each, one app shell with working nav | **Hi-fi** |
| `Fleet & Driver Wireframes.dc.html` | Layout exploration + the finance logic proposal (turn 2, option `2e`) | **Lo-fi** |

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing
intended look and behavior. They are **not production code to copy directly**.

They are authored as "Design Components" (`.dc.html`) with a small proprietary template
runtime (`support.js`, `<sc-for>`, `<sc-if>`, `{{ }}` holes). **Do not port that runtime.**
Read them as specifications and rebuild the screens in the existing Next.js codebase using
its established patterns — App Router pages under `src/app/<role>/`, the existing component
library, Tailwind config and Supabase client.

Two files must be opened alongside the prototype to render it:
- `_ds/industry-cc3b9f68-d2e0-441e-9337-42c19f04e1a4/styles.css` — the design system
- `support.js` — the template runtime

## Fidelity

**Hi-fi** for the tracking console and the role screens. Colors, type scale, spacing,
motion timings and copy are final — recreate them faithfully using the codebase's existing
libraries. Every number, plate, driver name and TSh amount in the mocks is realistic
placeholder data modeled on the repo's own seed data; **replace it with live Supabase
queries**, don't hardcode it.

**Lo-fi** for the wireframe board. Use it for structure, flow and the finance argument —
not for styling.

---

## Design system: "Industry"

A wireframe-industrial system: steel-blue on paper, hairline rules, registration marks,
condensed headings over tabular monospace data. All of it is in
`_ds/industry-.../styles.css` — **read that file first**; the tokens below are lifted
from it.

### Design tokens

```
--color-bg          paper background
--color-text        primary ink
--color-divider     hairline rule (1px borders everywhere)
--color-accent      steel-blue accent (single accent, used sparingly)
--color-accent-400  light fill
--color-accent-700  link / emphasis
--color-accent-800  warning text
--color-accent-900  darkest — driver app header, "expires today"
--font-heading      condensed display face
--font-body         body face
```

Derived values used throughout (all via `color-mix`, never new hex codes):

| Purpose | Value |
|---|---|
| Secondary text | `color-mix(in srgb, var(--color-text) 58%, transparent)` |
| Tertiary / labels | `color-mix(in srgb, var(--color-text) 50-55%, transparent)` |
| Row hover | `color-mix(in srgb, var(--color-text) 4%, transparent)` |
| Nav hover | `color-mix(in srgb, var(--color-text) 5%, transparent)` |
| Selected / flagged row | `color-mix(in srgb, var(--color-accent) 7-8%, transparent)` |
| Active nav item bg | `color-mix(in srgb, var(--color-accent) 10%, transparent)` |
| Table cell divider | `color-mix(in srgb, var(--color-text) 8%, transparent)` |
| Blueprint grid line | `color-mix(in srgb, var(--color-text) 4%, transparent)` |
| Hatch fill (placeholder) | `color-mix(in srgb, var(--color-text) 7%, transparent)` |

### Typography scale

| Role | Spec |
|---|---|
| Page title (`h2`) | `--font-heading`, 26–28px, `letter-spacing: -.01em` |
| Section heading (`h4`) | `--font-heading`, ~15px, weight 600 |
| Card heading (`h5`) | `--font-heading`, ~13px, weight 600 |
| Big figure | `--font-heading`, 24–29px, `line-height: .92`, `letter-spacing: -.02em` |
| Body | `--font-body`, 12.5–13px, `line-height: 1.55–1.65` |
| Micro-label (`.rs-lbl`) | 9.5px, `letter-spacing: .14em`, uppercase, 50% ink |
| Table header | 9.5px, `letter-spacing: .11em`, uppercase, weight 400, 55% ink |
| Data / mono | `ui-monospace, "SF Mono", Menlo, monospace`, `font-variant-numeric: tabular-nums`, `letter-spacing: -.01em` |

**Rule:** all identifiers, quantities, dates, money and coordinates render in the mono
face with tabular numerals. Prose and labels render in the body face. This contrast is
the core of the aesthetic — don't collapse it.

### Spacing and structure

- Page padding `18px 22px 26px`; header padding `17px 22px 15px`
- Card padding `13px 14px`; table cells `10px 9px`; table headers `8px 9px`
- Section gap `16–18px`; card inner gap `9–11px`
- **Everything is a 1px hairline border.** No shadows, no border-radius anywhere.
- Metric strips: `display: grid` + `gap: 1px` on a `--color-divider` background, each cell
  `background: var(--color-bg)` — the gap *is* the rule.
- 48px blueprint grid on the page background (both axes), 4% ink.
- Registration marks: `.blueprint` + four `<i class="corner tl|tr|bl|br">` children mark
  framed objects. Used on every card. This is the system's signature.
- Photo placeholders: 135° hatch, `1px 7px` repeat.

### Motion

Single easing curve throughout: `cubic-bezier(.16, 1, .3, 1)`.

| Animation | Spec |
|---|---|
| Pane entrance | `translateY(12px)` → 0, opacity 0→1, 250ms, panes staggered 0 / 50 / 100ms |
| Row/card entrance | `translateY(8px)` → 0, 150ms, staggered 35ms per item |
| Hover transitions | 150ms on `background`, `color`, `border-color`, `transform` |
| Card hover | `translateY(-1px)` + accent border |
| Button press | `transform: scale(.97)` |
| Progress/bar fill | `width` transition 350ms |
| Live pulse | opacity 1 → .4 → 1, 1.9s infinite |
| Accent scan sweep | `translateX(-100% → 300%)`, 5.5s linear infinite, 22%-wide gradient |

`@media (prefers-reduced-motion: reduce)` disables all of the above — already implemented,
carry it over.

---

## Screens

### A. Tracking Console (`Calvary Connect - Tracking Console.dc.html`)

Three-column full-height layout, no page scroll — each column scrolls independently.

```
grid-template-columns: 196px  minmax(264px, 340px)  minmax(430px, 1fr)
```

**Column 1 — rail (196px).** Logo in a `.blueprint.duotone` frame
(`filter: grayscale(1) contrast(1.05)`), wordmark, nav (Dashboard, Dispatch, Tracking,
Live fleet map, Sales handover, Trips, Fleet), a "Requests" group (Fuel 3, Repair 2,
Parts 2), an "Insight" group (Analysis, History). Footer: pulsing accent dot +
"Telematics live", user chip.

**Column 2 — unit list.** Title + live "{n} shown" count, search input, partner filter
chips (5 clients, multi-select toggle), status segment (All / Active / Idle). Below: a
2-column grid of unit cards — plate (mono, bold), status tag, departure time, origin,
km-left, destination, hatched photo slot, 4px progress bar. Selected card gets an accent
border and 8% accent wash. Empty state: "No units match" + reset button.

**Column 3 — detail.** Sticky header: trip id (mono, 26px), pulsing status tag, plate ·
driver, Call/Chat buttons, then a horizontally-scrollable tab strip with the scrollbar
hidden. Six tabs:

1. **Shipping info** — 4-cell metric strip (live elapsed clock ticking every second,
   distance left, ETA, fuel + km/L); load gauge (170px hatched elevation + accent fill bar
   with the percentage right-aligned inside the fill and a scan sweep overlay); route map
   placeholder + 4 leg columns; 5 cargo photo slots with captions; route requests table.
2. **Vehicle info** — photo, spec sheet showing **real `public.vehicles` column names**
   (`plate_number`, `type`, `status`, `mileage`, `next_maintenance_due`,
   `insurance_expiry`, `current_fuel_level`), 4-cell metric strip, maintenance table,
   assigned crew.
3. **Documents** — insurance / road licence / TBS inspection / SUMATRA permit / transit
   bond, with expiry and remaining-days tags. Missing documents get a row, not silence.
4. **Client** — consignor card (contract, rate basis, open balance, contact) + delivery
   instructions.
5. **Billing** — 4-cell strip (revenue, cost to date, margin, invoice state); line table
   with a `Posts to` column naming the ledger account (`4000 Revenue`, `2200 VAT`,
   `5100 Fuel`, `5300 Allowances`, `5400 Tolls`); posting note.
6. **Sales handover** — the sales↔operator channel. Thread pinned to the trip, own
   messages right-aligned with accent border, working composer (appends on send); sidebar
   with "Booking as sold" (quotation, agreed rate, promised ETA), an ETA variance panel,
   and open asks either side owes.

**Interactive behavior.** Selecting a unit re-renders the whole detail column from that
unit's record. Partner chips are multi-select; status segment is exclusive; search matches
plate, trip, driver, origin, destination and model. The elapsed clock advances once per
second from each trip's own start offset (`setInterval` in `componentDidMount`, cleared on
unmount).

### B. Role Screens (`Calvary Connect - Role Screens.dc.html`)

Two-column shell: `210px` rail + main. Rail lists six role homes; header carries a
page-tab row. **24 pages total** (6 roles × 4). All are built.

| Role | Pages |
|---|---|
| **CEO** | Executive · Financial performance · Fleet performance · Approvals |
| **Operator** | Dispatch · Trips register · Live fleet map · Inventory & parts |
| **Accountant** | Dashboard · Customer invoices · Expenses & fuel · Reconciliation |
| **HR** | People · Payroll & allowances · Leave · Driver compliance |
| **Mechanic** | Service queue · Spare parts · Service history · Schedule |
| **Driver** | Home · My trips · Fuel · Expenses |

Selected pages worth calling out:

- **CEO / Executive** — 6-metric strip, income-vs-expense bar chart (paired bars: solid
  accent for income, hatched outline for expense), AI insights as
  highlight / concern / recommendation, active trips table.
- **CEO / Financial performance** — corridor profitability table with inline margin bars;
  revenue by client with a concentration-risk note; **currency exposure table listing TZS,
  USD, KES separately with their rates** — never summed.
- **CEO / Fleet performance** — utilization by `vehicles.type` (`DUMP_TRUCK`,
  `TRUCK_HEAD`, `TRAILER`, `ESCORT_CAR`), worst five by cost/km, idle-capacity cost.
- **Operator / Dispatch** — live map, a merged "Needs a decision now" queue (unassigned
  bookings + delays + breakdowns + missing PODs, each row carrying the action that clears
  it), and the sales channel with a working composer.
- **Operator / Live fleet map** — 430px map, attention list (GPS offline 46 min, stopped
  2 h 10 m, off-route +18 km), 4-cell telemetry strip, unit list with headings.
- **Accountant / Dashboard** — **one dashboard replacing four** (`/finance`,
  `/finance/dashboard`, `/finance/cfo-dashboard`, `/premium-dashboard`); cash shown per
  currency; "Waiting on you" queue where approve **and** post is one action; period-close
  gate disabled with a blocking count.
- **Accountant / Customer invoices** — status lifecycle `draft → posted → part-paid →
  paid → reversed` with an `Allocated` column, so partial settlement is ordinary.
- **Accountant / Reconciliation** — statement vs ledger balance, difference, suggested
  matches with the reason for each match.
- **HR / Driver compliance** — expiring documents with a **Consequence** column
  ("Cannot be dispatched"), because expiry is a grounding event, not a date.
- **Mechanic / Service queue** — queue on the left, open job card on the right (work
  performed, parts issued from inventory, condition segment, next-service mileage,
  "Complete & release vehicle" which sets `vehicles.status = available` and posts the cost).
- **Mechanic / Schedule** — due by mileage **and** by date, whichever first, with progress
  bars against `next_maintenance_due`.
- **Driver (all four)** — 390px phone frame, `--color-accent-900` header, **48px+ hit
  targets**, no nested tabs, bottom tab bar. Only the two actions that generate company
  data (status update, POD upload) are filled buttons. A delivered trip with no POD gets
  its own status and the only filled button in the list.

### C. Wireframes (`Fleet & Driver Wireframes.dc.html`)

Two turns, newest first, on a pan/zoom canvas. Turn 1 = fleet + driver layout
alternatives (`1a` register vs `1b` utilization board; `1f` single-active-trip driver home
vs `1g` step checklist). Turn 2 = all seven role homes plus **`2e`, the finance logic
proposal** — read this before implementing any finance screen.

---

## The finance proposal (option `2e`) — read this first

Derived from the repo's own `FINANCE_MODULE_AUDIT_REPORT.md` and
`docs/finance-erp-audit.md`. Every claim traces to those documents.

**Current state.** Revenue can be created three ways (`/income`, `/finance/income`,
invoices) and expenses three ways, so AR depends on which door was used. `accounts` (157
rows) and `chart_of_accounts` (12) both exist; so do three fuel tables and two audit
systems. Journals carry both `is_posted` and `status`, both `date` and `entry_date`;
invoices carry `amount`, `total_amount` and `total_payable`. Paid-ness is a column on the
invoice, so partial payments and allocation don't exist. Counterparties are free-text
`client_name` / `vendor_name` strings. TZS, USD, EUR and KES are summed together on several
dashboards. Nothing closes, and any authenticated writer can set `status='posted'` from the
browser.

**Seven rules to implement.**

1. **One door per direction.** Money in enters only as an invoice; money out only as a bill
   or expense claim. Old income pages become read-only registers.
2. **Everything lands in the ledger.** No document is financial until it posts a balanced
   journal. `accounts` is the only chart; retire the duplicates.
3. **Status is the single truth.** `draft → posted → reversed`. Posted documents are
   immutable; corrections are auto-generated reversals, never edits.
4. **Payments are their own object.** A receipt allocates across invoices. Customer and
   vendor balances become **views** over invoices minus allocations, not mutable columns.
5. **Every amount carries its currency.** Aggregates group by currency and convert at the
   booking rate. No screen shows a mixed-currency total.
6. **Periods close.** A month is open / closed / locked; posting into a closed period is
   refused; the close gate lists what blocks it.
7. **Posting is a server privilege.** Approve and post run behind an API route gated on the
   accountant role — never a browser write. Document numbering is issued by the database.

**Retire:** `chart_of_accounts`, `income`, `sales`, `fuel_records`, `fuel_tracking`,
`audit_trail`, the `client_balances` table, `professional-accounting.tsx` (3,300-line
embedded app), and three of the four finance dashboards.

**Add:** `fiscal_periods`, `payments` + `payment_allocations`, database numbering
sequences, `/api/finance/*` for approve / post / reverse, mobile money as a first-class
treasury account, counterparty foreign keys.

**Deliberately out of scope:** cheque management, a petty-cash sub-module, a fixed-asset
register, cost centres, debit notes.

**Trip-to-cash flow** (the path the business actually runs on, with no re-typing):

```
Trip delivered + POD uploaded   (driver app)
  → invoice auto-drafted        (trip rate + VAT rate)
  → accountant approves & posts  DR 1200 AR · CR 4000 Revenue · CR 2200 VAT
  → receipt recorded             DR 1000 Bank · CR 1200 AR
  → allocated to invoice         (partial allowed; balance is a view)
  → per-trip profit              revenue − fuel − allowance − tolls
```

---

## State management

Both hi-fi prototypes are single components with local state only. Map to your data layer:

**Tracking console**
```
sel       string    selected vehicle id
tab       string    shipping | vehicle | docs | client | billing | handover
mode      string    all | active | idle
partners  string[]  multi-select client filter
query     string    search text
tick      number    1 Hz counter driving the elapsed clock
thread    Message[] sales↔operator messages
draft     string    composer text
```

**Role screens**
```
screen    string    ceo | ops | fin | hr | mech | driver
page      string    per-role page key (main | fin | fleet | appr | …)
thread    Message[] sales channel
draft     string    composer text
```

Derived, not stored: filtered unit list, the selected unit's record, the formatted clock,
active/idle counts.

Data requirements — all Supabase, all already in the schema: `vehicles`, `trips`,
`drivers`/`employees`, `fuel_logs`, `expenses`, `invoices`, `payments`, `service_requests`,
`inventory`, `audit_logs`, plus the `trip_accounting` and `expense_by_category` views.
Positions come from telematics on a 30s interval; the map needs a real geo library
(markers rotate to heading).

## Assets

`assets/logo-full.png`, `assets/logo-mark.png` — copied from the repo's own `public/`
directory. The mark is full-colour and glossy; the design renders it through the Industry
`.duotone` blueprint frame with `filter: grayscale(1) contrast(1.05)` so it reads as steel
rather than clashing with the mono palette. Use the originals in the real app and decide
whether to keep that filter.

All photography is placeholder (hatched slots labeled with what belongs there): vehicle
photographs, loading-bay / weighbridge / tarpaulin / odometer cargo reports, driver
portraits, and the brand still on the sign-in screen. **Real photography is needed.**

Maps are placeholders. No icon set is used anywhere — the design deliberately relies on
type and rules instead.

## Files in this bundle

```
Calvary Connect - Tracking Console.dc.html   hi-fi operator console
Calvary Connect - Role Screens.dc.html       hi-fi, 24 role pages
Fleet & Driver Wireframes.dc.html            lo-fi board + finance proposal 2e
_ds/industry-.../styles.css                  design system — read this
support.js                                   template runtime — do NOT port
assets/logo-full.png, logo-mark.png          from the repo's public/
```

To view: open any `.dc.html` in a browser with the folder structure intact.
