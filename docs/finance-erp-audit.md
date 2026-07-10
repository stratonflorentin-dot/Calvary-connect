# Finance Module — ERP Audit & Reorganization Plan

Audited 2026-07-10 against the live Supabase database (116 tables), the Next.js
app (`src/app/finance/**`, 40+ pages), `src/lib/route-config.ts`, and existing
API routes. Benchmark: Dynamics 365 BC, NetSuite, SAP B1, Odoo.

---

## Step 1 — Current state audit

### 1.1 What actually exists (live database)

**Seeded / in use**

| Table | Rows | Role |
|---|---|---|
| `accounts` | 157 | Full chart of accounts (code, category, parent_code, opening/current balance, currency, is_bank_account) |
| `financial_categories` | 22 | Income/expense category tree (parent_id self-FK) |
| `exchange_rates` | 14 | FX rates (from/to/rate/effective_date) |
| `chart_of_accounts` | 12 | **Duplicate** of `accounts`, simpler shape |
| `journal_entries` / `journal_entry_lines` | 3 / 4 | Double-entry core, wired to `accounts.code` |
| `bank_accounts` | 1 | Banking master |
| `rate_sheets` | 24 | Pricing (sales side) |
| `vehicles` / `user_profiles` | 20 / 3 | Operational masters |

**Empty but structurally sound (keep)**: `expenses`, `invoices`, `revenue`,
`budgets`, `bank_statements`, `taxes`, `trip_accounting`, `vehicle_expenses`,
`client_balances`, `vendor_balances`, `customers`, `departments`,
`payroll_runs`, `driver_allowances`, `mobile_money_transactions`,
`cash_requests`, `financial_reports`.

**Database views already present** (good — reuse, don't rebuild in JS):
`trial_balance` (157 rows, live), `profit_loss_summary`,
`monthly_financial_summary`, `expense_by_category`, `revenue_by_customer`.

### 1.2 Problems found

**P1 — Duplicate tables (violates single source of truth)**

| Keep | Retire (empty or redundant) | Why |
|---|---|---|
| `accounts` (157) | `chart_of_accounts` (12) | Same concept; `accounts` has hierarchy, categories, balances and is what `journal_entry_lines`, `bank_statements`, `vehicle_expenses`, `trip_accounting` FK into |
| `exchange_rates` (14) | `currency_exchange_rates` (0) | Identical purpose |
| `customers` | `clients` (1 column!), `client_balances` as a table | `clients` is a stub; `client_balances` should be a **view** over invoices/receipts, not a mutable table |
| `expenses` | `purchases` (0) | `purchases` duplicates vendor expense capture |
| `audit_logs` | `audit_trail` | Two parallel audit systems in code (`AuditService` vs `AuditTrailService`) |
| `fuel_logs` | `fuel_records`, `fuel_tracking` | Three fuel tables, all empty |
| `revenue` + `invoices` | `income` (0), `sales` (0) | `income`/`sales` are flat ledgers superseded by invoice → receipt flow |

**P2 — Denormalization / schema drift**

- `invoices` has ~60 columns: `amount` + `total_amount` + `total_payable`,
  `items` (jsonb) + `line_items` (jsonb), `client_name` (text) + `customer_name`
  (text) + `customer_id` (uuid, **no FK constraint**). Two generations of
  schema fused into one table.
- `journal_entries`: `is_posted` boolean **and** `status` text; `date` **and**
  `entry_date`. Ambiguous truth.
- `accounts`: both `balance` and `current_balance`; `type` and `account_type`.
- Counterparties stored as free-text names (`vendor_name`, `client_name`)
  instead of FKs → aging and statements can't be trusted.

**P3 — Missing accounting components** (vs BC/NetSuite/SAP B1/Odoo)

- No `fiscal_periods` / period close & locking
- No `payments`/`receipts` table with allocation lines (paid state lives as
  columns on `invoices` — no partial payments, no allocation)
- No fixed assets register or depreciation
- No recurring journals / recurring invoices
- No withholding-tax ledger (only `wht_amount` columns on invoices)
- No document numbering sequences (numbers generated client-side, race-prone)
- No approval workflow tables (approvals are status strings)

**P4 — Navigation vs filesystem mismatch** *(fixed during this audit)*

`route-config.ts` declared 9 finance paths that had no pages
(`/finance/receivables/*`, `/finance/payables/*`, `cash-accounts`,
`internal-transfers`, `fleet-profitability`) while the 15 real pages
(`/finance/invoicing/*`, `/finance/transactions/*`, `/finance/fleet-finance/*`)
were unregistered — hence unreachable from nav and ungated. Route-config now
points at real pages only.

**P5 — Security**

- All finance pages query Supabase **directly from the browser** with the anon
  key; there is no `/api/finance/*` layer. Authorization = RLS + client-side
  `useRole()` checks. Client-side role checks are cosmetic; RLS coverage is
  inconsistent (e.g. `truck_insurance` blocked everything, chat policies were
  self-defeating — both found broken this week).
- Posting/approval is not privileged: any authenticated user who can write a
  row can set `status='posted'`.
- `SUPABASE_SERVICE_ROLE_KEY` exists in `.env.production` — verify it is never
  bundled client-side (currently only server files import it — keep it that way).

**P6 — Performance**

- Mostly moot at current volume (tables are empty), but: client pages fetch
  entire tables (`select('*').limit(500)`) and aggregate in JS while unused DB
  views (`monthly_financial_summary`, `expense_by_category`) already do this
  server-side. No pagination anywhere. No indexes beyond PKs visible on hot
  filters (`expenses.date`, `invoices.status`, `journal_entries.entry_date`).

**P7 — Multi-currency**

Company transacts in TZS/USD/EUR/KES. Amount columns exist with `currency`
columns, and `exchange_rates` is seeded — but pages sum across currencies
without conversion in several dashboards. Every aggregate must group by
currency or convert at booking rate. (This is a standing rule for this repo.)

---

## Step 2 — Target information architecture

Grouped by accounting workflow. Every leaf maps to an existing page (✔), a
rename/move (→), or a small number of genuinely new pages (★). No page is
built for features the business doesn't use (no cheque management, no
entertainment expenses — Rules: no unnecessary features).

