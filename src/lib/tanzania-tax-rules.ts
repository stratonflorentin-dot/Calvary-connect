/**
 * Tanzania Revenue Authority (TRA) tax constants and invoice math.
 *
 * Single source of truth for VAT/WHT — previously duplicated inline in
 * `tra-invoice-dialog.tsx` with no other caller able to reuse it.
 */

export const VAT_RATE = 0.18; // 18% VAT (Mainland Tanzania standard rate)
const WHT_RATE = 0.05; // 5% Withholding Tax (resident transport/service fees)
// WHT on resident service fees does not apply until the *cumulative* payments to
// a payee in the year of income exceed this threshold (not per invoice). CONFIRM
// the current figure and basis with TRA (Income Tax Act) before a live run.
const WHT_ANNUAL_THRESHOLD = 1_000_000;

export interface InvoiceTotals {
  subtotal: number;
  vatAmount: number;
  totalBeforeWHT: number;
  whtAmount: number;
  totalPayable: number;
}

export function calculateInvoiceTotals(params: {
  subtotal: number;
  vatApplicable: boolean;
  whtApplicable: boolean;
  /**
   * Total fees already paid to this payee earlier in the year of income, so WHT
   * is withheld only once the annual aggregate crosses the threshold. Defaults
   * to 0 (treats this invoice on its own against the threshold).
   */
  priorPaymentsToPayeeThisYear?: number;
}): InvoiceTotals {
  const { subtotal, vatApplicable, whtApplicable, priorPaymentsToPayeeThisYear = 0 } = params;
  const vatAmount = vatApplicable ? subtotal * VAT_RATE : 0;
  const totalBeforeWHT = subtotal + vatAmount;
  // WHT base is the service fee (VAT-exclusive); it applies once cumulative fees
  // to the payee this year exceed the annual threshold.
  const aggregateFees = priorPaymentsToPayeeThisYear + subtotal;
  const whtAmount = whtApplicable && aggregateFees > WHT_ANNUAL_THRESHOLD ? subtotal * WHT_RATE : 0;
  const totalPayable = totalBeforeWHT - whtAmount;
  return { subtotal, vatAmount, totalBeforeWHT, whtAmount, totalPayable };
}
