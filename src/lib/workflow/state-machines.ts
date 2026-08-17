/**
 * Workflow state machines for core entities.
 *
 * Each machine declares:
 *  - allowed transitions between states
 *  - which roles can trigger each transition
 *  - guards (data preconditions) that must hold before the transition runs
 *  - side effects that fire after a successful transition (notifications,
 *    cross-module writes, audit is handled centrally by the engine)
 *
 * The engine ({@link ./engine}) is the only code that mutates status. UI
 * components render transitions dynamically from the machine, so buttons
 * disappear when the current user is not allowed to perform them.
 */

import type { UserRole } from "@/types/roles";
import type { AuditEntityType, AuditModule } from "@/services/audit-trail-service";

export type EntityKind =
  | "trip"
  | "maintenance_request"
  | "fuel_request"
  | "expense"
  | "leave_request"
  | "fuel_anomaly"
  | "purchase_order"
  | "disciplinary_case"
  | "separation_case"
  | "performance_review"
  | "bank_statement_batch"
  | "cash_request";

export interface TransitionContext {
  actorId: string;
  actorRole?: UserRole;
  entity: Record<string, any>;
  payload?: Record<string, any>;
}

export interface Transition<TState extends string = string> {
  /** Human-friendly action label ("Dispatch", "Reject"). */
  label: string;
  /** The status the entity ends up in. */
  to: TState;
  /** Optional short description shown as a tooltip. */
  description?: string;
  /** Visual intent for the button. */
  intent?: "primary" | "success" | "danger" | "neutral";
  /** Roles allowed to trigger this transition. Empty ⇒ anyone. */
  roles?: UserRole[];
  /**
   * Requires that this transition go through the approval engine.
   * When true, the button submits an approval request instead of applying
   * the transition immediately.
   */
  requiresApproval?: boolean;
  /**
   * Data precondition. Returning a string aborts the transition with that
   * message. Returning true (or void) allows it to proceed.
   */
  guard?: (ctx: TransitionContext) => true | string | void;
  /**
   * Ask for a free-text reason (rejections, cancellations). The engine will
   * store the reason on the audit trail entry.
   */
  requireReason?: boolean;
}

