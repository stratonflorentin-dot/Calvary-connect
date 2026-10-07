import { NextResponse } from 'next/server';
import { requireFleetReportAccess } from '@/app/api/reports/helpers';
import { generateAI } from '@/lib/ai-provider';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LIVE_SOURCE_KEYS = [
  'revenue_by_vehicle',
  'driver_performance',
  'route_profitability',
  'fuel_per_trip',
  'trip_cost_variance',
  'fleet_snapshot',
  'monthly_reports',
] as const;
type LiveSourceKey = (typeof LIVE_SOURCE_KEYS)[number];

type SheetRow = (string | number | null)[];

function sum(list: any[], pick: (r: any) => number) {
  return list.reduce((s, r) => s + (Number(pick(r)) || 0), 0);
}

function inRange(iso: string | null | undefined, start: string, end: string) {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  return d >= start && d <= end;
}

/** Compact per-source live data fetchers. Each is defensive: a failing source
 *  degrades to an error note instead of killing the whole request. */
async function fetchLiveSource(
  key: LiveSourceKey,
  admin: ReturnType<Awaited<ReturnType<typeof requireFleetReportAccess>>>,
  start: string,
  end: string,
): Promise<string> {
  const asTable = (title: string, rows: string[][], maxRows = 60) =>
    rows.length <= 1
      ? `${title}: no data for ${start} → ${end}`
      : `${title} (top ${Math.min(maxRows, rows.length - 1)} rows):\n${rows[0].join(' | ')}\n${rows.slice(1, maxRows + 1).map((r) => r.join(' | ')).join('\n')}`;

  switch (key) {
    case 'revenue_by_vehicle': {
      const { data, error } = await admin
        .from('trips')
        .select('total_amount, sales_amount, currency, status, vehicles(plate_number), created_at')
        .eq('status', 'delivered')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`)
        .limit(2000);
      if (error) throw error;
      const byVehicle = new Map<string, { trips: number; byCur: Record<string, number> }>();
      for (const t of data ?? []) {
        const plate = (t as any).vehicles?.plate_number ?? 'Unassigned';
        const cur = (t as any).currency || 'TZS';
        const amt = Number((t as any).total_amount ?? (t as any).sales_amount) || 0;
        const e = byVehicle.get(plate) ?? { trips: 0, byCur: {} };
        e.trips++;
        e.byCur[cur] = (e.byCur[cur] ?? 0) + amt;
        byVehicle.set(plate, e);
      }
      const rows: string[][] = [['Vehicle', 'Delivered trips', 'Revenue by currency']];
      for (const [plate, e] of [...byVehicle.entries()].sort((a, b) => b[1].trips - a[1].trips)) {
        rows.push([plate, String(e.trips), Object.entries(e.byCur).map(([c, v]) => `${c} ${Math.round(v).toLocaleString()}`).join(', ')]);
      }
      return asTable('Revenue by vehicle', rows);
    }
    case 'driver_performance': {
      const { data, error } = await admin
        .from('trips')
        .select('total_amount, sales_amount, currency, status, user_profiles(name), created_at')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`)
        .limit(2000);
      if (error) throw error;
      const byDriver = new Map<string, { total: number; delivered: number; byCur: Record<string, number> }>();
      for (const t of data ?? []) {
        const name = (t as any).user_profiles?.name ?? 'Unassigned';
        const cur = (t as any).currency || 'TZS';
        const amt = Number((t as any).total_amount ?? (t as any).sales_amount) || 0;
        const e = byDriver.get(name) ?? { total: 0, delivered: 0, byCur: {} };
        e.total++;
        if ((t as any).status === 'delivered') e.delivered++;
        e.byCur[cur] = (e.byCur[cur] ?? 0) + amt;
        byDriver.set(name, e);
      }
      const rows: string[][] = [['Driver', 'Trips', 'Delivered', 'Revenue by currency']];
      for (const [name, e] of [...byDriver.entries()].sort((a, b) => b[1].total - a[1].total)) {
        rows.push([name, String(e.total), String(e.delivered), Object.entries(e.byCur).map(([c, v]) => `${c} ${Math.round(v).toLocaleString()}`).join(', ')]);
      }
      return asTable('Driver performance', rows);
    }
    case 'route_profitability': {
      const { data, error } = await admin
        .from('trips')
        .select('origin, destination, total_amount, sales_amount, currency, status, created_at')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`)
        .limit(2000);
      if (error) throw error;
      const byRoute = new Map<string, { trips: number; delivered: number; byCur: Record<string, number> }>();
      for (const t of data ?? []) {
        const key2 = `${(t as any).origin || '?'} → ${(t as any).destination || '?'}`;
        const cur = (t as any).currency || 'TZS';
        const amt = Number((t as any).total_amount ?? (t as any).sales_amount) || 0;
        const e = byRoute.get(key2) ?? { trips: 0, delivered: 0, byCur: {} };
        e.trips++;
        if ((t as any).status === 'delivered') e.delivered++;
        e.byCur[cur] = (e.byCur[cur] ?? 0) + amt;
        byRoute.set(key2, e);
      }
      const rows: string[][] = [['Route', 'Trips', 'Delivered', 'Revenue by currency']];
      for (const [route, e] of [...byRoute.entries()].sort((a, b) => b[1].trips - a[1].trips)) {
        rows.push([route, String(e.trips), String(e.delivered), Object.entries(e.byCur).map(([c, v]) => `${c} ${Math.round(v).toLocaleString()}`).join(', ')]);
      }
      return asTable('Route profitability', rows);
    }
    case 'fuel_per_trip': {
      // Real fuel data lives in fuel_logs (litres, total_cost, fuel_date).
      // fuel_requests is only driver refill requests (amount/status) — wrong
      // table for spend analysis.
      const { data, error } = await admin
        .from('fuel_logs')
        .select('litres, total_cost, fuel_date, vehicles(plate_number)')
        .gte('fuel_date', start)
        .lte('fuel_date', end)
        .order('fuel_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows: string[][] = [['Date', 'Vehicle', 'Litres', 'Cost']];
      for (const f of (data ?? []).slice(0, 60) as any[]) {
        rows.push([
          String(f.fuel_date ?? '').slice(0, 10),
          f.vehicles?.plate_number ?? '—',
          String(f.litres ?? '—'),
          String(f.total_cost ?? '—'),
        ]);
      }
      const litres = sum(data ?? [], (r) => r.litres);
      const cost = sum(data ?? [], (r) => r.total_cost);
      rows.unshift(['TOTAL (all rows)', '', String(Math.round(litres)), String(Math.round(cost)), `${data?.length ?? 0} records (TZS assumed)`]);
      return asTable('Fuel records', rows);
    }
    case 'trip_cost_variance': {
      const { data, error } = await admin
        .from('expenses')
        .select('amount, currency, category, date')
        .gte('date', start)
        .lte('date', end)
        .limit(2000);
      if (error) throw error;
      const byCat = new Map<string, Record<string, number>>();
      for (const e of data ?? []) {
        const cur = (e as any).currency || 'TZS';
        const k = `${(e as any).category || 'Uncategorised'} [${cur}]`;
        const m = byCat.get(k) ?? {};
        m[cur] = (m[cur] ?? 0) + (Number((e as any).amount) || 0);
        byCat.set(k, m);
      }
      const rows: string[][] = [['Category', 'Total']];
      for (const [k, m] of [...byCat.entries()].sort((a, b) => sum(Object.values(b[1]), (v) => v) - sum(Object.values(a[1]), (v) => v))) {
        rows.push([k, Object.entries(m).map(([c, v]) => `${c} ${Math.round(v).toLocaleString()}`).join(', ')]);
      }
      return asTable('Expenses by category', rows);
    }
    case 'fleet_snapshot': {
      // Light, targeted queries — NOT getFleetContext(), which fires 15
      // broad queries per call. The notebook fetches on every question, so
      // this stays to the three things a snapshot needs: fleet status,
      // cash position, and outstanding receivables.
      const [veh, cash, ar] = await Promise.all([
        admin.from('vehicles').select('plate_number, status, mileage').limit(50),
        admin.from('bank_accounts').select('account_name, currency, current_balance').eq('is_active', true),
        admin
          .from('invoices')
          .select('invoice_number, total_amount, currency, status, customers:customer_id(company_name)')
          // type column: 'receivable' vs 'payable'; legacy rows have NULL, treated as receivable
          .or('type.is.null,type.eq.receivable')
          .neq('status', 'paid')
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(15),
      ]);
      const vehicleRows = (veh.data ?? []).map((v: any) => [v.plate_number, v.status ?? '—', String(v.mileage ?? '—')]);
      const cashRows = (cash.data ?? []).map((a: any) => [a.account_name ?? '—', a.currency || 'TZS', String(a.current_balance ?? '—')]);
      const arRows = (ar.data ?? []).map((i: any) => [
        i.invoice_number ?? '—',
        i.customers?.company_name ?? '—',
        `${i.currency || 'TZS'} ${Number(i.total_amount || 0).toLocaleString()}`,
        i.status ?? '—',
      ]);
      return [
        asTable('Fleet (current status)', [['Plate', 'Status', 'Mileage'], ...vehicleRows]),
        asTable('Cash position (current)', [['Account', 'Currency', 'Balance'], ...cashRows]),
        asTable('Outstanding receivables (latest 15)', [['Invoice', 'Customer', 'Amount', 'Status'], ...arRows]),
      ].join('\n\n');
    }
    case 'monthly_reports': {
      const { data, error } = await admin
        .from('monthly_reports')
        .select('*')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(24);
      if (error) throw error;
      if (!data?.length) return `monthly_reports: none generated between ${start} and ${end}`;
      const rows: string[][] = data.slice(0, 12).map((r: any) =>
        Object.entries(r).filter(([, v]) => v !== null && v !== '').slice(0, 10).map(([k, v]) => `${k}=${String(v).slice(0, 60)}`),
      );
      return `Monthly reports (${data.length} found):\n${rows.map((r) => r.join(' | ')).join('\n')}`;
    }
  }
}

function sheetsToPromptText(sheets: any[], maxRowsPerSheet = 150): string {
  return (sheets ?? [])
    .map((s: any) => {
      const toCsv = (r: SheetRow) => (r ?? []).map((c) => (c === null || c === undefined ? '' : String(c))).join(' | ');
      const rows: SheetRow[] = s.rows ?? [];
      return `SHEET "${s.name}" (${s.total_rows ?? rows.length} data rows${s.truncated ? ', showing first ' + maxRowsPerSheet : ''}):\n${rows.slice(0, maxRowsPerSheet).map(toCsv).join('\n')}`;
    })
    .join('\n\n');
}

function pagesToPromptText(pages: any[], maxChars = 20_000): string {
  const text = (pages ?? []).map((p: any) => `[PAGE ${p.page}] ${p.text}`).join('\n');
  return text.length > maxChars ? text.slice(0, maxChars) + '…' : text;
}

export async function POST(request: Request) {
  try {
    const admin = await requireFleetReportAccess(request);
    const body = await request.json().catch(() => ({}));
    const {
      question,
      history = [],
      liveSources = [],
      fileSourceIds = [],
      startDate,
      endDate,
      user = null,
    } = body as {
      question: string;
      history?: { role: 'user' | 'model'; text: string }[];
      liveSources?: string[];
      fileSourceIds?: string[];
      startDate?: string;
      endDate?: string;
      user?: { name?: string; email?: string; role?: string } | null;
    };

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }
    const start = typeof startDate === 'string' && startDate ? startDate : new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const end = typeof endDate === 'string' && endDate ? endDate : new Date().toISOString().slice(0, 10);

    // 1. Live sources — fetched fresh on every question (real-time).
    const sections: string[] = [];
    const liveKeys = liveSources.filter((s): s is LiveSourceKey => (LIVE_SOURCE_KEYS as readonly string[]).includes(s));
    for (const key of liveKeys) {
      try {
        const text = await fetchLiveSource(key, admin, start, end);
        sections.push(`### LIVE SOURCE: ${key}\n${text}`);
      } catch (err: any) {
        sections.push(`### LIVE SOURCE: ${key}\n(failed to fetch: ${err?.message || 'error'})`);
      }
    }

    // 2. Stored file sources (Excel / PDF uploads).
    if (fileSourceIds.length) {
      const { data: fileRows, error: fileError } = await admin
        .from('notebook_sources')
        .select('id, name, file_name, kind, sheets, pages, analysis')
        .in('id', fileSourceIds.slice(0, 10));
      if (fileError) throw fileError;
      for (const f of fileRows ?? []) {
        const content =
          f.kind === 'excel'
            ? sheetsToPromptText(f.sheets ?? [])
            : pagesToPromptText(f.pages ?? []);
        sections.push(
          `### UPLOADED ${f.kind === 'excel' ? 'EXCEL' : 'PDF'} SOURCE: "${f.name}" (${f.file_name})\n` +
            `Analysis made at upload:\n${f.analysis ?? '(none)'}\n\nRaw content:\n${content}`,
        );
      }
    }

    if (!sections.length) {
      return NextResponse.json({ error: 'Select at least one source before asking a question.' }, { status: 400 });
    }

    const system = `You are the Calvary Report Notebook — a rigorous business analyst for CALVARY INVESTMENT CO. LTD (road freight, Dar es Salaam). You answer ONLY from the sources provided below; if something is not in them, say so explicitly instead of inventing it. Report periods and "current" figures exactly as labelled. The company operates in multiple currencies (TZS/USD) — never add different currencies together.
${user?.name ? `\nYou are speaking with ${user.name}${user.role ? ` (role: ${user.role})` : ''} — tailor depth and vocabulary accordingly.` : ''}

=== SOURCES (fetched ${new Date().toISOString()}) ===
${sections.join('\n\n')}

=== RULES ===
- Cite which source(s) each claim comes from, e.g. (revenue_by_vehicle) or ("Q1 petty cash.xlsx").
- Show the numbers you base conclusions on. Compare uploaded-file figures against live figures when both are present and call out mismatches.
- Be concise; markdown with headers and bullets; always state currency.
- End with "Next step:" and one concrete action.`;

    const result = await generateAI({
      system,
      messages: [
        ...history.slice(-10).map((h) => ({ role: h.role, content: [{ text: h.text }] })),
        { role: 'user', content: [{ text: question }] },
      ],
      maxTokens: 2500,
    });
    return NextResponse.json({ text: result.text, provider: result.provider, fetchedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('notebook POST error:', err);
    const msg = err?.message || 'Notebook query failed';
    const status = msg.startsWith('UNAUTHORIZED') ? 401 : msg.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
