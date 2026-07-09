/**
 * Multi-currency helpers.
 *
 * The company operates in TZS, USD, EUR, and KES. Reports MUST NOT sum across
 * currencies — that produces meaningless numbers. Instead, group by currency
 * and present per-currency subtotals.
 *
 * See memory: multi-currency.
 */

export const REPORTING_CURRENCY = "TZS";
export const KNOWN_CURRENCIES = ["TZS", "USD", "EUR", "KES"] as const;

export function normalizeCurrency(c: string | null | undefined): string {
  const raw = (c ?? "").trim().toUpperCase();
  return raw || REPORTING_CURRENCY;
}

/**
 * Group a list of items by `currency`. Items without a currency are bucketed
 * under the reporting currency (with a note that they need cleanup).
 */
export function groupByCurrency<T extends { currency?: string | null }>(
  items: T[],
): Record<string, T[]> {
  const buckets: Record<string, T[]> = {};
  for (const it of items) {
    const cur = normalizeCurrency(it.currency);
    if (!buckets[cur]) buckets[cur] = [];
    buckets[cur].push(it);
  }
  return buckets;
}

/**
 * Given per-currency totals, order them so the reporting currency comes first,
 * then the most common currencies, then any others alphabetically.
 */
export function sortCurrencyKeys(keys: string[]): string[] {
  const priority = new Map<string, number>(KNOWN_CURRENCIES.map((c, i) => [c, i]));
  return [...keys].sort((a, b) => {
    const pa = priority.get(a) ?? 999;
    const pb = priority.get(b) ?? 999;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
}