```
Finance
├─ Dashboard                    ✔ /finance (hub) + /finance/dashboard + /finance/cfo-dashboard → merge into one
├─ General Ledger
│  ├─ Chart of Accounts         ✔ /finance/accounting/chart-of-accounts  (backed by `accounts`)
│  ├─ Journal Entries           ✔ /finance/accounting/journal-entries
│  ├─ General Ledger            ✔ /finance/accounting/general-ledger
│  ├─ Trial Balance             ✔ /finance/accounting/trial-balance      (use `trial_balance` view)
│  ├─ FX Rates                  ✔ /finance/accounting/fx-rates           (backed by `exchange_rates`)
│  ├─ Fiscal Periods & Close    ★ /finance/accounting/periods            (needs `fiscal_periods` table)
│  └─ Budgets                   ★ /finance/accounting/budgets            (table `budgets` exists, no page)
├─ Banking
│  ├─ Bank Accounts             ✔ /finance/banking/bank-accounts
│  ├─ Bank Transactions         ✔ /finance/transactions/bank-transactions → move under /finance/banking
│  ├─ Bank Statements           ✔ /finance/banking/bank-statements
│  ├─ Reconciliation            ✔ /finance/banking/bank-reconciliation
│  └─ Mobile Money              ★ page over existing `mobile_money_transactions` (M-Pesa/Tigo — TZ reality)
├─ Receivables
│  ├─ Customers                 ✔ /customers (shared with Sales — link, don't duplicate)
│  ├─ Customer Invoices         ✔ /finance/invoicing/customer-invoices
│  ├─ Receipts / Payments       ✔ /finance/transactions/payments (split AR/AP views)
│  ├─ Credit Notes              ✔ /finance/invoicing/credit-notes
│  ├─ Aging Report              ✔ /finance/reports/aging-report
│  └─ Customer Statements       ★ statement print view from invoices+receipts
├─ Payables
│  ├─ Vendor Bills              ✔ /finance/invoicing/vendor-bills
│  ├─ Vendor Payments           ✔ same payments page, AP tab
│  └─ Vendor Aging              ✔ aging-report, AP tab
├─ Expenses
│  ├─ Expense Claims            ✔ /expenses (driver/ops capture) + /accountant/expenses (approval)
│  ├─ Expense Transactions      ✔ /finance/transactions/expenses
│  └─ Fleet Costs               ✔ /finance/fleet-finance/* (fuel, maintenance, vehicle & route profitability)
├─ Payroll & Statutory          ✔ /allowances (runs) + /admin/hr/payroll/statutory (PAYE/NSSF/NHIF/SDL/WCF)
├─ Taxes
│  ├─ VAT / Tax Reports         ✔ /finance/reports/tax-reports (backed by `taxes` + invoice VAT columns)
│  └─ Withholding Tax           part of tax-reports, fed by invoice `wht_amount`
├─ Reports                      ✔ /finance/reports (hub built this week)
│  P&L, Balance Sheet, Cash Flow, Trial Balance, Aging,
│  Revenue/Expense Analysis, Reconciliation, Tax          — all exist
└─ Administration
   ├─ Currencies & FX           ✔ fx-rates
   ├─ Audit Logs                ✔ /audit
   ├─ Approvals                 ✔ /approvals
   └─ Accounting Settings       ★ /finance/settings (numbering, default accounts, VAT rate)
```

