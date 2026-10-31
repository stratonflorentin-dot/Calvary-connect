# Role & RLS Backbone Audit (Phase 0)

_Part of the "production-legit, role by role" program. Project: `qaqonhjeqtlatqsrqcnx` (calvaryconnect)._

## What changed in Phase 0

- **0.1 Client-side role enforcement (done).** `useRouteGuard()` was exported but never invoked —
  any authenticated user could load any page's shell. A `RouteGuard` component is now mounted in the
  root layout, so each role is redirected to its default route on pages outside its `allowedRoles`.
  CEO/ADMIN keep full access; the guard no-ops for signed-out visitors (public pages stay reachable).
  Six pages missing from `ROUTE_CONFIG` were added first so enabling the guard wouldn't lock
  non-admins out: `/admin/api-health`, `/finance/banking/bank-accounts/[id]`,
  `/finance/transactions/payments/[id]`, `/hr/company-loans`, `/hr/loan-calculator`, `/reports/notebook`.
- **0.4 WAREHOUSE_STAFF dashboard (done).** Previously fell back to `OperatorView`; now has a tailored
  `WarehouseView` (stock levels, low-stock reorder list, parts-request queue).

## 0.3 RLS audit (Supabase security advisors, read-only)

**Headline: the RLS backbone is sound.** No `rls_disabled_in_public` findings — every public table
has RLS enabled, so nothing is wide open.

Findings:

| Severity | Finding | Count | Assessment |
|---|---|---|---|
| INFO | `rls_enabled_no_policy` | 20 tables | RLS on, no policy ⇒ denies all direct access. **None of the 20 are read directly (`.from()`) by the app** — they're reached via SECURITY DEFINER RPCs/views or are legacy. Not a live breakage; a hygiene/defense-in-depth item. |
| WARN | `authenticated_security_definer_function_executable` | 80 | Mostly intentional — the workflow engine, posting RPCs (`post_journal_entry`, `post_bank_transaction`, `acknowledge_performance_review`) run SECURITY DEFINER by design. Review grants, don't blanket-revoke. |
| WARN | `anon_security_definer_function_executable` | 69 | Review which truly need `anon` (public tracking/quotation links) vs should be `authenticated`-only. |
| WARN | `function_search_path_mutable` | 55 | Hardening: pin `search_path` on these functions. |
| WARN | `auth_leaked_password_protection` | 1 | One-click enable in Supabase Auth settings. |

The 20 no-policy tables: `compliance_documents, contract_lines, currency_exchange_rates, drivers,
event_log, financial_reports, follow_ups, fuel_approvals, geofences, maintenance_schedules,
mobile_money_transactions, revenue, route_profitability, sensor_readings, sensors,
sustainability_metrics, trip_accounting, vehicle_expenses, vendor_balances, whatsapp_messages`.

### Recommended (needs CEO/ADMIN sign-off before applying to production)

1. The 20 no-policy tables are **currently deny-all, which is the secure state** (RLS on, no policy ⇒
   no direct client access), and the app doesn't read them directly — so the hardening decision is to
   **leave them deny-all** (RPC/view-only) rather than add permissive policies, since adding policies
   would *open* access currently closed. Revisit only if a role genuinely needs direct access.
2. ✅ **DONE** — Pinned `search_path = public` on all 55 flagged non-extension functions
   (migration `148_pin_function_search_path.sql`, applied; re-verified 0 remaining). Clears the
   `function_search_path_mutable` warnings.
3. **Enable leaked-password protection** — this is a Supabase **Auth project setting**, not SQL:
   Dashboard → Authentication → Policies/Password → enable "Leaked password protection". Owner action.
4. Review the `anon`-executable SECURITY DEFINER functions; restrict any not needed for public links.

## Still open in Phase 0

- **0.2 Cookie-based sessions** (migrate to `@supabase/ssr` so `middleware.ts` can gate server-side).
  Higher risk — changes auth storage; must be verified with a real login after, so pair with the owner.

## Phase 2 — Workflow dead-button sweep (done)

Audited every workflow-consuming page for transitions a role can see but can never satisfy
(the generic `TransitionButtons` bar can only pass `reason`). Result: **the maintenance
"Approve & Schedule" dead-end was the only one** — fixed earlier this session. All others are
correctly handled:

| Workflow / page | Guarded transition | How it's handled | Verdict |
|---|---|---|---|
| Maintenance detail + approvals | Approve & Schedule (date), Complete (cost) | date/complete modals; `scheduled`/`completed` excluded | fixed |
| Disciplinary | Schedule Hearing (date), Record Outcome (outcome) | dedicated modals; `hearing`/`resolved` excluded | ok |
| Separation | Start Clearance / Final Pay / Complete | guards read entity fields set by same-page steps (LWD, clearance toggles, raise-expense) | ok |
| Performance reviews | Submit (rating), Acknowledge | rating set at creation; `acknowledged` excluded, done by employee on /hr/my-hr | ok |
| Cash requests | Disburse (account), Retire (lines) | custom modals; `disbursed`/`retired` excluded | ok |
| Bank statements | Post (reason if partial) | custom Post button + reason modal; generic bar only shows Reopen when posted | ok |
| Fuel/expense/cash approve | requiresApproval (amount tier) | engine enforces tier; inbox shows tier + a "For me" filter via `canRoleApprove` | ok (soft) |
| Trips / dispatch / fuel anomaly / leave / PO | reason-only or role-gated | no payload-beyond-reason guards | ok |

No code changes were needed beyond the maintenance fix.

## Verification status

- `npx tsc --noEmit`: green. `npm run build`: green (155 pages compile).
- Runtime per-role walkthrough (Phase 1) requires a login per role — owner to provide or seed.
