/**
 * Tanzania Revenue Authority (TRA) tax constants and invoice math.
 *
 * Single source of truth for VAT/WHT — previously duplicated inline in
 * `tra-invoice-dialog.tsx` with no other caller able to reuse it.
 */

export const VAT_RATE = 0.18; // 18% VAT
export const WHT_RATE = 0.05; // 5% Withholding Tax (transport services)
export const WHT_EXEMPT = 500_000; // WHT not applicable below TZS 500,000

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
}): InvoiceTotals {
  const { subtotal, vatApplicable, whtApplicable } = params;
  const vatAmount = vatApplicable ? subtotal * VAT_RATE : 0;
  const totalBeforeWHT = subtotal + vatAmount;
  const whtAmount = whtApplicable && totalBeforeWHT > WHT_EXEMPT ? subtotal * WHT_RATE : 0;
  const totalPayable = totalBeforeWHT - whtAmount;
  return { subtotal, vatAmount, totalBeforeWHT, whtAmount, totalPayable };
}
