/**
 * Excel (.xlsx/.xls) bank statement import — same ParsedStatementRow shape
 * and column-detection/row-building the CSV importer uses (bank-statement-csv.ts),
 * just fed from a parsed worksheet instead of split CSV lines, so the New
 * Bank Statement page's preview table and createBatch() need no changes to
 * support it. Uses `exceljs` — replacing xlsx (SheetJS) for security.
 */
import * as ExcelJS from "exceljs";
import {
  type ParsedStatement,
  detectColumnIndexes,
  headerErrorsFor,
  buildRowsFromCells,
} from "@/lib/finance/bank-statement-csv";

export async function parseStatementXlsx(file: File): Promise<ParsedStatement> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const sheetName = workbook.worksheets[0]?.name;
  if (!sheetName) return { rows: [], headerErrors: ["The workbook has no sheets."] };

  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return { rows: [], headerErrors: ["The sheet is empty."] };

  const raw: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const rowData: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      rowData[colNumber - 1] = cell.value;
    });
    raw.push(rowData);
  });
  
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