Not building (deliberately): cheque management, petty-cash sub-module (use a
cash-type bank account), assets register (phase 4 candidate — no asset data
exists), cost centers/projects (departments table exists; add only when
someone budgets by department), mileage/travel/entertainment expense types
(categories cover this), debit notes (credit notes + bills suffice at this
size).

## Step 3 — Decision per existing menu/page

| Current item | Decision | Reason |
|---|---|---|
| `/finance` hub + `/finance/dashboard` + `/finance/cfo-dashboard` + `/premium-dashboard` | **Merge → one `/finance` dashboard** with role-aware depth | Three dashboards compute the same KPIs differently; numbers disagree |
| `/finance/professional-accounting.tsx` (3,300 lines, embedded mini-app) | **Delete after extracting** the account-detail drawer it uniquely owns | Duplicates CoA, journals, reconciliation pages; unroutable monolith; `.backup` copy also committed — delete |
| `/finance/accounting/chart-of-accounts` | **Improve** | Point at `accounts` (157) exclusively; kill `chart_of_accounts` reads |
| `/finance/accounting/journal-entries` | **Improve** | Add post/reverse workflow; forbid edit-after-post |
| `/finance/accounting/general-ledger`, `trial-balance` | **Improve** | Read the `trial_balance` DB view instead of recomputing in JS |
| `/finance/reports/trial-balance` vs `/finance/accounting/trial-balance` | **Merge** (keep reports copy as print view or delete) | Same report twice |
| `/finance/income` + `/income` | **Delete pages**; revenue enters via invoices/trips | `income` table empty; parallel entry path corrupts AR |
| `/finance/transactions/revenue` | **Keep** as read-only register of posted revenue | |
| `/finance/banking/*` | **Keep**, move bank-transactions here | Coherent treasury group |
| `/finance/invoicing/*` | **Rename group → Receivables/Payables** in nav only (URLs stay — Rule: backward compatibility) | Match accounting language |
| `/finance/fleet-finance/*` (4 pages) | **Keep** | This is the differentiator vs generic ERP — per-vehicle/route P&L |
| `/finance/reports/*` (10 pages + hub) | **Keep**, dedupe trial balance, wire to DB views | |
| `/expenses`, `/accountant/expenses`, `/finance/transactions/expenses` | **Keep all three, one table** | Capture → approve → ledger register is a proper workflow, but all must read/write `expenses` only |
| `/monthly-report`, `/report`, `/reports` | **Merge** `/report` + `/monthly-report` into `/reports` | Three entry points confuse |
| `bank-statement`/`chart-of-accounts` legacy aliases | Fixed this week — links repointed | |

## Step 4 — Page standard

Every finance list page gets, in priority order (top tier = build now, rest as
needed): summary cards (`StatCard`), professional table (`SectionCard
padded=false`), search + status filter, date-range filter, CSV export,
pagination (server-side, 50/page), status chips (`cv-chip-*`), row actions,
empty state with CTA, loading skeleton — all already available in
`src/components/shell`. Second tier: print view, bulk actions, saved filters,
attachments (Supabase storage), approval history, audit trail drawer (from
`audit_logs`), keyboard shortcuts. Dark mode and responsive layout come free
from the token system as long as pages stop hardcoding `text-gray-*`/`bg-white`
(see Step 8).

## Step 5 — Core workflows

**Customer invoice (AR)**
```
Draft → Approve → Post ──────────→ Receipt → Allocate → Paid
        (role ≥ ACCOUNTANT) │                │
                            │                └─ partial → Partially Paid
                            └─ auto journal: DR 1200 AR / CR 4000 Revenue (+CR 2200 VAT)
Receipt posts: DR 1000 Bank / CR 1200 AR
Customer balance = view over invoices − allocations (never a mutable column)
```

