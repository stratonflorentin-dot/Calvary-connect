/**
 * Workflow engine.
 *
 * Single entry point that mutates entity status. Every status change goes
 * through {@link applyTransition}, which:
 *   1. looks up the transition definition on the state machine
 *   2. checks role permissions
 *   3. runs the guard (data preconditions)
 *   4. checks approval routing when the transition requires approval
 *   5. writes the new status to Supabase
 *   6. writes an audit trail entry
 *   7. dispatches side effects (notifications, cross-module writes)
 *
 * Callers get a discriminated result they can pattern-match:
 *   { ok: true,  entity }
 *   { ok: false, code, message, needsReason?, needsApproverRole? }
 */

import { supabase } from "@/lib/supabase";
import { AuditTrailService } from "@/services/audit-trail-service";
import { WorkflowService } from "@/services/workflow-service";
import { createNotification, fetchAccountantUserIds, fetchOperatorUserIds } from "@/services/notification-service";
import type { UserRole } from "@/types/roles";
import {
  getMachine,
  type EntityKind,
  type Transition,
  type TransitionContext,
} from "./state-machines";
import { canRoleApprove, resolveApprovalLevel } from "./approvals";

export interface ApplyTransitionArgs {
  kind: EntityKind;
  entityId: string;
  toState: string;
  actorId: string;
  actorRole?: UserRole;
  /** Extra data for the transition (scheduled_date, actual_cost, reason, etc.). */
  payload?: Record<string, any>;
}

export type TransitionResult =
  | { ok: true; entity: any; sideEffects: string[] }
  | {
      ok: false;
      code:
        | "not_found"
        | "invalid_transition"
        | "forbidden"
        | "guard_failed"
        | "needs_reason"
        | "needs_higher_approval"
        | "db_error";
      message: string;
      approverRoles?: UserRole[];
    };

