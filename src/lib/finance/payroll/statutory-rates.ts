/**
 * Tanzania statutory payroll calculations — PAYE, NSSF, NHIF, SDL, WCF.
 *
 * IMPORTANT — READ BEFORE DEPLOYING TO A REAL PAYROLL RUN:
 * The numeric rates and bands below are carried over from the existing
 * `helpers.ts` (PAYE, NSSF) plus documented statutory rules (SDL, WCF), but
 * they are NOT verified against a current TRA/NSSF/WCF/NHIF gazette by this
 * change. Tanzania's PAYE bands and NHIF/WCF rates are revised periodically
 * (e.g. in the annual Finance Act). Before this runs real payroll:
 *   1. Confirm the current PAYE bands + rates with TRA (Income Tax Act, as
 *      amended by the latest Finance Act).
 *   2. Confirm the current NSSF contribution rate/ceiling.
 *   3. Confirm NHIF is even the right scheme for your workforce (some
 *      employers now fall under different mandatory health-fund rules) and
 *      its current contribution rate.
 *   4. Confirm SDL is 3.5% for most employers (4% was an older/transport-
 *      sector-specific rate in some periods) and your business's exemption
 *      status (SDL has payroll-size exemptions).
 *   5. Confirm WCF's actual gazetted rate for the "transport & logistics"
 *      class of business — the previous code had this literally marked as
 *      a placeholder.
 *
 * WHY THIS IS STRUCTURED AS A RATE TABLE, NOT INLINE CONSTANTS:
 * Every value below carries `effectiveFrom`. `getActiveRateTable()` picks
 * the table whose effective date covers the payslip's period, so re-running
 * or viewing a historical payslip continues to use the rates that were in
 * force *at that time*, and a future rate change is a new table entry, not
 * a code change + redeploy.
 */

export interface PayeBand {
  /** Upper bound of this band's *taxable* income, in TZS. `null` = no upper bound. */
  upTo: number | null;
  /** Marginal rate applied to the portion of income that falls in this band. */
  rate: number;
}

export interface StatutoryRateTable {
  effectiveFrom: string; // ISO date, e.g. '2024-07-01'
  /**
   * Progressive PAYE bands. Bands are cumulative — income is taxed band by
   * band, not by applying one rate to the whole gross (that was the bug in
   * the previous implementation: it multiplied the *entire* gross by
   * whichever single bracket it landed in, which creates a cliff where
   * crossing a threshold by TZS 1 could cost tens of thousands of TZS more
   * in tax than staying just under it).
   */
  payeBands: PayeBand[];
  nssf: {
    employeeRate: number; // e.g. 0.10 = 10% of pensionable pay
    employerRate: number;
  };
  /** NHIF as a flat rate of gross pay. Replace with a band table via
   *  `nhifBands` instead if your current NHIF scheme is band-based rather
   *  than a flat percentage — both shapes are supported below. */
  nhifRate?: number;
  nhifBands?: PayeBand[];
  sdlRate: number; // employer-only, % of gross payroll
  wcfRate: number; // employer-only, % of gross payroll
}

// ── Rate tables ─────────────────────────────────────────────────────────────
// Only one table today. Add a new entry (with its own effectiveFrom) when
// rates change — do not mutate this one, so historical payslips stay correct.
const RATE_TABLES: StatutoryRateTable[] = [
  {
    effectiveFrom: '2024-01-01',
    payeBands: [
      { upTo: 270000, rate: 0 },
      { upTo: 520000, rate: 0.08 },
      { upTo: 760000, rate: 0.20 },
      { upTo: 1000000, rate: 0.25 },
      { upTo: null, rate: 0.30 },
    ],
    nssf: { employeeRate: 0.10, employerRate: 0.10 },
    nhifRate: 0.03, // 3% of gross — VERIFY against current NHIF Tanzania circular before using
    sdlRate: 0.035,
    wcfRate: 0.005, // VERIFY against the gazetted WCF rate for your business class
  },
];

