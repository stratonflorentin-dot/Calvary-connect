/**
 * Client credit-limit enforcement.
 *
 * customers.credit_limit / credit_limit_currency were stored but never read
 * back anywhere — any customer could run up unlimited exposure regardless of
 * their limit. This is the one correct, currency-scoped outstanding-balance
 * calculation for credit-check purposes: total_amount minus paid_amount,
 * excluding draft/cancelled/paid invoices, never summed across currencies
 * (see src/lib/finance/multi-currency.ts).
 *
 * Scope: enforced at booking creation (the point where the company commits
 * to doing the work) and at manual invoice creation. Quotations are
 * non-binding and are not checked.
 */

import { supabase } from "@/lib/supabase";
import { normalizeCurrency } from "@/lib/finance/multi-currency";

/** Roles allowed to proceed past a credit-limit block with explicit confirmation. */
export const CREDIT_OVERRIDE_ROLES = ["CEO", "ADMIN", "ACCOUNTANT"];

const OPEN_INVOICE_STATUSES = ["pending", "sent", "partial", "overdue", "unpaid"];

export interface CreditCheckResult {
  /** false only when the projected exposure exceeds the limit. */
  ok: boolean;
  /** true when over limit AND the actor's role cannot override. */
  blocked: boolean;
  /** true when over limit but the actor's role CAN proceed with confirmation. */
  overridable: boolean;
  currentExposure: number;
  projectedExposure: number;
  limit: number | null;
  currency: string;
  message: string | null;
}

/**
 * Checks whether adding `newAmount` (in `currency`) for `customerId` would
 * push them over their stored credit limit. Returns ok:true with no message
 * whenever there's nothing to compare — no limit set, or the limit is
 * denominated in a different currency than this document (comparing across
 * currencies without a conversion policy would be worse than not checking).
 */
export async function checkCreditLimit(
  customerId: string | null | undefined,
  currency: string | null | undefined,
  newAmount: number,
  actorRole?: string | null,
): Promise<CreditCheckResult> {
  const ccy = normalizeCurrency(currency);
  const empty: CreditCheckResult = {
    ok: true,
    blocked: false,
    overridable: false,
    currentExposure: 0,
    projectedExposure: 0,
    limit: null,
    currency: ccy,
    message: null,
  };
  if (!customerId || !newAmount || newAmount <= 0) return empty;

  const { data: customer } = await supabase
    .from("customers")
    .select("company_name, credit_limit, credit_limit_currency")
    .eq("id", customerId)
    .maybeSingle();

  const limit = Number(customer?.credit_limit ?? 0);
  const limitCurrency = normalizeCurrency(customer?.credit_limit_currency);
  if (!customer || !limit || limitCurrency !== ccy) {
    return { ...empty, limit: null };
  }

  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("total_amount, amount, paid_amount")
    .eq("customer_id", customerId)
    .eq("currency", ccy)
    .in("status", OPEN_INVOICE_STATUSES);

  const currentExposure = (openInvoices ?? []).reduce((sum, inv: any) => {
    const total = Number(inv.total_amount ?? inv.amount ?? 0);
    const paid = Number(inv.paid_amount ?? 0);
    return sum + Math.max(total - paid, 0);
  }, 0);

  const projectedExposure = currentExposure + newAmount;
  const over = projectedExposure > limit;
  const overridable = over && CREDIT_OVERRIDE_ROLES.includes(String(actorRole || "").toUpperCase());

  return {
    ok: !over,
    blocked: over && !overridable,
    overridable,
    currentExposure,
    projectedExposure,
    limit,
    currency: ccy,
    message: over
      ? `${customer.company_name || "This customer"} has ${currentExposure.toLocaleString()} ${ccy} outstanding against a ${limit.toLocaleString()} ${ccy} credit limit. Adding ${newAmount.toLocaleString()} ${ccy} brings that to ${projectedExposure.toLocaleString()} ${ccy}.`
      : null,
  };
}
