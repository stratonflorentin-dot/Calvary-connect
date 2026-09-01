/**
 * CSV parsing for bank statement imports, with per-row validation surfaced
 * to the user in a preview step before anything is written to the database.
 * Header matching is permissive (case-insensitive, tolerant of common bank
 * export naming) — same column-detection approach the old inline parser in
 * bank-reconciliation/page.tsx used, factored out so the new preview screen
 * and CSV template share one definition of "what a valid row looks like."
 *
 * normalizeDate/parseAmount/detectColumnIndexes/buildRowsFromCells are
 * exported so the Excel (bank-statement-xlsx.ts) and PDF
 * (bank-statement-pdf.ts) importers can reuse the exact same row-shaping
 * logic instead of re-implementing it — CSV's own behavior here is
 * untouched, this is a pure widen-visibility + extract-a-function refactor.
 */

export interface ParsedStatementRow {
  rowIndex: number; // 1-based, matches the row's position in the source file (excluding header)
  date: string; // ISO yyyy-mm-dd if parseable, otherwise the raw cell
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number | null;
  errors: string[];
  /** Set only by heuristic (PDF) extraction — CSV/Excel rows are structured
   *  data, not guesses, so they're always "high". */
  confidence?: "high" | "review";
  /** Human-readable reason a "review" row needs a second look. */
  issue?: string | null;
  /** True when this row's date+amount+reference already exists in
   *  bank_statement_lines for the target account (see bank-statement-duplicates.ts). */
  isDuplicate?: boolean;
}

export interface ParsedStatement {
  rows: ParsedStatementRow[];
  headerErrors: string[];
}

export interface ColumnIndex {
  date: number;
  description: number;
  reference: number;
  debit: number;
  credit: number;
  balance: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  if (DATE_RE.test(trimmed)) return trimmed;
  // Common bank export formats: dd/mm/yyyy or mm/dd/yyyy — dd/mm/yyyy assumed
  // (matches this app's TZS-market convention), day-first when unambiguous.
  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    const [, a, b, y] = slashMatch;
    const day = Number(a) > 12 ? a : b;
    const month = Number(a) > 12 ? b : a;
    return `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  // "01 Sep 2026" / "1 September 2026"
  const monthNameMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (monthNameMatch) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return trimmed;
}

export function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/** Parenthesized amounts, e.g. "(500,000)", are an accounting convention
 *  for negative — not something the original CSV/Excel parseAmount ever
 *  handled, so this stays a separate opt-in step the PDF parser applies to
 *  its own raw cell text before calling parseAmount, rather than changing
 *  parseAmount's behavior for every existing caller. */
export function normalizeParenthesizedNegative(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/^\((.*)\)$/);
  return m ? `-${m[1]}` : trimmed;
}

/** Matches a header cell against the column it most likely represents.
 *  Same keyword set the CSV parser always used — widened to a named,
 *  reusable function rather than inlined once per parser. */
export function detectColumnIndexes(header: string[]): ColumnIndex {
  const h = header.map((c) => c.trim().toLowerCase());
  return {
    date: h.findIndex((c) => c.includes("date")),
    description: h.findIndex((c) => c.includes("desc") || c.includes("narr") || c.includes("particular")),
    reference: h.findIndex((c) => c.includes("ref") || c.includes("chq") || c.includes("transaction id") || c.includes("txn id")),
    debit: h.findIndex((c) => c === "debit" || c.includes("withdraw") || c.includes(" dr") || c.startsWith("dr") || c.includes("money out")),
    credit: h.findIndex((c) => c === "credit" || c.includes("deposit") || c.includes(" cr") || c.startsWith("cr") || c.includes("money in")),
    balance: h.findIndex((c) => c.includes("balance")),
  };
}

export function headerErrorsFor(idx: ColumnIndex): string[] {
  const errors: string[] = [];
  if (idx.date < 0) errors.push('No "date" column detected.');
  if (idx.debit < 0 && idx.credit < 0) errors.push('No "debit"/"credit" (or "money in"/"money out") column detected.');
  return errors;
}

/** Turns header + data cell-rows (already split into per-column strings —
 *  from a CSV line, an Excel sheet row, or a detected PDF table row) into
 *  ParsedStatementRow[]. The one place all three importers build rows, so
 *  a bug fixed here fixes it everywhere instead of three times. */
export function buildRowsFromCells(idx: ColumnIndex, dataCellRows: string[][]): ParsedStatementRow[] {
  return dataCellRows.map((cols, i) => {
    const errors: string[] = [];

    const rawDate = idx.date >= 0 ? cols[idx.date] ?? "" : "";
    const date = normalizeDate(rawDate);
    if (!DATE_RE.test(date)) errors.push("Unrecognized date.");

    const debit = idx.debit >= 0 ? parseAmount(cols[idx.debit]) : 0;
    const credit = idx.credit >= 0 ? parseAmount(cols[idx.credit]) : 0;
    if (Number.isNaN(debit) || Number.isNaN(credit)) errors.push("Non-numeric amount.");
    else if (debit > 0 && credit > 0) errors.push("Both debit and credit are set — expected one or the other.");
    else if (debit === 0 && credit === 0) errors.push("Neither debit nor credit is set.");

    const balanceRaw = idx.balance >= 0 ? cols[idx.balance] : undefined;
    const balance = balanceRaw ? parseAmount(balanceRaw) : null;
    if (balance !== null && Number.isNaN(balance)) errors.push("Non-numeric balance.");

    return {
      rowIndex: i + 1,
      date,
      description: idx.description >= 0 ? cols[idx.description] ?? "" : "",
      reference: idx.reference >= 0 ? cols[idx.reference] || null : null,
      debit: Number.isNaN(debit) ? 0 : debit,
      credit: Number.isNaN(credit) ? 0 : credit,
      balance: balance !== null && !Number.isNaN(balance) ? balance : null,
      errors,
      confidence: "high",
      issue: null,
    };
  });
}

export function parseStatementCsv(text: string): ParsedStatement {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], headerErrors: ["The file is empty."] };
  }

  const header = lines[0].split(",").map((h) => h.trim());
  const idx = detectColumnIndexes(header);
  const headerErrors = headerErrorsFor(idx);
  if (headerErrors.length > 0) return { rows: [], headerErrors };

  const dataCellRows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
  return { rows: buildRowsFromCells(idx, dataCellRows), headerErrors: [] };
}

export const CSV_TEMPLATE = "date,description,reference,debit,credit,balance\n2026-08-01,Example withdrawal,CHQ001,50000,,1200000\n2026-08-02,Example deposit,REF002,,150000,1350000\n";

export function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bank-statement-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