async function loadEntity(table: string, id: string) {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

function findTransition(
  fromState: string,
  toState: string,
  transitions: Transition[],
): Transition | undefined {
  return transitions.find((t) => t.to === toState);
}

/**
 * Dispatch the module-specific side effect for a transition. Runs *after*
 * the status update and audit are persisted, so failure here degrades to a
 * warning — the state change stands.
 */
async function runSideEffects(
  kind: EntityKind,
  toState: string,
  entity: any,
  actorId: string,
): Promise<string[]> {
  const effects: string[] = [];
  try {
    if (kind === "trip" && toState === "delivered") {
      await WorkflowService.completeTrip(entity.id, entity);
      effects.push("invoice_generated", "finance_notified");
    }
    if (kind === "trip" && toState === "in_transit") {
      const operators = await fetchOperatorUserIds();
      await Promise.all(
        operators.map((id) =>
          createNotification({
            userId: id,
            title: "Trip Dispatched",
            message: `Trip ${entity.trip_number ?? entity.id} is now in transit.`,
            type: "info",
            module: "operations",
            entityType: "trip",
            entityId: entity.id,
            actionUrl: `/trips/${entity.id}`,
          }),
        ),
      );
      effects.push("operators_notified");
    }
    if (kind === "fuel_request" && toState === "approved") {
      await WorkflowService.approveFuelRequest(entity.id, actorId);
      effects.push("expense_recorded", "payable_created", "driver_notified");
    }
    if (kind === "maintenance_request" && toState === "completed") {
      const cost = Number(entity.actual_cost) || 0;
      await WorkflowService.completeMaintenance(entity.id, cost);
      effects.push("expense_recorded", "payable_created");
    }
    if (kind === "expense" && toState === "approved") {
      const accountants = await fetchAccountantUserIds();
      await Promise.all(
        accountants.map((id) =>
          createNotification({
            userId: id,
            title: "Expense Approved",
            message: `Expense of TZS ${Number(entity.amount).toLocaleString()} approved. Ready to pay.`,
            type: "success",
            module: "finance",
            entityType: "expense",
            entityId: entity.id,
            actionUrl: `/expenses`,
          }),
        ),
      );
      effects.push("finance_notified");
    }
    if (kind === "fuel_anomaly" && toState === "investigating" && entity.driver_id) {
      await createNotification({
        userId: entity.driver_id,
        title: "Fuel transaction flagged for review",
        message: entity.description || "One of your fuel transactions needs an explanation.",
        type: "warning",
        module: "fuel_fraud",
        entityType: "fuel_anomaly",
        entityId: entity.id,
        actionUrl: "/driver/fuel",
      });
      effects.push("driver_notified");
    }
    if (kind === "fuel_anomaly" && toState === "confirmed_fraud") {
      const reviewers = await fetchAccountantUserIds();
      await Promise.all(
        reviewers.map((id) =>
          createNotification({
            userId: id,
            title: "Fuel fraud confirmed",
            message: `${entity.description || "A fuel anomaly"} was confirmed as fraud — a finance adjustment may be needed.`,
            type: "warning",
            module: "fuel_fraud",
            entityType: "fuel_anomaly",
            entityId: entity.id,
            actionUrl: "/fleet/fuel-anomalies",
          }),
        ),
      );
      effects.push("finance_notified");
    }
  } catch (err: any) {
    console.warn(`[workflow] side effects failed for ${kind}:${toState}:`, err?.message ?? err);
  }
  return effects;
}

export async function applyTransition(args: ApplyTransitionArgs): Promise<TransitionResult> {
  const machine = getMachine(args.kind);
  const statusColumn = machine.statusColumn ?? "status";

  let entity: any;
  try {
    entity = await loadEntity(machine.table, args.entityId);
  } catch (err: any) {
    return { ok: false, code: "db_error", message: err.message ?? "Load failed" };
  }
  if (!entity) {
    return { ok: false, code: "not_found", message: `${args.kind} ${args.entityId} not found.` };
  }

  const rawState = String(entity[statusColumn] ?? "").toLowerCase();
  const transitions = machine.transitions[rawState as keyof typeof machine.transitions] ?? [];
  const transition = findTransition(rawState, args.toState, transitions);

  if (!transition) {
    return {
      ok: false,
      code: "invalid_transition",
      message: `Cannot move ${args.kind} from "${rawState}" to "${args.toState}".`,
    };
  }

  if (transition.roles && transition.roles.length > 0) {
    if (!args.actorRole || !transition.roles.includes(args.actorRole)) {
      return {
        ok: false,
        code: "forbidden",
        message: `Role ${args.actorRole ?? "(unknown)"} is not allowed to ${transition.label}.`,
      };
    }
  }

  if (transition.requireReason && !args.payload?.reason) {
    return {
      ok: false,
      code: "needs_reason",
      message: `A reason is required to ${transition.label}.`,
    };
  }

  if (transition.guard) {
    const ctx: TransitionContext = {
      actorId: args.actorId,
      actorRole: args.actorRole,
      entity,
      payload: args.payload,
    };
    const check = transition.guard(ctx);
    if (typeof check === "string") {
      return { ok: false, code: "guard_failed", message: check };
    }
  }

  if (transition.requiresApproval) {
    const amount = Number(args.payload?.amount ?? entity.amount ?? 0);
    if (!canRoleApprove(args.kind, amount, args.actorRole)) {
      const level = resolveApprovalLevel(args.kind, amount);
      return {
        ok: false,
        code: "needs_higher_approval",
        message: `This ${args.kind.replace("_", " ")} of TZS ${amount.toLocaleString()} needs ${level?.label ?? "higher"} approval.`,
        approverRoles: level?.approverRoles ?? [],
      };
    }
  }

  // Money movement must be verified *before* the status flips, unlike the
  // notification-style side effects below — those are allowed to degrade to
  // a warning, but "marked paid with no bank account actually debited" is
  // exactly the bug this guards against (current_balance stuck at its
  // opening value while expenses/payroll keep getting marked paid). See
  // supabase/migrations/035_post_bank_transaction_function.sql.
  if (args.kind === "expense" && args.toState === "paid") {
    const currency = entity.currency || "TZS";
    const { data: accounts, error: acctErr } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("currency", currency)
      .eq("is_active", true);

    if (acctErr) {
      return { ok: false, code: "db_error", message: `Could not look up ${currency} bank accounts: ${acctErr.message}` };
    }
    if (!accounts || accounts.length !== 1) {
      return {
        ok: false,
        code: "guard_failed",
        message:
          accounts && accounts.length > 1
            ? `More than one active ${currency} bank account exists — use Finance → Expenses → Record Payment to choose which one.`
            : `No active ${currency} bank account found to pay this expense from.`,
      };
    }

    const { error: txError } = await supabase.rpc("post_bank_transaction", {
      p_bank_account_id: accounts[0].id,
      p_amount: Number(entity.amount) || 0,
      p_direction: "out",
      p_transaction_type: "withdrawal",
      p_currency: currency,
      p_description: entity.description || `Expense payment (${args.entityId})`,
      p_reference_type: "expense",
      p_reference_id: args.entityId,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (txError) {
      return { ok: false, code: "db_error", message: `Bank account was not debited: ${txError.message}` };
    }
  }

  const updatePayload: Record<string, any> = {
    [statusColumn]: args.toState,
    updated_at: new Date().toISOString(),
  };
  if (args.payload?.scheduled_date) updatePayload.scheduled_date = args.payload.scheduled_date;
  if (args.payload?.actual_cost != null) updatePayload.actual_cost = args.payload.actual_cost;
  if (args.kind === "leave_request" && args.toState === "approved") {
    updatePayload.approved_by = args.actorId;
    updatePayload.approved_at = new Date().toISOString();
  }
  if (args.kind === "leave_request" && args.toState === "rejected" && args.payload?.reason) {
    updatePayload.rejected_reason = args.payload.reason;
  }

  const { data: updated, error: updateError } = await supabase
    .from(machine.table)
    .update(updatePayload)
    .eq("id", args.entityId)
    .select()
    .maybeSingle();

  if (updateError) {
    return { ok: false, code: "db_error", message: updateError.message };
  }

  const description = args.payload?.reason
    ? `${transition.label}: ${args.payload.reason}`
    : transition.label;

  await AuditTrailService.log({
    user_id: args.actorId,
    module: machine.auditModule,
    action: args.toState === "cancelled" || args.toState === "rejected" ? "reject" : "approve",
    entity_type: machine.auditEntityType,
    entity_id: args.entityId,
    old_value: { [statusColumn]: rawState },
    new_value: { [statusColumn]: args.toState, ...(args.payload ?? {}) },
    description: `${transition.label} (${rawState} → ${args.toState})${args.payload?.reason ? `: ${args.payload.reason}` : ""}`,
  });

  const effects = await runSideEffects(args.kind, args.toState, updated ?? entity, args.actorId);

  return { ok: true, entity: updated ?? entity, sideEffects: effects };
}

/**
 * List the transitions currently allowed for the given entity, filtered by
 * the caller's role. Used by UI components to render action buttons.
 */
export function availableTransitions(
  kind: EntityKind,
  currentState: string,
  role: UserRole | undefined,
): Transition[] {
  const machine = getMachine(kind);
  const key = currentState.toLowerCase();
  const list = machine.transitions[key as keyof typeof machine.transitions] ?? [];
  if (!role) return list.filter((t) => !t.roles || t.roles.length === 0);
  return list.filter((t) => !t.roles || t.roles.length === 0 || t.roles.includes(role));
}
