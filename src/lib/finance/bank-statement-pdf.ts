/**
 * Text-based PDF bank statement import.
 *
 * There is no real sample bank statement PDF anywhere in this repository to
 * calibrate against (checked before writing this — see the audit note in
 * the final report), so this is a GENERIC layout detector rather than a
 * bank-specific one: it locates the header row by keyword, uses that row's
 * word X-positions as column boundaries, and assigns every later line's
 * words to the nearest boundary at or before them. That covers the layouts
 * the spec describes (Date/Description/Debit/Credit/Balance in any order,
 * a single signed "Amount" column, a DR/CR suffix on amounts) without
 * hardcoding any one bank's format. A bank whose statement doesn't put its
 * column headers on one recognizable row will need a dedicated adapter —
 * this file is structured (extractStatementPdf -> detectHeaderLine ->
 * assignColumns) so one can be added alongside this generic path later
 * without touching it.
 *
 * Every row this produces still goes through the SAME preview/duplicate
 * check/createBatch() flow as CSV and Excel rows — nothing here posts,
 * reconciles, or classifies anything. Rows this heuristic is unsure about
 * are marked confidence:"review" rather than silently guessed.
 */
import {
  type ParsedStatement,
  type ParsedStatementRow,
  type ColumnIndex,
  parseAmount,
  normalizeParenthesizedNegative,
  buildRowsFromCells,
} from "@/lib/finance/bank-statement-csv";

export interface ParsedPdfStatement extends ParsedStatement {
  /** true when the PDF has no extractable text at all (a scan/image) — the
   *  caller should offer OCR (not implemented — see the final report) or a
   *  different format instead of reporting "0 transactions found". */
  isScanned: boolean;
  pageCount: number;
  openingBalance: number | null;
  closingBalance: number | null;
}

interface Token {
  text: string;
  x: number;
  y: number;
}

const HEADER_KEYWORDS = ["date", "debit", "credit", "balance", "description", "narrative", "amount", "reference"];
const NOISE_LINE_RE = /^(page\s+\d+(\s+of\s+\d+)?|statement\s+of\s+account|continued|carried\s+forward)$/i;
const OPENING_RE = /(opening|brought forward|b\/f)\s*balance|balance\s*(brought forward|b\/f)/i;
const CLOSING_RE = /(closing|carried forward|c\/f)\s*balance|balance\s*(carried forward|c\/f)/i;
const DRCR_SUFFIX_RE = /\b(DR|CR|Dr|Cr)\b\.?$/;

function lazyPdfjs() {
  // Loaded on demand (browser only) — pdfjs-dist pulls in a worker script
  // that has no meaning during a server-side build.
  return import("pdfjs-dist");
}

/** Groups a page's text items into visual lines (same Y, within tolerance)
 *  then sorts each line's tokens left-to-right. PDF.js reports Y growing
 *  upward, so lines come out top-to-bottom once sorted descending. */
function toLines(tokens: Token[]): Token[][] {
  const sorted = [...tokens].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Token[][] = [];
  const TOLERANCE = 2.5;
  for (const t of sorted) {
    const line = lines.find((l) => Math.abs(l[0].y - t.y) <= TOLERANCE);
    if (line) line.push(t);
    else lines.push([t]);
  }
  for (const l of lines) l.sort((a, b) => a.x - b.x);
  return lines;
}

function lineText(line: Token[]): string {
  return line.map((t) => t.text).join(" ").replace(/\s+/g, " ").trim();
}

/** The header line is whichever line matches the most distinct column
 *  keywords — a plain "Date  Description  Debit  Credit  Balance" row. */
function detectHeaderLine(lines: Token[][]): { line: Token[]; index: number } | null {
  let best: { line: Token[]; index: number; score: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const text = lineText(lines[i]).toLowerCase();
    if (!text.includes("date")) continue;
    const score = HEADER_KEYWORDS.filter((k) => text.includes(k)).length;
    if (score >= 2 && (!best || score > best.score)) best = { line: lines[i], index: i, score };
  }
  return best ? { line: best.line, index: best.index } : null;
}