export interface StateMachine<TState extends string = string> {
  kind: EntityKind;
  table: string;
  auditModule: AuditModule;
  auditEntityType: AuditEntityType;
  /** Column name that stores status. Defaults to `status`. */
  statusColumn?: string;
  /** All statuses, in canonical order (used to draw the step progress bar). */
  states: TState[];
  transitions: Record<TState, Transition<TState>[]>;
  /** Terminal states — no further transitions available. */
  terminal?: TState[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip
// ─────────────────────────────────────────────────────────────────────────────
export type TripState =
  | "pending"
  | "loading"
  | "in_transit"
  | "delivered"
  | "cancelled";

export const tripMachine: StateMachine<TripState> = {
  kind: "trip",
  table: "trips",
  auditModule: "operations",
  auditEntityType: "trip",
  states: ["pending", "loading", "in_transit", "delivered", "cancelled"],
  terminal: ["delivered", "cancelled"],
  transitions: {
    pending: [
      {
        label: "Start Loading",
        to: "loading",
        intent: "primary",
        description: "Vehicle is at origin and being loaded.",
        roles: ["OPERATOR", "ADMIN", "CEO"],
        guard: ({ entity }) => {
          if (!entity.driverId && !entity.driver_id) return "Assign a driver first.";
          if (!entity.truckId && !entity.vehicle_id) return "Assign a vehicle first.";
          return true;
        },
      },
      {
        label: "Cancel",
        to: "cancelled",
        intent: "danger",
        roles: ["OPERATOR", "ADMIN", "CEO"],
        requireReason: true,
      },
    ],
    loading: [
      {
        label: "Dispatch",
        to: "in_transit",
        intent: "primary",
        description: "Truck has left origin.",
        roles: ["OPERATOR", "ADMIN", "CEO", "DRIVER"],
      },
      {
        label: "Cancel",
        to: "cancelled",
        intent: "danger",
        roles: ["OPERATOR", "ADMIN", "CEO"],
        requireReason: true,
      },
    ],
    in_transit: [
      {
        label: "Mark Delivered",
        to: "delivered",
        intent: "success",
        description: "Cargo delivered. Triggers invoice generation.",
        roles: ["DRIVER", "OPERATOR", "ADMIN", "CEO"],
      },
    ],
    delivered: [],
    cancelled: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance request
// ─────────────────────────────────────────────────────────────────────────────
export type MaintenanceState =
  | "requested"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "postponed"
  | "cancelled";

export const maintenanceMachine: StateMachine<MaintenanceState> = {
  kind: "maintenance_request",
  table: "maintenance_records",
  auditModule: "maintenance",
  auditEntityType: "maintenance_request",
  states: ["requested", "scheduled", "in_progress", "completed", "postponed", "cancelled"],
  terminal: ["completed", "cancelled"],
  transitions: {
    requested: [
      {
        label: "Approve & Schedule",
        to: "scheduled",
        intent: "primary",
        roles: ["ADMIN", "CEO", "MECHANIC"],
        guard: ({ entity, payload }) => {
          const date = payload?.scheduled_date ?? entity.scheduled_date;
          if (!date) return "Set a scheduled date before approving.";
          return true;
        },
      },
      {
        label: "Reject",
        to: "cancelled",
        intent: "danger",
        roles: ["ADMIN", "CEO"],
        requireReason: true,
      },
    ],
    scheduled: [
      {
        label: "Start Work",
        to: "in_progress",
        intent: "primary",
        roles: ["MECHANIC", "ADMIN", "CEO"],
      },
      {
        label: "Postpone",
        to: "postponed",
        intent: "neutral",
        roles: ["MECHANIC", "ADMIN", "CEO"],
        requireReason: true,
      },
      {
        label: "Cancel",
        to: "cancelled",
        intent: "danger",
        roles: ["ADMIN", "CEO"],
        requireReason: true,
      },
    ],
    in_progress: [
      {
        label: "Complete",
        to: "completed",
        intent: "success",
        description: "Records actual cost and posts a payable bill.",
        roles: ["MECHANIC", "ADMIN", "CEO"],
        guard: ({ payload }) => {
          const cost = Number(payload?.actual_cost);
          if (!cost || Number.isNaN(cost) || cost <= 0)
            return "Enter the actual cost before completing.";
          return true;
        },
      },
    ],
    postponed: [
      {
        label: "Resume (Schedule)",
        to: "scheduled",
        intent: "primary",
        roles: ["MECHANIC", "ADMIN", "CEO"],
      },
      {
        label: "Cancel",
        to: "cancelled",
        intent: "danger",
        roles: ["ADMIN", "CEO"],
        requireReason: true,
      },
    ],
    completed: [],
    cancelled: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fuel request  (multi-level approval based on amount)
// ─────────────────────────────────────────────────────────────────────────────
export type FuelRequestState = "pending" | "approved" | "rejected" | "paid";

export const fuelRequestMachine: StateMachine<FuelRequestState> = {
  kind: "fuel_request",
  table: "fuel_requests",
  auditModule: "operations",
  auditEntityType: "expense",
  states: ["pending", "approved", "rejected", "paid"],
  terminal: ["rejected", "paid"],
  transitions: {
    pending: [
      {
        label: "Approve",
        to: "approved",
        intent: "success",
        description: "Creates matching expense and payable bill.",
        requiresApproval: true,
      },
      {
        label: "Reject",
        to: "rejected",
        intent: "danger",
        roles: ["OPERATOR", "ADMIN", "CEO", "ACCOUNTANT"],
        requireReason: true,
      },
    ],
    approved: [
      {
        label: "Mark Paid",
        to: "paid",
        intent: "success",
        roles: ["ACCOUNTANT", "ADMIN", "CEO"],
      },
    ],
    rejected: [],
    paid: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Generic expense  (uses the same approval engine as fuel)
// ─────────────────────────────────────────────────────────────────────────────
export type ExpenseState = "pending" | "approved" | "rejected" | "paid";

export const expenseMachine: StateMachine<ExpenseState> = {
  kind: "expense",
  table: "expenses",
  auditModule: "finance",
  auditEntityType: "expense",
  states: ["pending", "approved", "rejected", "paid"],
  terminal: ["rejected", "paid"],
  transitions: {
    pending: [
      {
        label: "Approve",
        to: "approved",
        intent: "success",
        requiresApproval: true,
      },
      {
        label: "Reject",
        to: "rejected",
        intent: "danger",
        roles: ["ACCOUNTANT", "ADMIN", "CEO"],
        requireReason: true,
      },
    ],
    approved: [
      {
        label: "Mark Paid",
        to: "paid",
        intent: "success",
        roles: ["ACCOUNTANT", "ADMIN", "CEO"],
      },
    ],
    rejected: [],
    paid: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Leave request
// ─────────────────────────────────────────────────────────────────────────────
export type LeaveRequestState = "pending" | "approved" | "rejected";

export const leaveRequestMachine: StateMachine<LeaveRequestState> = {
  kind: "leave_request",
  table: "leave_requests",
  auditModule: "hr",
  auditEntityType: "leave_request",
  states: ["pending", "approved", "rejected"],
  terminal: ["approved", "rejected"],
  transitions: {
    pending: [
      {
        label: "Approve",
        to: "approved",
        intent: "success",
        description: "Unpaid leave reduces taxable pay in the next payroll run for the days it covers.",
        roles: ["HR", "ADMIN", "CEO"],
      },
      {
        label: "Reject",
        to: "rejected",
        intent: "danger",
        roles: ["HR", "ADMIN", "CEO"],
        requireReason: true,
      },
    ],
    approved: [],
    rejected: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fuel anomaly investigation
// ─────────────────────────────────────────────────────────────────────────────
export type FuelAnomalyState =
  | "open"
  | "under_review"
  | "investigating"
  | "resolved"
  | "dismissed"
  | "confirmed_fraud";

const FRAUD_REVIEW_ROLES: UserRole[] = ["OPERATOR", "ACCOUNTANT", "ADMIN", "CEO"];

export const fuelAnomalyMachine: StateMachine<FuelAnomalyState> = {
  kind: "fuel_anomaly",
  table: "fuel_anomalies",
  auditModule: "operations",
  auditEntityType: "fuel_anomaly",
  states: ["open", "under_review", "investigating", "resolved", "dismissed", "confirmed_fraud"],
  terminal: ["resolved", "dismissed", "confirmed_fraud"],
  transitions: {
    open: [
      {
        label: "Start Review",
        to: "under_review",
        intent: "primary",
        roles: FRAUD_REVIEW_ROLES,
      },
      {
        label: "Dismiss",
        to: "dismissed",
        intent: "neutral",
        roles: FRAUD_REVIEW_ROLES,
        requireReason: true,
      },
    ],
    under_review: [
      {
        label: "Open Investigation",
        to: "investigating",
        intent: "primary",
        description: "Escalates for deeper review — driver will be asked to explain.",
        roles: FRAUD_REVIEW_ROLES,
      },
      {
        label: "Resolve (No Issue)",
        to: "resolved",
        intent: "success",
        roles: FRAUD_REVIEW_ROLES,
        requireReason: true,
      },
      {
        label: "Dismiss",
        to: "dismissed",
        intent: "neutral",
        roles: FRAUD_REVIEW_ROLES,
        requireReason: true,
      },
    ],
    investigating: [
      {
        label: "Confirm Fraud",
        to: "confirmed_fraud",
        intent: "danger",
        description: "Marks this as confirmed fraud. A finance adjustment can then be created.",
        roles: ["ADMIN", "CEO"],
        requireReason: true,
      },
      {
        label: "Resolve (No Issue)",
        to: "resolved",
        intent: "success",
        description: "Driver's explanation and evidence account for the anomaly.",
        roles: FRAUD_REVIEW_ROLES,
        requireReason: true,
      },
      {
        label: "Dismiss",
        to: "dismissed",
        intent: "neutral",
        roles: FRAUD_REVIEW_ROLES,
        requireReason: true,
      },
    ],
    resolved: [],
    dismissed: [],
    confirmed_fraud: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Purchase Order — draft -> sent_to_supplier -> partially_received ->
// fully_received; cancelled from any pre-received state. Matches LogiPRO's
// documented PO state machine. partially_received and fully_received are
// NOT reachable through these transitions — receive_purchase_order_items()
// (081_purchase_orders.sql) sets those atomically alongside the item
// quantity/stock-movement updates, the same way expense's "paid" transition
// is special-cased in engine.ts rather than being a plain role-gated move.
// ─────────────────────────────────────────────────────────────────────────────
export type PurchaseOrderState =
  | "draft"
  | "sent_to_supplier"
  | "partially_received"
  | "fully_received"
  | "cancelled";

export const purchaseOrderMachine: StateMachine<PurchaseOrderState> = {
  kind: "purchase_order",
  table: "purchase_orders",
  auditModule: "procurement",
  auditEntityType: "purchase_order",
  states: ["draft", "sent_to_supplier", "partially_received", "fully_received", "cancelled"],
  terminal: ["fully_received", "cancelled"],
  transitions: {
    draft: [
      {
        label: "Send to Supplier",
        to: "sent_to_supplier",
        intent: "primary",
        roles: ["CEO", "ADMIN", "OPERATOR"],
      },
      {
        label: "Cancel",
        to: "cancelled",
        intent: "danger",
        roles: ["CEO", "ADMIN", "OPERATOR"],
        requireReason: true,
      },
    ],
    sent_to_supplier: [
      {
        label: "Cancel",
        to: "cancelled",
        intent: "danger",
        roles: ["CEO", "ADMIN", "OPERATOR"],
        requireReason: true,
      },
    ],
    partially_received: [
      {
        label: "Cancel",
        to: "cancelled",
        intent: "danger",
        roles: ["CEO", "ADMIN"],
        requireReason: true,
      },
    ],
    fully_received: [],
    cancelled: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Disciplinary case — Reported -> Investigating -> Hearing -> Resolved.
// Minor cases can resolve straight from Investigating (no hearing needed);
// Withdraw is a side-branch from either open state. Hearing/outcome fields
// need a custom form (date picker, outcome dropdown), so the UI excludes
// "hearing" and "resolved" from the generic TransitionButtons bar and drives
// those two through dedicated modals, same pattern as maintenance's
// actual_cost-gated "Complete" transition.
// ─────────────────────────────────────────────────────────────────────────────
export type DisciplinaryCaseState = "reported" | "investigating" | "hearing" | "resolved" | "withdrawn";

const HR_CASE_ROLES: UserRole[] = ["HR", "ADMIN", "CEO"];

export const disciplinaryCaseMachine: StateMachine<DisciplinaryCaseState> = {
  kind: "disciplinary_case",
  table: "disciplinary_cases",
  auditModule: "hr",
  auditEntityType: "disciplinary_case",
  states: ["reported", "investigating", "hearing", "resolved", "withdrawn"],
  terminal: ["resolved", "withdrawn"],
  transitions: {
    reported: [
      { label: "Start Investigation", to: "investigating", intent: "primary", roles: HR_CASE_ROLES },
      { label: "Withdraw", to: "withdrawn", intent: "neutral", roles: HR_CASE_ROLES, requireReason: true },
    ],
    investigating: [
      {
        label: "Schedule Hearing",
        to: "hearing",
        intent: "primary",
        roles: HR_CASE_ROLES,
        guard: ({ entity, payload }) => (payload?.hearing_date ?? entity.hearing_date ? true : "Set a hearing date first."),
      },
      {
        label: "Resolve (No Hearing)",
        to: "resolved",
        intent: "success",
        description: "For minor cases that don't need a formal hearing.",
        roles: HR_CASE_ROLES,
        guard: ({ entity, payload }) => (payload?.outcome ?? entity.outcome ? true : "Select an outcome first."),
      },
      { label: "Withdraw", to: "withdrawn", intent: "neutral", roles: HR_CASE_ROLES, requireReason: true },
    ],
    hearing: [
      {
        label: "Record Outcome",
        to: "resolved",
        intent: "success",
        roles: HR_CASE_ROLES,
        guard: ({ entity, payload }) => (payload?.outcome ?? entity.outcome ? true : "Select an outcome first."),
      },
    ],
    resolved: [],
    withdrawn: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Separation / exit case — Initiated -> Clearance in progress -> Pending
// final pay -> Completed. Final pay itself is computed and raised as an
// expense outside the workflow engine (see hr/separation page); the last
// transition just requires that step to have happened.
// ─────────────────────────────────────────────────────────────────────────────
export type SeparationCaseState =
  | "initiated"
  | "clearance_in_progress"
  | "pending_final_pay"
  | "completed"
  | "cancelled";

export const separationCaseMachine: StateMachine<SeparationCaseState> = {
  kind: "separation_case",
  table: "separation_cases",
  auditModule: "hr",
  auditEntityType: "separation_case",
  states: ["initiated", "clearance_in_progress", "pending_final_pay", "completed", "cancelled"],
  terminal: ["completed", "cancelled"],
  transitions: {
    initiated: [
      {
        label: "Start Clearance",
        to: "clearance_in_progress",
        intent: "primary",
        roles: HR_CASE_ROLES,
        guard: ({ entity }) => (entity.last_working_day ? true : "Set a last working day first."),
      },
      { label: "Cancel", to: "cancelled", intent: "danger", roles: HR_CASE_ROLES, requireReason: true },
    ],
    clearance_in_progress: [
      {
        label: "Proceed to Final Pay",
        to: "pending_final_pay",
        intent: "primary",
        description: "Requires IT, asset and finance clearance to be checked off.",
        roles: HR_CASE_ROLES,
        guard: ({ entity }) =>
          entity.clearance_it && entity.clearance_assets && entity.clearance_finance
            ? true
            : "Complete the clearance checklist first.",
      },
      { label: "Cancel", to: "cancelled", intent: "danger", roles: HR_CASE_ROLES, requireReason: true },
    ],
    pending_final_pay: [
      {
        label: "Complete Separation",
        to: "completed",
        intent: "success",
        description: "Marks the employee inactive. Final pay must already be raised as an expense.",
        roles: HR_CASE_ROLES,
        guard: ({ entity }) => (entity.final_pay_expense_id ? true : "Compute and raise the final pay expense first."),
      },
    ],
    completed: [],
    cancelled: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Performance review — Draft -> Submitted -> Acknowledged. Acknowledged is
// reached by the reviewed employee, not an HR role, via a SECURITY DEFINER
// RPC (see engine.ts) rather than a plain status UPDATE — RLS can't scope an
// UPDATE to specific columns, and letting an employee UPDATE their own row
// directly would let them also rewrite rating/kpi_scores.
// ─────────────────────────────────────────────────────────────────────────────
export type PerformanceReviewState = "draft" | "submitted" | "acknowledged";

export const performanceReviewMachine: StateMachine<PerformanceReviewState> = {
  kind: "performance_review",
  table: "performance_reviews",
  auditModule: "hr",
  auditEntityType: "performance_review",
  states: ["draft", "submitted", "acknowledged"],
  terminal: ["acknowledged"],
  transitions: {
    draft: [
      {
        label: "Submit Review",
        to: "submitted",
        intent: "primary",
        description: "Makes the review visible to the employee for acknowledgement.",
        roles: HR_CASE_ROLES,
        guard: ({ entity }) => (entity.rating ? true : "Set a rating before submitting."),
      },
    ],
    submitted: [
      {
        label: "Revise",
        to: "draft",
        intent: "neutral",
        description: "Pull back for corrections before the employee acknowledges it.",
        roles: HR_CASE_ROLES,
        requireReason: true,
      },
      {
        label: "Acknowledge",
        to: "acknowledged",
        intent: "success",
        description: "The reviewed employee confirms they've seen this review.",
      },
    ],
    acknowledged: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Bank statement batch — Draft -> Posted (locks matched lines), with Reopen
// as a side-branch back to Draft. `open_line_count` is a denormalized count
// kept in sync by the reconciliation page whenever a line's match_status
// changes (guards here are synchronous and can't query lines themselves).
// Posting with lines still open requires a reason — enforced by the guard
// rather than the blanket `requireReason` flag, so a fully-matched batch
// posts with one click while a partial one has to justify itself. The
// reconciliation page drives "Post" through a custom modal for this reason,
// same pattern as maintenance's actual_cost-gated "Complete".
// ─────────────────────────────────────────────────────────────────────────────
export type BankStatementBatchState = "draft" | "posted";

const BANK_RECONCILIATION_ROLES: UserRole[] = ["CEO", "ADMIN", "ACCOUNTANT"];

export const bankStatementBatchMachine: StateMachine<BankStatementBatchState> = {
  kind: "bank_statement_batch",
  table: "bank_statement_batches",
  auditModule: "finance",
  auditEntityType: "bank_statement_batch",
  states: ["draft", "posted"],
  transitions: {
    draft: [
      {
        label: "Post",
        to: "posted",
        intent: "success",
        description: "Locks matched lines against further changes.",
        roles: BANK_RECONCILIATION_ROLES,
        guard: ({ entity, payload }) => {
          const openCount = Number(entity.open_line_count) || 0;
          if (openCount > 0 && !payload?.reason) {
            return `${openCount} line(s) still need matching. Provide a reason to post anyway.`;
          }
          return true;
        },
      },
    ],
    posted: [
      {
        label: "Reopen",
        to: "draft",
        intent: "neutral",
        description: "Unlocks lines for further matching.",
        roles: ["CEO", "ADMIN"],
        requireReason: true,
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Cash request — Draft -> Pending -> Approved -> Disbursed -> Retired, with
// Reject as a branch from Pending. "Approve" reuses the same amount-tiered
// requiresApproval routing as fuel_request/expense (spendTiers in
// approvals.ts) instead of a separate "2nd approval" state — a larger
// request just needs a more senior approver role, same mechanism already
// trusted elsewhere. Disburse and Retire both post real ledger entries
// (engine.ts), not a plain status flip — see the migration comment for the
// posting rule.
// ─────────────────────────────────────────────────────────────────────────────
export type CashRequestState = "draft" | "pending" | "approved" | "rejected" | "disbursed" | "retired";

export const cashRequestMachine: StateMachine<CashRequestState> = {
  kind: "cash_request",
  table: "cash_requests",
  auditModule: "finance",
  auditEntityType: "cash_request",
  states: ["draft", "pending", "approved", "rejected", "disbursed", "retired"],
  terminal: ["rejected", "retired"],
  transitions: {
    draft: [
      {
        label: "Submit",
        to: "pending",
        intent: "primary",
        guard: ({ actorId, entity }) => (actorId === entity.requester_id ? true : "Only the requester can submit this."),
      },
    ],
    pending: [
      {
        label: "Approve",
        to: "approved",
        intent: "success",
        requiresApproval: true,
      },
      {
        label: "Reject",
        to: "rejected",
        intent: "danger",
        roles: ["OPERATOR", "ACCOUNTANT", "ADMIN", "CEO"],
        requireReason: true,
      },
    ],
    approved: [
      {
        label: "Disburse",
        to: "disbursed",
        intent: "primary",
        description: "Pays out from the chosen account. Posts Dr Driver Float/Staff Advance / Cr Bank.",
        roles: ["ACCOUNTANT", "ADMIN", "CEO"],
        guard: ({ entity, payload }) => (payload?.disbursed_from_account_id ?? entity.disbursed_from_account_id ? true : "Choose the account to disburse from."),
      },
    ],
    disbursed: [
      {
        label: "Retire",
        to: "retired",
        intent: "success",
        description: "Reclassifies the advance into a real expense. Posts Dr Expense / Cr Driver Float/Staff Advance.",
        roles: ["ACCOUNTANT", "ADMIN", "CEO"],
        guard: ({ payload }) => (payload?.actual_spent != null ? true : "Enter the retirement breakdown first."),
      },
    ],
    rejected: [],
    retired: [],
  },
};

export const machines: Record<EntityKind, StateMachine<any>> = {
  trip: tripMachine,
  maintenance_request: maintenanceMachine,
  fuel_request: fuelRequestMachine,
  expense: expenseMachine,
  leave_request: leaveRequestMachine,
  fuel_anomaly: fuelAnomalyMachine,
  purchase_order: purchaseOrderMachine,
  disciplinary_case: disciplinaryCaseMachine,
  separation_case: separationCaseMachine,
  performance_review: performanceReviewMachine,
  bank_statement_batch: bankStatementBatchMachine,
  cash_request: cashRequestMachine,
};

export function getMachine(kind: EntityKind): StateMachine<any> {
  return machines[kind];
}