**Vendor bill (AP)**: Draft → Approve → Post (DR expense/CR 2100 AP) →
Schedule → Pay (DR AP / CR Bank) → vendor balance from view.

**Bank reconciliation**: Import statement (CSV) → auto-match by amount+date±3d
+reference → manual match remainder → exceptions → approve → mark
`bank_statements.reconciled` → lock statement lines.

**Journal entry**: Draft → (Approve if manual) → Post (validates ΣDR=ΣCR,
period open) → immutable; corrections via auto-generated Reversal. `status`
becomes the single truth: `draft|posted|reversed` (drop `is_posted`).

**Trip-to-cash (the flow that matters for this business)**:
Trip delivered + POD → auto-draft invoice from `trips.salesAmount/vatRate`
(fields already exist: `auto_generated`, `generated_after_pod`, `pod_id`) →
AR workflow above → `trip_accounting` row computes per-trip profit.

## Step 6 — Finance dashboard spec (single merged dashboard)

Row 1 KPIs: Cash (per currency), AR outstanding, AP outstanding, VAT payable.
Row 2: Revenue MTD, Expenses MTD, Operating profit, Net margin — **grouped by
currency, TZS-converted total using `exchange_rates`**.
Charts: 12-mo profit trend (`monthly_financial_summary`), expense breakdown
(`expense_by_category`), revenue by customer (`revenue_by_customer`), cash
trend. Lists: pending approvals, overdue invoices, upcoming payments, recent
journals. Realtime: Supabase `postgres_changes` on `invoices`, `expenses`,
`journal_entries` (same pattern as chat/meetings). Quick actions: New invoice,
New expense, New journal, Reconcile.

## Step 7 — Database improvement plan

New objects (only what's required):

```sql
-- 1. Period control (needed for close/lock)
CREATE TABLE fiscal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL, month int NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','locked')),
  closed_by uuid, closed_at timestamptz,
  UNIQUE (year, month));

-- 2. Payments with allocation (replaces paid-flags-on-invoice)
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text UNIQUE, direction text CHECK (direction IN ('in','out')),
  counterparty_type text, counterparty_id uuid,
  bank_account_id uuid REFERENCES bank_accounts(id),
  amount numeric NOT NULL, currency text NOT NULL,
  payment_date date NOT NULL, method text, reference text,
  journal_entry_id uuid REFERENCES journal_entries(id),
  created_by uuid, created_at timestamptz DEFAULT now());
CREATE TABLE payment_allocations (
  payment_id uuid REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id),
  amount numeric NOT NULL, PRIMARY KEY (payment_id, invoice_id));

-- 3. Document numbering (kills client-side Date.now() numbers)
CREATE TABLE document_sequences (
  doc_type text PRIMARY KEY, prefix text, next_number bigint DEFAULT 1);
CREATE FUNCTION next_doc_number(p_type text) RETURNS text ... FOR UPDATE;
```

Integrity: add FK `invoices.customer_id → customers(id)`; CHECK
(`journal_entries.total_debit = total_credit`) enforced by trigger on post;
trigger blocking INSERT/UPDATE on posted rows and closed periods.

Indexes: `expenses(date)`, `expenses(status)`, `invoices(status, due_date)`,
`invoices(customer_id)`, `journal_entries(entry_date)`,
`journal_entry_lines(account_code)`, `bank_statements(bank_account_id, reconciled)`.

Views to add: `v_customer_balances`, `v_vendor_balances` (replace the mutable
balance tables), `v_ar_aging`, `v_ap_aging`, `v_vat_position`. Materialize
`monthly_financial_summary` only when data volume demands it.

RLS: finance tables → SELECT for authenticated finance roles; INSERT/UPDATE
via role claim (`user_profiles.role IN ('CEO','ADMIN','ACCOUNTANT')`); posting
and period close via `SECURITY DEFINER` functions so status transitions are
privileged, not raw column writes. (Same lesson as the insurance/chat fixes.)

Retirement path for duplicates (zero data loss): 1) code stops reading
duplicate table, 2) one-time copy of any rows into the kept table
(`chart_of_accounts`→`accounts`: 12 rows, verify codes don't collide), 3)
rename table to `zz_deprecated_<name>` for one release, 4) drop.