export function getActiveRateTable(asOfDate: string | Date = new Date()): StatutoryRateTable {
  const target = typeof asOfDate === 'string' ? asOfDate : asOfDate.toISOString().slice(0, 10);
  const applicable = RATE_TABLES
    .filter((t) => t.effectiveFrom <= target)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  if (applicable.length === 0) {
    throw new Error(`No statutory rate table is effective as of ${target}`);
  }
  return applicable[0];
}

/**
 * Progressive PAYE — taxes each slice of income only at that slice's rate,
 * carrying forward from the previous band's ceiling. This is the fix for
 * the bracket-cliff bug: e.g. with the bands above, gross of exactly
 * 520,001 pays 0% on the first 270,000, 8% on the next 250,000, and 20%
 * only on the single shilling above 520,000 — not 20% on the whole amount.
 */
export function calcPaye(grossPay: number, asOfDate?: string | Date): number {
  const table = getActiveRateTable(asOfDate);
  let remaining = Math.max(0, grossPay);
  let tax = 0;
  let lowerBound = 0;

  for (const band of table.payeBands) {
    const bandCeiling = band.upTo ?? Infinity;
    const bandWidth = bandCeiling - lowerBound;
    const taxableInBand = Math.min(remaining, bandWidth);
    if (taxableInBand > 0) {
      tax += taxableInBand * band.rate;
      remaining -= taxableInBand;
    }
    lowerBound = bandCeiling;
    if (remaining <= 0) break;
  }

  return Math.round(tax);
}

export function calcNssfEmployee(grossPay: number, asOfDate?: string | Date): number {
  const table = getActiveRateTable(asOfDate);
  return Math.round(grossPay * table.nssf.employeeRate);
}

export function calcNssfEmployer(grossPay: number, asOfDate?: string | Date): number {
  const table = getActiveRateTable(asOfDate);
  return Math.round(grossPay * table.nssf.employerRate);
}

export function calcNhif(grossPay: number, asOfDate?: string | Date): number {
  const table = getActiveRateTable(asOfDate);
  if (table.nhifBands) {
    for (const band of table.nhifBands) {
      if (band.upTo === null || grossPay <= band.upTo) return band.rate;
    }
    return table.nhifBands[table.nhifBands.length - 1]?.rate ?? 0;
  }
  return Math.round(grossPay * (table.nhifRate ?? 0));
}

/** Employer-only cost — not deducted from the employee. */
export function calcSdl(grossPay: number, asOfDate?: string | Date): number {
  const table = getActiveRateTable(asOfDate);
  return Math.round(grossPay * table.sdlRate);
}

/** Employer-only cost — not deducted from the employee. */
export function calcWcf(grossPay: number, asOfDate?: string | Date): number {
  const table = getActiveRateTable(asOfDate);
  return Math.round(grossPay * table.wcfRate);
}

export interface PayslipCalculation {
  grossPay: number;
  paye: number;
  nssfEmployee: number;
  nssfEmployer: number;
  nhifEmployee: number;
  sdl: number;
  wcf: number;
  otherDeductions: number;
  netPay: number;
}

/**
 * Computes a full payslip's statutory lines from gross pay. `otherDeductions`
 * (loan repayments, advances, etc.) is passed through as-is — it's not a
 * statutory number, just a pass-through so callers have one function that
 * returns a complete, reconciled payslip.
 */
export function calculatePayslip(
  grossPay: number,
  otherDeductions: number = 0,
  asOfDate?: string | Date,
): PayslipCalculation {
  const paye = calcPaye(grossPay, asOfDate);
  const nssfEmployee = calcNssfEmployee(grossPay, asOfDate);
  const nssfEmployer = calcNssfEmployer(grossPay, asOfDate);
  const nhifEmployee = calcNhif(grossPay, asOfDate);
  const sdl = calcSdl(grossPay, asOfDate);
  const wcf = calcWcf(grossPay, asOfDate);
  const netPay = grossPay - paye - nssfEmployee - nhifEmployee - otherDeductions;

  return {
    grossPay,
    paye,
    nssfEmployee,
    nssfEmployer,
    nhifEmployee,
    sdl,
    wcf,
    otherDeductions,
    netPay: Math.round(netPay),
  };
}
