import { NextResponse } from 'next/server';
import { requireFleetReportAccess } from '@/app/api/reports/helpers';
import { generateAI } from '@/lib/ai-provider';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Caps keep a hostile/huge upload from blowing the DB row or the model context.
const MAX_SHEETS = 20;
const MAX_ROWS_PER_SHEET = 1000;
const MAX_COLS = 40;
const MAX_CELL_CHARS = 300;
const MAX_PDF_CHARS = 80_000;
const MAX_PDF_PAGE_CHARS = 4_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type SheetRow = (string | number | null)[];
type StoredSheet = { name: string; rows: SheetRow[]; total_rows: number; truncated: boolean };
type StoredPage = { page: number; text: string };

function capCell(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v);
  return s.length > MAX_CELL_CHARS ? s.slice(0, MAX_CELL_CHARS) : s;
}

function parseExcel(buf: Buffer): { sheets: StoredSheet[]; rowCount: number } {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheets: StoredSheet[] = [];
  let rowCount = 0;
  for (const name of wb.SheetNames.slice(0, MAX_SHEETS)) {
    const ws = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json<SheetRow>(ws, {
      header: 1,
      raw: false,
      defval: null,
      blankrows: false,
    });
    const rows = grid
      .slice(0, MAX_ROWS_PER_SHEET)
      .map((r) => r.slice(0, MAX_COLS).map(capCell));
    rowCount += rows.length;
    sheets.push({ name, rows, total_rows: grid.length, truncated: grid.length > MAX_ROWS_PER_SHEET });
  }
  return { sheets, rowCount };
}

async function parsePdf(buf: Buffer): Promise<{ pages: StoredPage[]; pageCount: number }> {
  // pdfjs-dist legacy build runs in plain Node (no DOM worker). Kept external
  // from the webpack bundle via next.config serverExternalPackages.
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise;
  const pages: StoredPage[] = [];
  let total = 0;
  for (let p = 1; p <= doc.numPages && total < MAX_PDF_CHARS; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let text = content.items.map((it: any) => (typeof it.str === 'string' ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim();
    if (text.length > MAX_PDF_PAGE_CHARS) text = text.slice(0, MAX_PDF_PAGE_CHARS) + '…';
    total += text.length;
    pages.push({ page: p, text });
  }
  return { pages, pageCount: doc.numPages };
}

function excelAnalysisPrompt(fileName: string, sheets: StoredSheet[]): string {
  const dump = sheets
    .map((s) => {
      const head = s.rows[0] ?? [];
      const body = s.rows.slice(1, 201);
      const toCsv = (r: SheetRow) => r.map((c) => (c === null ? '' : String(c))).join(' | ');
      return `SHEET "${s.name}" (${s.total_rows} data rows${s.truncated ? ', showing first 200' : ''}):\nHEADER: ${toCsv(head)}\n${body.map(toCsv).join('\n')}`;
    })
    .join('\n\n');
  return `A user uploaded the Excel file "${fileName}" to the company AI report notebook. Analyse it thoroughly and produce a structured analysis in markdown:

## What this file is
(one short paragraph — inferred purpose of the workbook)
## Sheets
(for each sheet: its purpose, what each column means, row counts)
## Key numbers
(important totals, averages, min/max of numeric-looking columns — compute them from the data)
## Data quality
(missing values, duplicates, inconsistent formats, suspicious outliers)
## Insights & risks
(5 concise findings a freight-company manager would care about)
## Suggested notebook questions
(3 questions the user could ask next)

FILE CONTENT:
${dump}`;
}

function pdfAnalysisPrompt(fileName: string, pages: StoredPage[]): string {
  const dump = pages.map((p) => `[PAGE ${p.page}] ${p.text}`).join('\n');
  return `A user uploaded the PDF document "${fileName}" to the company AI report notebook. Analyse it thoroughly and produce a structured analysis in markdown:

## What this document is
(type of document, parties involved, purpose)
## Key figures & dates
(amounts, currencies, deadlines, reference numbers — exact values from the text)
## Obligations & risks
(payment terms, penalties, expiries, compliance items)
## Summary
(5 bullet points)
## Suggested notebook questions
(3 questions the user could ask next)

DOCUMENT TEXT:
${dump}`;
}

export async function GET(request: Request) {
  try {
    const admin = await requireFleetReportAccess(request);
    const { data, error } = await admin
      .from('notebook_sources')
      .select('id, name, file_name, kind, row_count, analysis, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ sources: data ?? [] });
  } catch (err: any) {
    const msg = err?.message || 'Failed to load sources';
    const status = msg.startsWith('UNAUTHORIZED') ? 401 : msg.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireFleetReportAccess(request);
    // Server clients have no session — getUser() needs the caller's own JWT.
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const { data: { user } } = await admin.auth.getUser(token);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
    }

    const lower = file.name.toLowerCase();
    const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');
    const isPdf = lower.endsWith('.pdf');
    if (!isExcel && !isPdf) {
      return NextResponse.json({ error: 'Unsupported file — upload .xlsx, .xls, .csv or .pdf' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    let kind: 'excel' | 'pdf';
    let sheets: StoredSheet[] | null = null;
    let pages: StoredPage[] | null = null;
    let rowCount = 0;

    if (isExcel) {
      kind = 'excel';
      const parsed = parseExcel(buf);
      sheets = parsed.sheets;
      rowCount = parsed.rowCount;
      if (!sheets.length) return NextResponse.json({ error: 'Workbook has no readable sheets' }, { status: 400 });
    } else {
      kind = 'pdf';
      const parsed = await parsePdf(buf);
      pages = parsed.pages;
      rowCount = parsed.pageCount;
      const chars = pages.reduce((s, p) => s + p.text.length, 0);
      if (chars < 20) return NextResponse.json({ error: 'PDF has no extractable text (scanned image?)' }, { status: 400 });
    }

    const prompt =
      kind === 'excel' && sheets
        ? excelAnalysisPrompt(file.name, sheets)
        : pdfAnalysisPrompt(file.name, pages ?? []);
    const result = await generateAI({
      system: 'You are a meticulous senior data analyst. Analyse the provided file content only — never invent numbers you cannot see in it.',
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      maxTokens: 3000,
    });

    const name = (form.get('name') as string | null) || file.name.replace(/\.[^.]+$/, '');
    const { data: inserted, error: insertError } = await admin
      .from('notebook_sources')
      .insert({
        name,
        file_name: file.name,
        kind,
        sheets,
        pages,
        row_count: rowCount,
        analysis: result.text,
        created_by: user?.id ?? null,
      })
      .select('id, name, file_name, kind, row_count, analysis, created_at')
      .single();
    if (insertError) throw insertError;

    return NextResponse.json({ source: inserted });
  } catch (err: any) {
    console.error('notebook sources POST error:', err);
    const msg = err?.message || 'Upload failed';
    const status = msg.startsWith('UNAUTHORIZED') ? 401 : msg.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireFleetReportAccess(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await admin.from('notebook_sources').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const msg = err?.message || 'Delete failed';
    const status = msg.startsWith('UNAUTHORIZED') ? 401 : msg.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
