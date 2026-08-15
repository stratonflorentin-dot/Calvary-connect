/**
 * Aging bucket math shared by the finance dashboard, aging report, and
 * customer/vendor invoice pages. One source of truth so a bucket labelled
 * "31-60" means the same thing everywhere.
 */

export type AgingBucketKey = "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";

export const AGING_BUCKETS: {
  key: AgingBucketKey;
  label: string;
  min: number;
  max: number | null;
  color: string;
  textColor: string;
}[] = [
  { key: "current", label: "Current", min: -Infinity, max: 0, color: "bg-emerald-100 border-emerald-200", textColor: "text-emerald-700" },
  { key: "d1_30", label: "1-30 days", min: 1, max: 30, color: "bg-amber-100 border-amber-200", textColor: "text-amber-700" },
  { key: "d31_60", label: "31-60 days", min: 31, max: 60, color: "bg-orange-100 border-orange-200", textColor: "text-orange-700" },
  { key: "d61_90", label: "61-90 days", min: 61, max: 90, color: "bg-rose-100 border-rose-200", textColor: "text-rose-700" },
  { key: "d90_plus", label: "90+ days", min: 91, max: null, color: "bg-red-200 border-red-300", textColor: "text-red-800" },
];

/**
 * Days past due (negative means "not yet due").
 */
export function daysOverdue(dueDate: string | Date | null | undefined, now: Date = new Date()): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate).getTime();
  return Math.floor((now.getTime() - due) / (1000 * 60 * 60 * 24));
}

export function bucketFor(dueDate: string | Date | null | undefined, now: Date = new Date()): AgingBucketKey {
  const d = daysOverdue(dueDate, now);
  for (const b of AGING_BUCKETS) {
    if (d >= b.min && (b.max == null || d <= b.max)) return b.key;
  }
  return "current";
}

interface AgingInput {
  amount: number | string;
  due_date?: string | null;
  status?: string | null;
  customer_name?: string | null;
  vendor?: string | null;
  invoice_number?: string | null;
  id?: string;
  currency?: string | null;
}

/** Window used for the "due soon" / "due within next month" stat. */
export const DUE_SOON_WINDOW_DAYS = 30;

export interface AgingSummary {
  totals: Record<AgingBucketKey, number>;
  counts: Record<AgingBucketKey, number>;
  totalOutstanding: number;
  totalOverdue: number;
  /** Open, not-yet-overdue balance falling due within DUE_SOON_WINDOW_DAYS. */
  totalDueSoon: number;
  worstDays: number;
}

const OPEN_STATUSES = new Set(["pending", "sent", "partial", "overdue", "unpaid"]);

/**
 * Only invoices/bills that are still open contribute to aging.
 * Paid / cancelled / draft rows are ignored.
 */
export function isOpenForAging(status: string | null | undefined): boolean {
  if (!status) return true;
  return OPEN_STATUSES.has(status.toLowerCase());
}

export function summarize(items: AgingInput[]): AgingSummary {
  const totals: Record<AgingBucketKey, number> = {
    current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0,
  };
  const counts: Record<AgingBucketKey, number> = {
    current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0,
  };
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let totalDueSoon = 0;
  let worstDays = 0;

  for (const it of items) {
    if (!isOpenForAging(it.status)) continue;
    const amt = Number(it.amount) || 0;
    if (amt <= 0) continue;
    const bucket = bucketFor(it.due_date);
    const d = daysOverdue(it.due_date);
    totals[bucket] += amt;
    counts[bucket] += 1;
    totalOutstanding += amt;
    if (d > 0) totalOverdue += amt;
    else if (d >= -DUE_SOON_WINDOW_DAYS) totalDueSoon += amt;
    if (d > worstDays) worstDays = d;
  }
  return { totals, counts, totalOutstanding, totalOverdue, totalDueSoon, worstDays };
}

export function topOverdue(items: AgingInput[], limit = 5): AgingInput[] {
  return items
    .filter((i) => isOpenForAging(i.status) && daysOverdue(i.due_date) > 0)
    .sort((a, b) => daysOverdue(b.due_date) - daysOverdue(a.due_date))
    .slice(0, limit);
}

/**
 * Multi-currency aging: returns one AgingSummary per currency present in the
 * input. Do NOT sum across the returned map — the whole point is to keep the
 * currencies separate.
 */
export function summarizeByCurrency(items: AgingInput[]): Record<string, AgingSummary> {
  const out: Record<string, AgingInput[]> = {};
  for (const it of items) {
    const cur = (it.currency ?? "TZS").trim().toUpperCase() || "TZS";
    if (!out[cur]) out[cur] = [];
    out[cur].push(it);
  }
  const result: Record<string, AgingSummary> = {};
  for (const [cur, list] of Object.entries(out)) {
    result[cur] = summarize(list);
  }
  return result;
}

export function formatCurrencyShort(v: number, cur = "TZS"): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${cur} ${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${cur} ${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${cur} ${(v / 1_000).toFixed(1)}K`;
  return `${cur} ${v.toFixed(0)}`;
}