## Step 8 — UI consistency

The design system exists (`src/components/shell`, `cv-*` classes, tokens fixed
this week). The gap is adoption: ~12 finance pages still hardcode
`bg-white`, `text-gray-900`, `text-slate-*`, `bg-[#F0F1F5]`, sky-blue buttons.
Standard: `PageShell` + `PageHeader` + `StatCard` + `SectionCard` +
`EmptyState` + `PageSkeleton`; colors only via tokens
(`primary/success/warning/info/destructive` — all now defined in Tailwind);
money always `font-mono`, right-aligned, with explicit currency code; dates
`MMM d, yyyy`. Order of conversion: professional-accounting (delete),
income (delete), chart-of-accounts, journal-entries, general-ledger,
bank pages, invoicing pages, fleet-finance pages.

## Step 9 — Permission matrix

Existing roles (do not invent new ones — Rule: preserve permissions):
`CEO, ADMIN, ACCOUNTANT, OPERATOR, HR, DRIVER, SALESMAN`. Mapping to the
requested personas: Finance Director/Manager/Chief Accountant ⇒ `CEO`/`ADMIN`;
Accountant/Cashier ⇒ `ACCOUNTANT`; Auditor ⇒ read-only flag (future);
Operations Manager ⇒ `OPERATOR`.

| Capability | CEO | ADMIN | ACCOUNTANT | OPERATOR | HR | SALESMAN | DRIVER |
|---|---|---|---|---|---|---|---|
| Read finance | ✓ | ✓ | ✓ | fleet costs only | payroll only | own invoices | own expenses |
| Create invoice/expense/journal | ✓ | ✓ | ✓ | expense claims | payroll runs | draft invoice | expense claim |
| Approve | ✓ | ✓ | ✓ (not own) | – | – | – | – |
| Post to ledger | ✓ | ✓ | ✓ | – | – | – | – |
| Reverse posted | ✓ | ✓ | – | – | – | – | – |
| Delete drafts | ✓ | ✓ | ✓ (own) | – | – | – | – |
| Export | ✓ | ✓ | ✓ | ✓ (fleet) | ✓ (payroll) | – | – |
| Close/lock period | ✓ | ✓ | – | – | – | – | – |
| Settings (COA, FX, numbering) | ✓ | ✓ | FX only | – | – | – | – |

Enforcement moves from client-side `useRole()` (cosmetic) to RLS + SECURITY
DEFINER functions for privileged transitions (post, reverse, close).

## Step 10 — Architecture & rollout

**Current**: 40+ finance pages → browser Supabase (anon) → 30+ overlapping
tables; three dashboards; nav config disconnected from filesystem; workflows
are status strings without transitions.

**Target**: same pages (URLs preserved) → thin data layer
(`src/lib/finance/*` query helpers + SECURITY DEFINER RPCs for transitions) →
canonical tables (`accounts`, `journal_entries/_lines`, `invoices`, `payments`
+ allocations, `expenses`, `bank_*`, `customers`, views for balances/aging);
one dashboard; nav = route-config = filesystem (now true).

**Phases (each shippable, zero data loss):**

1. **Foundation (DB)** — `fiscal_periods`, `payments`+`payment_allocations`,
   `document_sequences` + RPCs, FKs/indexes/CHECKs, balance/aging views,
   RLS policies. Pure additive migration `006_finance_foundation.sql`.
2. **Canonicalization** — repoint all pages to canonical tables; retire
   `chart_of_accounts`, `currency_exchange_rates`, `income`, `sales`,
   `purchases`, `clients` (zz_rename); delete `professional-accounting.tsx`
   + `.backup`, `/income` pages.
3. **Workflows** — post/approve/reverse on journals & invoices via RPC;
   receipt allocation UI; auto-invoice on POD; bank reconciliation matching.
4. **Dashboard & polish** — merge three dashboards into `/finance`; convert
   remaining hardcoded-color pages to the design system; realtime KPIs;
   currency-safe aggregation everywhere.
5. **Later, on demand** — assets & depreciation, recurring documents,
   budgets UI, auditor read-only role.

**Risks**: RLS tightening can lock out existing flows (test each policy with
anon + authenticated tokens the way insurance was tested); invoice column
cleanup must keep legacy columns readable until phase 2 completes; FAT32 dev
drive returns EISDIR on readlink — already shimmed in `scripts/run-next.cjs`.
