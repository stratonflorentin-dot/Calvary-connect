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

// "Driver Float / Staff Advance" (seeded chart of accounts) — the contra
// account cash_request disbursement/retirement postings clear against, same
// account the accounting spec's "Employee Advances" maps to in this
// codebase's actual chart. Resolved by name + currency rather than a fixed
// code: the seeded chart only has a TZS row (code 1110), and posting a
// foreign-currency line against it fails post_journal_entry's currency
// guard (verified directly — disbursing from the fleet's real USD account
// hits exactly this). Looking it up live surfaces a clear, actionable error
// instead of a confusing mid-transaction currency-mismatch exception, and
// picks up a matching account automatically once someone adds one.
async function resolveCashAdvanceAccountCode(currency: string): Promise<string | null> {
  const { data } = await supabase
    .from("accounts")
    .select("code")
    .or("name.ilike.%driver float%,name.ilike.%staff advance%")
    .eq("currency", currency)
    .eq("is_postable", true)
    .limit(1)
    .maybeSingle();
  return data?.code ?? null;
}

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
    if (kind === "disciplinary_case" && (toState === "hearing" || toState === "resolved") && entity.employee_id) {
      await createNotification({
        userId: entity.employee_id,
        title: toState === "hearing" ? "Disciplinary hearing scheduled" : "Disciplinary case resolved",
        message:
          toState === "hearing"
            ? `A hearing has been scheduled for case ${entity.case_number}.`
            : `Case ${entity.case_number} has been resolved${entity.outcome ? `: ${String(entity.outcome).replace(/_/g, " ")}` : ""}.`,
        type: toState === "resolved" ? "info" : "warning",
        module: "hr",
        entityType: "disciplinary_case",
        entityId: entity.id,
        actionUrl: "/hr/my-hr",
      });
      effects.push("employee_notified");
    }
    if (kind === "separation_case" && toState === "completed" && entity.employee_id) {
      // The one real integration point: separation completing actually
      // deactivates the account, same status/status_reason columns every
      // other active/inactive check in this app already reads.
      await supabase
        .from("user_profiles")
        .update({
          status: "inactive",
          status_reason: `Separation (${entity.separation_type}) completed — last working day ${entity.last_working_day}`,
        })
        .eq("id", entity.employee_id);
      effects.push("employee_deactivated");
    }
    if (kind === "performance_review" && toState === "submitted" && entity.employee_id) {
      await createNotification({
        userId: entity.employee_id,
        title: "Performance review ready",
        message: "A new performance review is ready for you to view and acknowledge.",
        type: "info",
        module: "hr",
        entityType: "performance_review",
        entityId: entity.id,
        actionUrl: "/hr/my-hr",
      });
      effects.push("employee_notified");
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
    let payingAccountId: string;

    // The expense's own bank_account_id (set on the New/Edit Expense form)
    // is authoritative when present — an explicit choice beats guessing.
    // Falling back to "the one active account in this currency" only when
    // the expense never specified one (older rows, or Bulk Expenses which
    // doesn't collect this yet) — and that fallback is now genuinely
    // ambiguous for TZS specifically, since this chart has two active TZS
    // accounts (CRDB TZS and AIRTEL mobile money).
    if (entity.bank_account_id) {
      const { data: chosen, error: chosenErr } = await supabase
        .from("bank_accounts")
        .select("id, currency, is_active")
        .eq("id", entity.bank_account_id)
        .maybeSingle();
      if (chosenErr) {
        return { ok: false, code: "db_error", message: `Could not look up the chosen bank account: ${chosenErr.message}` };
      }
      if (!chosen || !chosen.is_active) {
        return { ok: false, code: "guard_failed", message: "The account chosen to pay this expense is no longer active." };
      }
      if (chosen.currency !== currency) {
        return { ok: false, code: "guard_failed", message: `The chosen account is ${chosen.currency}, but this expense is ${currency}.` };
      }
      payingAccountId = chosen.id;
    } else {
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
              ? `More than one active ${currency} bank account exists — edit this expense to choose which one paid it.`
              : `No active ${currency} bank account found to pay this expense from.`,
        };
      }
      payingAccountId = accounts[0].id;
    }

    // p_contra_account_code (the expense's own COA account, already set by
    // both the single-expense form and Bulk Expenses) makes this mirror into
    // the GL — Dr [expense account] / Cr [bank's linked COA account] —
    // instead of only moving bank_accounts.current_balance. Without it, the
    // bank account's ledger balance (accounts.current_balance) silently
    // never reflects real expense payments while the operational balance
    // does, which is exactly the drift found live: a bank account showing
    // $20,000 operationally against a $-50 GL balance with zero backing
    // transactions on either side.
    //
    // Only passed when the expense account's own currency matches the
    // expense's currency — verified live that this chart of accounts is
    // entirely TZS-denominated except the bank accounts themselves, so
    // unconditionally passing it would hard-fail every non-TZS expense
    // payment on post_journal_entry's currency guard instead of just
    // quietly not mirroring, a regression worse than the gap it fixes.
    let contraAccountCode: string | undefined;
    if (entity.account_code) {
      const { data: expenseAccount } = await supabase
        .from("accounts")
        .select("currency")
        .eq("code", entity.account_code)
        .maybeSingle();
      if (expenseAccount?.currency === currency) contraAccountCode = entity.account_code;
    }

    const { error: txError } = await supabase.rpc("post_bank_transaction", {
      p_bank_account_id: payingAccountId,
      p_amount: (Number(entity.amount) || 0) + (Number(entity.vat_amount) || 0),
      p_direction: "out",
      p_transaction_type: "withdrawal",
      p_currency: currency,
      p_description: entity.description || `Expense payment (${args.entityId})`,
      p_reference_type: "expense",
      p_reference_id: args.entityId,
      p_contra_account_code: contraAccountCode,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (txError) {
      return { ok: false, code: "db_error", message: `Bank account was not debited: ${txError.message}` };
    }
  }

  // Cash request disbursement/retirement — same "verify before the status
  // flips" reasoning as the expense/paid block above. Disbursement debits a
  // real bank account (Dr Driver Float/Staff Advance / Cr Bank); retirement
  // reclassifies the advance into a real expense (Dr Expense / Cr Driver
  // Float/Staff Advance) via a manually-balanced journal entry, since the
  // cash already left the bank at disbursement — retiring it must NOT debit
  // the bank a second time. Any unspent cash physically returned posts a
  // third leg (Dr Bank / Cr Driver Float/Staff Advance).
  let cashRequestDisbursementTxnId: string | undefined;
  let cashRequestRetirementExpenseId: string | undefined;
  let cashRequestRetirementJournalEntryId: string | undefined;
  let cashRequestReturnTxnId: string | undefined;
  let cashRequestActualSpent = 0;
  let cashRequestLineResults: { account_code: string; amount: number; description?: string; receipt_url?: string; expenseId: string }[] = [];

  if (args.kind === "cash_request" && args.toState === "disbursed") {
    const accountId = args.payload?.disbursed_from_account_id;
    if (!accountId) {
      return { ok: false, code: "guard_failed", message: "Choose the account to disburse from." };
    }
    const currency = entity.currency || "TZS";
    const contraCode = await resolveCashAdvanceAccountCode(currency);
    if (!contraCode) {
      return {
        ok: false,
        code: "guard_failed",
        message: `No "Driver Float / Staff Advance" account exists in ${currency} — add one to the Chart of Accounts before disbursing a ${currency} cash request.`,
      };
    }
    const { data: txn, error: txnErr } = await supabase.rpc("post_bank_transaction", {
      p_bank_account_id: accountId,
      p_amount: Number(entity.amount) || 0,
      p_direction: "out",
      p_transaction_type: "cash_advance",
      p_currency: currency,
      p_description: entity.purpose || `Cash advance (${entity.request_number ?? args.entityId})`,
      p_reference_type: "cash_request",
      p_reference_id: args.entityId,
      p_contra_account_code: contraCode,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (txnErr) {
      return { ok: false, code: "db_error", message: `Disbursement failed: ${txnErr.message}` };
    }
    cashRequestDisbursementTxnId = (txn as any)?.id;
  }

  if (args.kind === "cash_request" && args.toState === "retired") {
    type RetirementLine = { account_code: string; amount: number; description?: string; receipt_url?: string };
    const lines: RetirementLine[] = Array.isArray(args.payload?.retirement_lines) ? args.payload.retirement_lines : [];
    const actualSpent = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    const returnedAmount = Number(args.payload?.returned_amount) || 0;
    cashRequestActualSpent = actualSpent;

    if (lines.some((l) => !l.account_code || !(Number(l.amount) > 0))) {
      return { ok: false, code: "guard_failed", message: "Every retirement line needs an account and a positive amount." };
    }
    // Overspend (retired + returned > what was actually disbursed) is a real,
    // legitimate case — an advance that ran short — but must be explicit
    // rather than silently posted, since it means the company owes the
    // employee a reimbursement rather than the reverse.
    const disbursedAmount = Number(entity.amount) || 0;
    if (actualSpent + returnedAmount > disbursedAmount && !args.payload?.allow_overspend) {
      return {
        ok: false,
        code: "guard_failed",
        message: `Retired + returned (${(actualSpent + returnedAmount).toLocaleString()}) exceeds the ${disbursedAmount.toLocaleString()} disbursed — confirm this is a genuine overspend to continue.`,
      };
    }

    if (actualSpent > 0) {
      const currency = entity.currency || "TZS";
      const contraCode = await resolveCashAdvanceAccountCode(currency);
      if (!contraCode) {
        return {
          ok: false,
          code: "guard_failed",
          message: `No "Driver Float / Staff Advance" account exists in ${currency} — add one to the Chart of Accounts before retiring a ${currency} cash request.`,
        };
      }
      const { data: je, error: jeErr } = await supabase
        .from("journal_entries")
        .insert({
          entry_date: new Date().toISOString().slice(0, 10),
          description: `Cash advance retirement — ${entity.purpose || entity.request_number || args.entityId}`,
          is_posted: false,
          status: "draft",
          created_by: args.actorId,
          reference_type: "cash_request",
          reference_id: args.entityId,
          currency,
        })
        .select("id")
        .single();
      if (jeErr) return { ok: false, code: "db_error", message: `Retirement posting failed: ${jeErr.message}` };

      const debitLines = lines.map((l) => ({
        journal_entry_id: je.id,
        account_code: l.account_code,
        debit_amount: Number(l.amount),
        credit_amount: 0,
        description: l.description || entity.purpose,
        currency,
      }));
      const { error: lineErr } = await supabase.from("journal_entry_lines").insert([
        ...debitLines,
        { journal_entry_id: je.id, account_code: contraCode, debit_amount: 0, credit_amount: actualSpent, description: entity.purpose, currency },
      ]);
      if (lineErr) return { ok: false, code: "db_error", message: `Retirement posting failed: ${lineErr.message}` };

      const { error: postErr } = await supabase.rpc("post_journal_entry", { p_id: je.id });
      if (postErr) return { ok: false, code: "db_error", message: `Retirement posting failed: ${postErr.message}` };
      cashRequestRetirementJournalEntryId = je.id;

      // One expense row per line — each shows up in the Expenses list and
      // its Source filter, same as a single-line retirement always has.
      for (const l of lines) {
        const { data: exp, error: expErr } = await supabase
          .from("expenses")
          .insert({
            type: "other",
            description: l.description || entity.purpose || "Cash advance retirement",
            amount: Number(l.amount),
            currency,
            status: "paid",
            date: new Date().toISOString().slice(0, 10),
            created_by: args.actorId,
            cash_request_id: args.entityId,
            journal_entry_id: je.id,
            account_code: l.account_code,
            receipt_url: l.receipt_url || null,
          })
          .select("id")
          .single();
        if (expErr) return { ok: false, code: "db_error", message: `Couldn't record a retirement expense: ${expErr.message}` };
        cashRequestLineResults.push({ ...l, expenseId: exp.id });
      }
      cashRequestRetirementExpenseId = cashRequestLineResults[0]?.expenseId;

      const { error: linesInsertErr } = await supabase.from("cash_request_retirement_lines").insert(
        cashRequestLineResults.map((l) => ({
          cash_request_id: args.entityId,
          account_code: l.account_code,
          amount: l.amount,
          description: l.description || null,
          receipt_url: l.receipt_url || null,
          expense_id: l.expenseId,
          journal_entry_id: je.id,
        })),
      );
      if (linesInsertErr) return { ok: false, code: "db_error", message: `Couldn't save the retirement breakdown: ${linesInsertErr.message}` };
    }

    if (returnedAmount > 0) {
      const returnAccountId = args.payload?.return_bank_account_id;
      if (!returnAccountId) {
        return { ok: false, code: "guard_failed", message: "Choose which account the unspent cash was returned to." };
      }
      const returnCurrency = entity.currency || "TZS";
      const returnContraCode = await resolveCashAdvanceAccountCode(returnCurrency);
      if (!returnContraCode) {
        return {
          ok: false,
          code: "guard_failed",
          message: `No "Driver Float / Staff Advance" account exists in ${returnCurrency} — add one to the Chart of Accounts before recording a returned ${returnCurrency} advance.`,
        };
      }
      const { data: returnTxn, error: returnErr } = await supabase.rpc("post_bank_transaction", {
        p_bank_account_id: returnAccountId,
        p_amount: returnedAmount,
        p_direction: "in",
        p_transaction_type: "cash_advance_return",
        p_currency: returnCurrency,
        p_description: `Unspent cash advance returned (${entity.request_number ?? args.entityId})`,
        p_reference_type: "cash_request",
        p_reference_id: args.entityId,
        p_contra_account_code: returnContraCode,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (returnErr) return { ok: false, code: "db_error", message: `Return posting failed: ${returnErr.message}` };
      cashRequestReturnTxnId = (returnTxn as any)?.id;
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
  if (args.kind === "cash_request") {
    if (args.toState === "approved") {
      updatePayload.approved_by = args.actorId;
      updatePayload.approved_at = new Date().toISOString();
    }
    if (args.toState === "rejected" && args.payload?.reason) {
      updatePayload.rejected_reason = args.payload.reason;
    }
    if (args.toState === "disbursed") {
      updatePayload.disbursed_by = args.actorId;
      updatePayload.disbursed_at = new Date().toISOString();
      updatePayload.disbursed_from_account_id = args.payload?.disbursed_from_account_id;
      // 7 days out, matching Cash Requests' "Overdue >7 Days" tile — a
      // fixed default rather than a Setup-level config, same threshold the
      // spec asked to confirm and this codebase settles on for now.
      const due = new Date();
      due.setDate(due.getDate() + 7);
      updatePayload.due_back_date = due.toISOString().slice(0, 10);
      if (cashRequestDisbursementTxnId) updatePayload.disbursement_bank_transaction_id = cashRequestDisbursementTxnId;
    }
    if (args.toState === "retired") {
      updatePayload.retired_by = args.actorId;
      updatePayload.retired_at = new Date().toISOString();
      updatePayload.actual_spent = cashRequestActualSpent;
      updatePayload.returned_amount = args.payload?.returned_amount ?? 0;
      if (args.payload?.notes) updatePayload.retirement_notes = args.payload.notes;
      if (args.payload?.return_bank_account_id) updatePayload.return_bank_account_id = args.payload.return_bank_account_id;
      if (cashRequestRetirementExpenseId) updatePayload.retirement_expense_id = cashRequestRetirementExpenseId;
      if (cashRequestRetirementJournalEntryId) updatePayload.retirement_journal_entry_id = cashRequestRetirementJournalEntryId;
      if (cashRequestReturnTxnId) updatePayload.return_bank_transaction_id = cashRequestReturnTxnId;
    }
  }
  if (args.kind === "disciplinary_case") {
    if (args.payload?.hearing_date) updatePayload.hearing_date = args.payload.hearing_date;
    if (args.payload?.outcome) updatePayload.outcome = args.payload.outcome;
    if (args.payload?.outcome_notes) updatePayload.outcome_notes = args.payload.outcome_notes;
    if (args.payload?.suspension_days != null) updatePayload.suspension_days = args.payload.suspension_days;
    if (args.toState === "resolved") {
      updatePayload.resolved_by = args.actorId;
      updatePayload.resolved_at = new Date().toISOString();
    }
  }

  // Performance-review acknowledgement is not a plain status UPDATE — it has
  // to run as the SECURITY DEFINER RPC so ownership is checked against the
  // caller's real auth session, not the client-supplied actorId (see
  // state-machines.ts). The RPC does its own status/ownership validation, so
  // this bypasses the generic update below entirely.
  if (args.kind === "performance_review" && args.toState === "acknowledged") {
    const { data: rpcRow, error: rpcError } = await supabase.rpc("acknowledge_performance_review", {
      p_review_id: args.entityId,
      p_comments: args.payload?.comments ?? null,
    });
    if (rpcError) {
      return { ok: false, code: "db_error", message: rpcError.message };
    }

    await AuditTrailService.log({
      user_id: args.actorId,
      module: machine.auditModule,
      action: "approve",
      entity_type: machine.auditEntityType,
      entity_id: args.entityId,
      old_value: { [statusColumn]: rawState },
      new_value: { [statusColumn]: args.toState },
      description: `${transition.label} (${rawState} → ${args.toState})`,
    });

    return { ok: true, entity: rpcRow ?? entity, sideEffects: [] };
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
