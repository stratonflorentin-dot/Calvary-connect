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
// VAT withholding regime (Finance Act 2025, from 1 Jul 2025): when the customer
// is a TRA-appointed VAT withholding agent, they withhold part of the VAT and
// remit it to TRA directly; the supplier is paid the balance and remits the rest
// via its VAT return. For services the agent withholds 6% of the taxable value
// (the supplier remits the remaining 12%); for goods it is 3% / 15%. CONFIRM the
// current rates and appointed-agent rules with TRA before a live run.
const VAT_WITHHOLDING_SERVICE_RATE = 0.06;

export interface InvoiceTotals {
  subtotal: number;
  vatAmount: number;
  totalBeforeWHT: number;
  whtAmount: number;
  /** VAT withheld at source by a VAT-withholding-agent customer (0 otherwise). */
  vatWithheld: number;
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
  /**
   * The customer is a TRA-appointed VAT withholding agent for services: they
   * withhold 6% of the taxable value as VAT and pay the supplier the balance.
   * Defaults to false (ordinary customer — no VAT withheld at source).
   */
  vatWithholdingAgent?: boolean;
}): InvoiceTotals {
  const { subtotal, vatApplicable, whtApplicable, priorPaymentsToPayeeThisYear = 0, vatWithholdingAgent = false } = params;
  const vatAmount = vatApplicable ? subtotal * VAT_RATE : 0;
  const totalBeforeWHT = subtotal + vatAmount;
  // WHT base is the service fee (VAT-exclusive); it applies once cumulative fees
  // to the payee this year exceed the annual threshold.
  const aggregateFees = priorPaymentsToPayeeThisYear + subtotal;
  const whtAmount = whtApplicable && aggregateFees > WHT_ANNUAL_THRESHOLD ? subtotal * WHT_RATE : 0;
  // VAT withheld at source reduces what the customer pays the supplier (the
  // supplier still shows full VAT on the invoice, but receives VAT less the
  // amount the agent remits directly to TRA).
  const vatWithheld = vatApplicable && vatWithholdingAgent ? subtotal * VAT_WITHHOLDING_SERVICE_RATE : 0;
  const totalPayable = totalBeforeWHT - whtAmount - vatWithheld;
  return { subtotal, vatAmount, totalBeforeWHT, whtAmount, vatWithheld, totalPayable };
}
