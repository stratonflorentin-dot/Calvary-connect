/**
 * CSV parsing for bank statement imports, with per-row validation surfaced
 * to the user in a preview step before anything is written to the database.
 * Header matching is permissive (case-insensitive, tolerant of common bank
 * export naming) — same column-detection approach the old inline parser in
 * bank-reconciliation/page.tsx used, factored out so the new preview screen
 * and CSV template share one definition of "what a valid row looks like."
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
}

export interface ParsedStatement {
  rows: ParsedStatementRow[];
  headerErrors: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(raw: string): string {
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
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return trimmed;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function parseStatementCsv(text: string): ParsedStatement {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], headerErrors: ["The file is empty."] };
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    date: header.findIndex((h) => h.includes("date")),
    description: header.findIndex((h) => h.includes("desc") || h.includes("narr") || h.includes("particular")),
    reference: header.findIndex((h) => h.includes("ref") || h.includes("chq")),
    debit: header.findIndex((h) => h === "debit" || h.includes("withdraw") || h.includes(" dr") || h.startsWith("dr")),
    credit: header.findIndex((h) => h === "credit" || h.includes("deposit") || h.includes(" cr") || h.startsWith("cr")),
    balance: header.findIndex((h) => h.includes("balance")),
  };

  const headerErrors: string[] = [];
  if (idx.date < 0) headerErrors.push('No "date" column detected.');
  if (idx.debit < 0 && idx.credit < 0) headerErrors.push('No "debit" or "credit" column detected.');
  if (headerErrors.length > 0) return { rows: [], headerErrors };

  const rows: ParsedStatementRow[] = lines.slice(1).map((line, i) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
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
    };
  });

  return { rows, headerErrors: [] };
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
