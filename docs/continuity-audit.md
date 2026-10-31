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

## Open gap (needs a decision / deeper work)

- **Parts request → inventory deduction.** The `parts_requests` workflow has an `issued` state, but the
  Parts Requests page only does **approve / reject** — there is no "issue" action that writes a
  `stock_movements` 'out' row / decrements `inventory.quantity_available`. So an approved part request
  may never actually reduce stock, and its cost never rolls into the maintenance record it was for.
  Fix = add an "Issue" action (mirroring the PO-receive RPC in reverse) that deducts stock and links
  the issue to the maintenance record. Scoped as its own task (touches a workflow transition + an RPC).

## Method note

Audited `WorkflowService`, `SupabaseService.createExpense/createAllowance`, the PO receive RPC
(migration 081), and the parts-requests page. The duplicate-payable class was the only live bug; a
grep for other `createExpense` + `createInvoice(payable)` pairs found none beyond the ones fixed.