interface DetectedColumn {
  label: string;
  x: number;
  kind: "date" | "description" | "reference" | "debit" | "credit" | "balance" | "amount" | "ignore";
}

function classifyHeaderWord(word: string): DetectedColumn["kind"] {
  const w = word.toLowerCase();
  if (w.includes("date")) return "date";
  if (w.includes("desc") || w.includes("narr") || w.includes("particular")) return "description";
  if (w.includes("ref") || w.includes("chq") || w.includes("id")) return "reference";
  if (w === "debit" || w.includes("withdraw") || w === "dr" || w.includes("money out")) return "debit";
  if (w === "credit" || w.includes("deposit") || w === "cr" || w.includes("money in")) return "credit";
  if (w.includes("balance")) return "balance";
  if (w.includes("amount")) return "amount";
  return "ignore";
}

/** Header words tend to be single tokens with generous spacing — cluster by
 *  a fixed gap rather than needing per-statement tuning. */
function clusterHeaderColumns(line: Token[]): DetectedColumn[] {
  const cols: DetectedColumn[] = [];
  let current: Token[] = [];
  const GAP = 15;
  for (let i = 0; i < line.length; i++) {
    if (current.length > 0 && line[i].x - current[current.length - 1].x > GAP) {
      const label = current.map((t) => t.text).join(" ");
      cols.push({ label, x: current[0].x, kind: classifyHeaderWord(label) });
      current = [];
    }
    current.push(line[i]);
  }
  if (current.length > 0) {
    const label = current.map((t) => t.text).join(" ");
    cols.push({ label, x: current[0].x, kind: classifyHeaderWord(label) });
  }
  return cols.filter((c) => c.kind !== "ignore");
}

/** Assigns every token in a data line to the nearest column boundary at or
 *  before its X position, then joins each column's tokens in order. */
function assignToColumns(line: Token[], columns: DetectedColumn[]): string[] {
  const cells = columns.map(() => [] as string[]);
  for (const t of line) {
    let best = 0;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].x <= t.x + 1) best = i;
    }
    cells[best].push(t.text);
  }
  return cells.map((c) => c.join(" ").replace(/\s+/g, " ").trim());
}

function stripDrCr(raw: string): { value: string; direction: "debit" | "credit" | null } {
  const trimmed = raw.trim();
  const suffix = trimmed.match(DRCR_SUFFIX_RE);
  if (suffix) {
    const dir = suffix[1].toUpperCase() === "DR" ? "debit" : "credit";
    return { value: trimmed.slice(0, suffix.index).trim(), direction: dir };
  }
  const prefixMatch = trimmed.match(/^(DR|CR)\b\.?\s*/i);
  if (prefixMatch) {
    const dir = prefixMatch[1].toUpperCase() === "DR" ? "debit" : "credit";
    return { value: trimmed.slice(prefixMatch[0].length).trim(), direction: dir };
  }
  return { value: trimmed, direction: null };
}

