/**
 * Matches an imported bank statement line against existing invoice payments.
 *
 * The bank statement is evidence of what already happened at the bank — if a
 * payment for this money movement was already recorded through the app
 * (src/app/finance/transactions/payments/page.tsx), reconciling should find
 * it instead of letting the accountant re-post it as a brand new
 * transaction. See supabase/migrations/125_payment_bank_transaction_linking.sql
 * for the payments.transaction_reference / bank_transaction_id columns this
 * relies on.
 */

export type MatchConfidence = "exact" | "high" | "likely" | "possible";

export interface PaymentCandidate {
  id: string;
  paymentNumber: string | null;
  invoiceNumber: string | null;
  customerName: string | null;
  amount: number; // signed: positive = money in (receipt), negative = money out
  currency: string;
  paymentDate: string;
  transactionReference: string | null;
  bankTransactionId: string | null;
  reconciled: boolean;
}

export interface StatementLineForMatching {
  referenceNumber: string | null;
  description: string | null;
  amount: number; // signed net amount of the bank line
  date: string;
  currency: string;
}

export interface PaymentMatch {
  candidate: PaymentCandidate;
  confidence: MatchConfidence;
  reason: string;
}

const CONFIDENCE_LABEL: Record<MatchConfidence, string> = {
  exact: "Exact transaction reference",
  high: "Invoice number found in description",
  likely: "Amount and date match",
  possible: "Amount matches",
};

export function matchConfidenceLabel(confidence: MatchConfidence): string {
  return CONFIDENCE_LABEL[confidence];
}

/** Strips everything but letters/digits and upper-cases, so "INV-2026-0020"
 *  and "INV 2026 0020A" (a real bank narration) compare as containing the
 *  same token instead of failing on punctuation/spacing differences. */
function normalize(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function daysBetween(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Infinity;
  return Math.abs(ta - tb) / 86_400_000;
}

/**
 * Returns every candidate payment worth showing the user, best match first.
 * Never auto-picks one — the caller always requires an explicit click to
 * reconcile (see the Reconcile modal in bank-statements/[id]/page.tsx).
 */
export function findPaymentMatches(
  line: StatementLineForMatching,
  payments: PaymentCandidate[],
): PaymentMatch[] {
  const sameDirection = payments.filter(
    (p) => !p.reconciled && p.currency === line.currency && (p.amount >= 0) === (line.amount >= 0),
  );

  const lineRef = normalize(line.referenceNumber);
  const lineDesc = normalize(line.description);
  const results: PaymentMatch[] = [];

  for (const candidate of sameDirection) {
    const amountMatches = Math.abs(Math.abs(candidate.amount) - Math.abs(line.amount)) < 0.5;
    const candidateRef = normalize(candidate.transactionReference);

    // Tier 1 — exact transaction id/reference. Deterministic: a real bank
    // reference is unique (enforced by idx_payments_transaction_reference_unique),
    // so this alone is enough even if the amount were somehow off by a
    // rounding difference.
    if (candidateRef && ((lineRef && lineRef === candidateRef) || (lineDesc && lineDesc.includes(candidateRef)))) {
      results.push({ candidate, confidence: "exact", reason: matchConfidenceLabel("exact") });
      continue;
    }

    // Tier 2 — the invoice number this payment settled shows up in the
    // bank's own narration text (e.g. "...PAYMENT FOR SERVICES INV 2026 0020A").
    const invoiceToken = normalize(candidate.invoiceNumber);
    if (invoiceToken && lineDesc && lineDesc.includes(invoiceToken)) {
      results.push({ candidate, confidence: "high", reason: matchConfidenceLabel("high") });
      continue;
    }

    if (!amountMatches) continue;

    // Tier 3 — same amount, close date.
    if (daysBetween(candidate.paymentDate, line.date) <= 5) {
      results.push({ candidate, confidence: "likely", reason: matchConfidenceLabel("likely") });
      continue;
    }

    // Tier 4 — amount matches, nothing else corroborates it. Multiple
    // candidates can legitimately land here (two payments of the same
    // amount) — the UI must show all of them and require the user to pick.
    results.push({ candidate, confidence: "possible", reason: matchConfidenceLabel("possible") });
  }

  const rank: Record<MatchConfidence, number> = { exact: 0, high: 1, likely: 2, possible: 3 };
  return results.sort((a, b) => rank[a.confidence] - rank[b.confidence]);
}
