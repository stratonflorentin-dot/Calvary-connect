import { supabase } from "@/lib/supabase";
import { resolveReceivableAccountCode } from "@/lib/finance/ar-ap-accounts";
import { AuditTrailService } from "@/services/audit-trail-service";
import { logCustomerActivity } from "@/lib/customer-activity";
import { formatCurrency } from "@/components/ui/currency-badge";

/**
 * The ONE way a customer payment gets created in this app. Before this,
 * /finance/transactions/payments created a real `payments` + `payment_allocations`
 * record, while both the Invoice Detail and Invoice List pages' "Record
 * Payment" actions called postJournalEntry() directly — moving real money
 * and posting a real journal entry, but never creating a `payments` row,
 * so those receipts never showed up in the Payments list, were never
 * matchable by findPaymentMatches(), and could never be reconciled through
 * the bank-statement "invoice_payment" workflow (which keys off payments.id
 * — see 125_payment_bank_transaction_linking.sql). Every caller now goes
 * through this function instead, so there is exactly one payment ledger.
 */
export interface PaymentAllocationInput {
  invoiceId: string;
  invoiceNumber: string;
  invoiceCurrency: string;
  invoiceTotal: number;
  invoicePaidAmount: number;
  amount: number;
}

export interface CreateCustomerPaymentInput {
  customerId: string;
  customerName: string;
  bankAccountId: string;
  amount: number;
  currency: string;
  paymentDate: string;
  method: string;
  notes?: string | null;
  allocations: PaymentAllocationInput[];
  createdBy?: string | null;
}

export interface CreateCustomerPaymentResult {
  paymentId: string;
  paymentNumber: string | null;
  bankTransactionId: string | null;
  journalEntryId: string | null;
  allocatedTotal: number;
  unallocated: number;
}

export async function createCustomerPayment(input: CreateCustomerPaymentInput): Promise<CreateCustomerPaymentResult> {
  const { customerId, customerName, bankAccountId, amount, currency, paymentDate, method, notes, allocations, createdBy } = input;

  if (!customerId) throw new Error("A customer is required.");
  if (!bankAccountId) throw new Error("Choose which bank account received this payment.");
  if (!amount || amount <= 0) throw new Error("Amount must be greater than 0.");

  const allocatedInvoices = allocations.filter((a) => a.amount > 0);
  const allocatedTotal = allocatedInvoices.reduce((s, a) => s + a.amount, 0);
  if (allocatedTotal > amount + 0.01) {
    throw new Error("Allocated more than the payment amount. Reduce an allocation or increase the payment amount.");
  }

  // Same Accounts Receivable lookup postJournalEntry() already uses —
  // resolved once here instead of duplicated per caller.
  const contraCode = await resolveReceivableAccountCode(currency);
  if (!contraCode) {
    throw new Error(`No "Accounts Receivable" account exists in ${currency} — add one to the Chart of Accounts first.`);
  }

  const referenceLabel = allocatedInvoices.length === 0
    ? null
    : allocatedInvoices.length <= 3
      ? allocatedInvoices.map((a) => a.invoiceNumber).join(", ")
      : `${allocatedInvoices.length} invoices`;

  // Atomically deposits into bank_accounts.current_balance and posts the
  // balanced journal entry (migration 035) — the same primitive every
  // money-in flow in this app uses.
  const { data: bankTxn, error: txError } = await supabase.rpc("post_bank_transaction", {
    p_bank_account_id: bankAccountId,
    p_amount: amount,
    p_direction: "in",
    p_transaction_type: "deposit",
    p_currency: currency,
    p_description: `Payment received from ${customerName}`,
    p_reference: allocatedInvoices.length === 1 ? allocatedInvoices[0].invoiceNumber : null,
    p_reference_type: "customer",
    p_reference_id: customerId,
    p_transaction_date: paymentDate,
    p_contra_account_code: contraCode,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (txError) throw txError;
  const bankTxnRow = Array.isArray(bankTxn) ? bankTxn[0] : bankTxn;

  const { data: paymentNumber } = await supabase.rpc("next_doc_number", { p_type: "payment" });

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      payment_number: paymentNumber,
      direction: "in",
      counterparty_type: "customer",
      counterparty_id: customerId,
      counterparty_name: customerName,
      bank_account_id: bankAccountId,
      amount,
      currency,
      payment_date: paymentDate,
      method,
      reference: referenceLabel,
      notes: notes || null,
      status: "posted",
      bank_transaction_id: bankTxnRow?.id ?? null,
      journal_entry_id: bankTxnRow?.journal_entry_id ?? null,
      created_by: createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  if (allocatedInvoices.length > 0) {
    const { error: allocError } = await supabase.from("payment_allocations").insert(
      allocatedInvoices.map((a) => ({ payment_id: payment.id, invoice_id: a.invoiceId, amount: a.amount })),
    );
    if (allocError) throw allocError;

    // Same-currency full/partial settlement — the one rule every payment
    // path in this app already applied; cross-currency allocations are
    // still recorded, but the invoice balance is left for manual
    // reconciliation exactly as before. paid_at/payment_method are set the
    // same way the Invoice Detail page's own (now-retired) direct update
    // used to, so unifying onto this one path doesn't drop those fields.
    for (const a of allocatedInvoices) {
      if (currency !== a.invoiceCurrency) continue;
      const newPaid = Number(a.invoicePaidAmount ?? 0) + a.amount;
      const isPaid = newPaid >= a.invoiceTotal - 0.01;
      await supabase.from("invoices").update({
        paid_amount: newPaid,
        status: isPaid ? "paid" : "partial",
        payment_method: method,
        ...(isPaid ? { paid_at: new Date().toISOString() } : {}),
      }).eq("id", a.invoiceId);
    }
  }

  await AuditTrailService.log({
    user_id: createdBy ?? undefined,
    module: "finance",
    action: "create",
    entity_type: "payment",
    entity_id: payment.id,
    new_value: { amount, currency, allocated: allocatedTotal, unallocated: amount - allocatedTotal },
    description: `Payment ${paymentNumber ?? ""} of ${formatCurrency(amount, currency)} recorded from ${customerName}${allocatedInvoices.length > 0 ? ` — allocated to ${referenceLabel}` : " — not yet allocated"}`,
  });

  logCustomerActivity({
    customerId,
    activityType: "payment",
    description: `Payment ${paymentNumber ?? ""} received${referenceLabel ? ` for ${referenceLabel}` : ""}`,
    amount,
    createdBy,
  });

  return {
    paymentId: payment.id,
    paymentNumber: paymentNumber ?? null,
    bankTransactionId: bankTxnRow?.id ?? null,
    journalEntryId: bankTxnRow?.journal_entry_id ?? null,
    allocatedTotal,
    unallocated: Math.max(0, amount - allocatedTotal),
  };
}
