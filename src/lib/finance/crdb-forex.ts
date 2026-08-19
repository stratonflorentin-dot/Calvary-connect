/**
 * Parses CRDB Bank's public forex page for live buy/sell rates. Server-only —
 * the page has no API, so this scrapes the same <option buy="" sell=""
 * value="CCY"> markup that drives its own currency-converter widget, which is
 * far more stable to parse than the rendered HTML table.
 */

const CRDB_FOREX_URL = "https://crdbbank.co.tz/en/forex";

export interface CrdbForexRate {
  code: string;
  buy: number;
  sell: number;
  /** Mid-market rate — the average of buy/sell, used for report conversions. */
  mid: number;
}

export async function fetchCrdbForexRates(): Promise<CrdbForexRate[]> {
  const res = await fetch(CRDB_FOREX_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CalvaryConnect/1.0)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CRDB forex page returned ${res.status}`);
  const html = await res.text();

  const seen = new Map<string, CrdbForexRate>();
  const optionPattern = /<option[^>]*\bbuy="([^"]*)"[^>]*\bsell="([^"]*)"[^>]*\bvalue="([A-Z]{3})"/g;
  let match: RegExpExecArray | null;
  while ((match = optionPattern.exec(html)) !== null) {
    const [, buyStr, sellStr, code] = match;
    if (seen.has(code)) continue;
    const buy = Number(buyStr);
    const sell = Number(sellStr);
    if (!buyStr || !sellStr || !Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) continue;
    seen.set(code, { code, buy, sell, mid: (buy + sell) / 2 });
  }

  if (seen.size === 0) throw new Error("Could not find any currency rates on the CRDB forex page — its markup may have changed");
  return [...seen.values()];
}
