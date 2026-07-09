/**
 * Foreign-exchange rate service.
 *
 * Rates are stored in `fx_rates` (from_ccy, to_ccy, rate, effective_date).
 * Callers ask for the rate to convert `amount from CCY into TZS on DATE`; we
 * pick the row with the greatest effective_date ≤ DATE. If no direct rate is
 * on file, we try to compose via `TZS` (the reporting currency) as a bridge.
 *
 * IMPORTANT: this is a helper for *consolidation*. Native-currency amounts
 * are still the source of truth — never overwrite them with converted values.
 */

import { supabase } from "@/lib/supabase";
import { REPORTING_CURRENCY, normalizeCurrency } from "./multi-currency";

export interface FxRate {
  id: string;
  from_ccy: string;
  to_ccy: string;
  rate: number;
  effective_date: string; // YYYY-MM-DD
  source?: string | null;
  note?: string | null;
}

const cache: { rows: FxRate[] | null; loadedAt: number } = { rows: null, loadedAt: 0 };
const CACHE_TTL_MS = 60_000;

async function loadRates(force = false): Promise<FxRate[]> {
  if (!force && cache.rows && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.rows;
  }
  const { data } = await supabase
    .from("fx_rates")
    .select("*")
    .order("effective_date", { ascending: false });
  cache.rows = (data ?? []) as FxRate[];
  cache.loadedAt = Date.now();
  return cache.rows;
}

export async function refreshRates(): Promise<void> {
  await loadRates(true);
}

function findRate(
  rates: FxRate[],
  from: string,
  to: string,
  onOrBefore: string,
): FxRate | null {
  const asMs = new Date(onOrBefore).getTime();
  const eligible = rates.filter(
    (r) =>
      r.from_ccy.toUpperCase() === from &&
      r.to_ccy.toUpperCase() === to &&
      new Date(r.effective_date).getTime() <= asMs,
  );
  if (eligible.length === 0) return null;
  return eligible[0]; // list is already sorted DESC by effective_date
}

/**
 * Return the rate that converts 1 unit of `from` into `to` as-of `asOf`.
 * Returns null if no rate can be resolved (direct or via TZS bridge).
 */
export async function getRate(
  from: string,
  to: string,
  asOf: string = new Date().toISOString().slice(0, 10),
): Promise<number | null> {
  const f = normalizeCurrency(from);
  const t = normalizeCurrency(to);
  if (f === t) return 1;
  const rates = await loadRates();

  const direct = findRate(rates, f, t, asOf);
  if (direct) return direct.rate;

  // Try inverse
  const inv = findRate(rates, t, f, asOf);
  if (inv && inv.rate !== 0) return 1 / inv.rate;

  // Try via reporting currency
  if (f !== REPORTING_CURRENCY && t !== REPORTING_CURRENCY) {
    const [fToRep, repToT] = await Promise.all([
      getRate(f, REPORTING_CURRENCY, asOf),
      getRate(REPORTING_CURRENCY, t, asOf),
    ]);
    if (fToRep != null && repToT != null) return fToRep * repToT;
  }

  return null;
}

/**
 * Convert `amount from` into `to` using the rate as-of `asOf`.
 * Returns `null` if no rate is available.
 */
export async function convert(
  amount: number,
  from: string,
  to: string = REPORTING_CURRENCY,
  asOf?: string,
): Promise<number | null> {
  const rate = await getRate(from, to, asOf);
  if (rate == null) return null;
  return amount * rate;
}

/**
 * Convert an amount using a pre-loaded map of `${from}->${to}` rates.
 * Useful when converting many rows in a render without awaiting each time.
 */
export function convertSync(
  amount: number,
  from: string,
  to: string,
  rateMap: Record<string, number>,
): number | null {
  const f = normalizeCurrency(from);
  const t = normalizeCurrency(to);
  if (f === t) return amount;
  const rate = rateMap[`${f}->${t}`];
  if (rate == null) return null;
  return amount * rate;
}

/**
 * Preload a rate map covering every combination of currencies in `from` → `to`.
 * Missing rates map to `undefined`; callers should treat that as "cannot convert".
 */
export async function loadRateMap(
  froms: string[],
  to: string = REPORTING_CURRENCY,
  asOf?: string,
): Promise<Record<string, number>> {
  const target = normalizeCurrency(to);
  const map: Record<string, number> = {};
  await Promise.all(
    froms.map(async (f) => {
      const source = normalizeCurrency(f);
      const r = await getRate(source, target, asOf);
      if (r != null) map[`${source}->${target}`] = r;
    }),
  );
  return map;
}

export async function saveRate(rate: Omit<FxRate, "id">): Promise<FxRate | null> {
  const { data, error } = await supabase.from("fx_rates").insert(rate).select().maybeSingle();
  if (error) throw error;
  await refreshRates();
  return (data ?? null) as FxRate | null;
}
