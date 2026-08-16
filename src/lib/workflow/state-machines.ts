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
  | "fuel_anomaly";

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

export const machines: Record<EntityKind, StateMachine<any>> = {
  trip: tripMachine,
  maintenance_request: maintenanceMachine,
  fuel_request: fuelRequestMachine,
  expense: expenseMachine,
  leave_request: leaveRequestMachine,
  fuel_anomaly: fuelAnomalyMachine,
};

export function getMachine(kind: EntityKind): StateMachine<any> {
  return machines[kind];
}