export async function extractStatementPdf(file: File): Promise<ParsedPdfStatement> {
  const pdfjsLib = await lazyPdfjs();
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pageLines: Token[][][] = [];
  let totalChars = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const tokens: Token[] = content.items
      .filter((it): it is typeof it & { str: string } => "str" in it && it.str.trim().length > 0)
      .map((it: any) => ({ text: it.str.trim(), x: it.transform[4], y: it.transform[5] }));
    totalChars += tokens.reduce((s, t) => s + t.text.length, 0);
    pageLines.push(toLines(tokens));
  }

  if (totalChars < 20) {
    return {
      rows: [], headerErrors: [], isScanned: true, pageCount: doc.numPages,
      openingBalance: null, closingBalance: null,
    };
  }

  // Header is detected once (first page it appears on) and reused for every
  // page — later pages that repeat the header row have that repeat skipped
  // by exact-text match against it, not re-detected (a bank's continuation
  // pages sometimes format the repeated header slightly differently).
  let columns: DetectedColumn[] | null = null;
  let headerText = "";
  for (const lines of pageLines) {
    const found = detectHeaderLine(lines);
    if (found) {
      columns = clusterHeaderColumns(found.line);
      headerText = lineText(found.line).toLowerCase();
      break;
    }
  }

  if (!columns || columns.length < 2 || !columns.some((c) => c.kind === "date")) {
    return {
      rows: [], headerErrors: ["Could not identify transaction columns in this PDF."],
      isScanned: false, pageCount: doc.numPages, openingBalance: null, closingBalance: null,
    };
  }

  const idx: ColumnIndex = {
    date: columns.findIndex((c) => c.kind === "date"),
    description: columns.findIndex((c) => c.kind === "description"),
    reference: columns.findIndex((c) => c.kind === "reference"),
    debit: columns.findIndex((c) => c.kind === "debit"),
    credit: columns.findIndex((c) => c.kind === "credit"),
    balance: columns.findIndex((c) => c.kind === "balance"),
  };
  const signedAmountCol = columns.findIndex((c) => c.kind === "amount");

  let openingBalance: number | null = null;
  let closingBalance: number | null = null;
  const dataCellRows: string[][] = [];
  const reviewFlags: (string | null)[] = [];

  for (const lines of pageLines) {
    for (const line of lines) {
      const text = lineText(line);
      if (!text || NOISE_LINE_RE.test(text)) continue;
      if (text.toLowerCase() === headerText) continue; // repeated header on a later page

      if (OPENING_RE.test(text)) {
        const amt = text.match(/[\d,]+\.\d{2}|[\d,]+/);
        if (amt) openingBalance = parseAmount(amt[0]);
        continue;
      }
      if (CLOSING_RE.test(text)) {
        const amt = text.match(/[\d,]+\.\d{2}|[\d,]+/);
        if (amt) closingBalance = parseAmount(amt[0]);
        continue;
      }

      const cells = assignToColumns(line, columns);
      const dateCell = idx.date >= 0 ? cells[idx.date] : "";
      // A data row must have something recognizable as a date — this is how
      // stray footer/margin text on the same page gets excluded rather than
      // imported as a garbage transaction.
      if (!/\d/.test(dateCell)) continue;

      let issue: string | null = null;
      if (signedAmountCol >= 0) {
        // Single signed-amount column (with an optional DR/CR marker) —
        // split into the debit/credit cell pair buildRowsFromCells expects,
        // without changing that shared function's column contract.
        const { value, direction } = stripDrCr(cells[signedAmountCol]);
        const normalized = normalizeParenthesizedNegative(value);
        const n = parseAmount(normalized);
        const isNegative = normalized.trim().startsWith("-") || direction === "debit";
        const debitCell = isNegative ? String(Math.abs(n)) : "";
        const creditCell = !isNegative ? String(Math.abs(n)) : "";
        cells[idx.debit >= 0 ? idx.debit : cells.length] = debitCell;
        if (idx.debit < 0) idx.debit = cells.length - 1;
        cells[idx.credit >= 0 ? idx.credit : cells.length] = creditCell;
        if (idx.credit < 0) idx.credit = cells.length - 1;
        if (!direction && !normalized.match(/^-?\d/)) issue = "Amount could not be confidently parsed.";
      }

      dataCellRows.push(cells);
      reviewFlags.push(issue);
    }
  }

  const rows: ParsedStatementRow[] = buildRowsFromCells(idx, dataCellRows).map((row, i) => {
    const flagged = reviewFlags[i];
    const needsReview = flagged || row.errors.length > 0;
    return {
      ...row,
      confidence: needsReview ? "review" : "high",
      issue: flagged ?? (row.errors.length > 0 ? row.errors.join(" ") : null),
    };
  });

  return {
    rows, headerErrors: [], isScanned: false, pageCount: doc.numPages,
    openingBalance, closingBalance,
  };
}
