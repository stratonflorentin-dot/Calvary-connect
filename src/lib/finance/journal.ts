import { supabase } from "@/lib/supabase";
import { resolveReceivableAccountCode } from "@/lib/finance/ar-ap-accounts";

/**
 * Single call site for every place in the app that moves real money for an
 * invoice, so debit/credit construction never gets inlined into a page
 * component. Each event still lands on a purpose-built server RPC (send_invoice
 * for revenue recognition, post_bank_transaction for cash receipt) — the
 * amounts and account codes differ too much between events to share one
 * generic line-builder safely — but both of those RPCs hand off to the SAME
 * underlying primitive, public.post_journal_entry(), which is what actually
 * validates and posts a balanced entry against the real Chart of Accounts
 * (see supabase/migrations/078_accounts_leaf_only_posting.sql). Nothing here
 * is a stub.
 */
export type JournalEvent =
  | { type: "invoice_sent"; invoiceId: string }
  | {
      type: "invoice_payment";
      invoiceId: string;
      invoiceNumber: string;
      customerName: string;
      bankAccountId: string;
      amount: number;
      currency: string;
    };

export interface JournalPostResult {
  journalEntryId: string | null;
  raw: unknown;
}

export async function postJournalEntry(event: JournalEvent): Promise<JournalPostResult> {
  if (event.type === "invoice_sent") {
    const { data, error } = await supabase.rpc("send_invoice", { p_invoice_id: event.invoiceId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { journalEntryId: row?.journal_entry_id ?? null, raw: row };
  }

  const contraCode = await resolveReceivableAccountCode(event.currency);
  if (!contraCode) {
    throw new Error(`No "Accounts Receivable" account exists in ${event.currency} — add one to the Chart of Accounts first.`);
  }
  const { data, error } = await supabase.rpc("post_bank_transaction", {
    p_bank_account_id: event.bankAccountId,
    p_amount: event.amount,
    p_direction: "in",
    p_transaction_type: "invoice_payment",
    p_currency: event.currency,
    p_description: `Payment for ${event.invoiceNumber} — ${event.customerName}`,
    p_reference_type: "invoice",
    p_reference_id: event.invoiceId,
    p_contra_account_code: contraCode,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { journalEntryId: row?.journal_entry_id ?? null, raw: row };
}
