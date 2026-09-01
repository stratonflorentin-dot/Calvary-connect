/**
 * Duplicate detection for bank statement imports. The existing New Bank
 * Statement flow only ever checked for an overlapping statement PERIOD
 * (checkOverlap in new/page.tsx) — never individual transaction rows, so
 * re-importing the same file (or an overlapping date range with "allow
 * overlap" checked) could insert the same line twice. This runs against
 * the real bank_statement_lines for the target account before any format's
 * preview is shown as ready to import.
 */
import { supabase } from "@/lib/supabase";
import type { ParsedStatementRow } from "@/lib/finance/bank-statement-csv";

interface ExistingLine {
  transaction_date: string;
  debit_amount: number | null;
  credit_amount: number | null;
  reference_number: string | null;
}

/** Mutates each row's isDuplicate flag in place and returns the count found. */
export async function flagDuplicateRows(bankAccountId: string, rows: ParsedStatementRow[]): Promise<number> {
  if (!bankAccountId || rows.length === 0) return 0;

  const dates = Array.from(new Set(rows.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))));
  if (dates.length === 0) return 0;

  const { data } = await supabase
    .from("bank_statement_lines")
    .select("transaction_date, debit_amount, credit_amount, reference_number")
    .eq("bank_account_id", bankAccountId)
    .in("transaction_date", dates);
  const existing = (data as ExistingLine[]) ?? [];
  if (existing.length === 0) return 0;

  // Strongest signal first: an exact, non-empty reference match on the same
  // date. Falls back to date + exact debit + exact credit, which catches
  // statements that carry no reference at all.
  const byReference = new Set(
    existing.filter((e) => e.reference_number).map((e) => `${e.transaction_date}|${e.reference_number}`),
  );
  const byAmount = new Set(
    existing.map((e) => `${e.transaction_date}|${Number(e.debit_amount) || 0}|${Number(e.credit_amount) || 0}`),
  );

  let count = 0;
  for (const row of rows) {
    const refKey = row.reference ? `${row.date}|${row.reference}` : null;
    const amtKey = `${row.date}|${row.debit || 0}|${row.credit || 0}`;
    const isDup = (refKey !== null && byReference.has(refKey)) || byAmount.has(amtKey);
    row.isDuplicate = isDup;
    if (isDup) count++;
  }
  return count;
}
