# Cross-Module Continuity Audit

_Verifying the data/logic flows along the core chains: do downstream records get created, once,
and linked back? Part of the "production-legit" program._

## Chains checked

| Chain | Status | Notes |
|---|---|---|
| Trip delivered → sale + AR invoice | ✅ correct | `WorkflowService.completeTrip` creates one sale and one receivable invoice (`linked_revenue`); shipment status syncs in the engine. Single bill. |
| Fuel request approved → expense + payable | ✅ **fixed** | Was creating **two** payable bills (`createExpense` auto-bills, plus an explicit `createInvoice`). Removed the duplicate — commit 56126e7. |
| Allowance approved → expense + payable | ✅ **fixed** | Same duplicate pattern in `processAllowance` (currently unwired, latent). Removed. |
| Maintenance completed → expense + payable | ✅ correct | `completeMaintenance` posts one expense (auto-bills), releases the vehicle. Duplicate already removed earlier. |
| PO → receive → stock + status | ✅ correct | `receive_purchase_order_items` RPC bumps received qty, writes a `stock_movements` 'in' row per spare part, and sets `partially_/fully_received`. |
| PO → vendor bill | ✅ by design | Receiving does **not** auto-bill; the vendor bill is raised manually against the PO (`vendor_bills.purchase_order_id`) for three-way matching (PO vs received vs billed). Not a gap. |
| `createExpense` → payable | ✅ correct | Auto-creates exactly one payable (`BILL-…`); it is the single source of the duplicate bug fixed above — no other caller double-bills (scanned). |

## Parts request → stock deduction — ADDRESSED (migration apply pending)

The `parts_requests` workflow had an `issued` state but the page only did **approve / reject**, so an
approved request never reduced stock. Fixed:

- **Migration `147_issue_parts_request.sql`** adds `parts_requests.issued_by/issued_at` and an atomic
  `issue_parts_request(p_request_id)` RPC: checks the request is approved, verifies `spare_parts.quantity`
  is sufficient, decrements it, writes a `stock_movements` 'out' row, and marks the request `issued`.
  (`part_id` → `spare_parts`, which is also what `stock_movements.spare_part_id` references.)
- **Parts Requests page** now shows an **Issue** button on approved rows calling that RPC, with a
  stock-shortage error surfaced as a toast.

**Action needed:** the migration was NOT applied — the production-deploy was blocked by the auto-mode
guard. Apply `supabase/migrations/147_issue_parts_request.sql` (via your migration pipeline, or by
allowing the apply) before the Issue button works. The front-end is in place and errors cleanly until then.

Note: `parts_requests` has no maintenance link column, so cost does **not** roll into a maintenance
record (there is nothing to link to) — a separate enhancement if that association is wanted.

## Method note

Audited `WorkflowService`, `SupabaseService.createExpense/createAllowance`, the PO receive RPC
(migration 081), and the parts-requests page. The duplicate-payable class was the only live bug; a
grep for other `createExpense` + `createInvoice(payable)` pairs found none beyond the ones fixed.
