/**
 * Excel (.xlsx/.xls) bank statement import — same ParsedStatementRow shape
 * and column-detection/row-building the CSV importer uses (bank-statement-csv.ts),
 * just fed from a parsed worksheet instead of split CSV lines, so the New
 * Bank Statement page's preview table and createBatch() need no changes to
 * support it. Uses `xlsx` (SheetJS) — already a dependency, used elsewhere
 * in the app for report exports (e.g. finance/reports/cash-flow) — reading
 * an uploaded file is the same library, not a new one.
 */
import * as XLSX from "xlsx";
import {
  type ParsedStatement,
  detectColumnIndexes,
  headerErrorsFor,
  buildRowsFromCells,
} from "@/lib/finance/bank-statement-csv";

export async function parseStatementXlsx(file: File): Promise<ParsedStatement> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], headerErrors: ["The workbook has no sheets."] };

  const sheet = workbook.Sheets[sheetName];
  // header: 1 -> array-of-arrays of raw cell values, blank rows dropped so a
  // stray spacer row between the header and the first transaction doesn't
  // get read as the header itself.
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
  if (raw.length === 0) return { rows: [], headerErrors: ["The sheet is empty."] };

  const toCell = (v: unknown): string => {
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).trim();
  };

  const header = raw[0].map(toCell);
  const idx = detectColumnIndexes(header);
  const headerErrors = headerErrorsFor(idx);
  if (headerErrors.length > 0) return { rows: [], headerErrors };

  const dataCellRows = raw.slice(1).map((row) => row.map(toCell));
  return { rows: buildRowsFromCells(idx, dataCellRows), headerErrors: [] };
}
