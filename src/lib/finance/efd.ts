/**
 * EFD / EFDMS fiscalization seam (Tanzania).
 *
 * In Tanzania a VAT-registered business (turnover ≥ ~TZS 11M) must issue
 * **fiscal** receipts/invoices through a TRA-approved Electronic Fiscal Device
 * (EFD) or Virtual Fiscal Device (VFD). A fiscal document carries a Receipt
 * Verification Code (RVC) and a QR code linking to TRA's verification URL; a
 * plain quotation/invoice PDF is NOT a fiscal receipt, and a buyer cannot claim
 * input VAT without a valid verification code.
 *
 * This module is the integration SEAM, not a working fiscalizer. A real
 * connection needs, from TRA, a registered VFD and its credentials, plus the
 * TRA EFDMS XML schema. Until those are configured, `fiscalizeInvoice` reports
 * that fiscalization is unavailable — it never invents an RVC/QR, because a
 * fabricated fiscal code is a forged tax document.
 *
 * See docs/efd-integration.md for what must be provisioned to connect a VFD.
 */

export interface FiscalResult {
  /** A real fiscal document was produced by a TRA-approved device. */
  fiscalized: boolean;
  /** Receipt Verification Code printed on the fiscal receipt. */
  rvc?: string;
  /** TRA verification URL the QR code encodes. */
  verificationUrl?: string;
  /** Device/VFD serial that issued it. */
  deviceSerial?: string;
  /** ISO timestamp the device assigned. */
  issuedAt?: string;
  /** When not fiscalized, why — surfaced to the user, never hidden. */
  reason?: string;
}

export interface FiscalInvoiceInput {
  invoiceNumber: string;
  currency: string;
  customerName?: string;
  customerTin?: string;
  customerVrn?: string;
  /** VAT-exclusive line subtotal. */
  subtotal: number;
  vatAmount: number;
  total: number;
}

/** True only when a real VFD endpoint + credentials are configured. */
export function isEfdConfigured(): boolean {
  return Boolean(
    process.env.TRA_VFD_URL &&
      process.env.TRA_VFD_TIN &&
      process.env.TRA_VFD_CERT,
  );
}

/**
 * Submit an invoice for fiscalization. Returns a non-fiscalized result with a
 * clear reason until a TRA-approved VFD is wired in (see docs/efd-integration.md).
 * The real implementation will sign and POST the TRA EFDMS XML payload to the
 * VFD and return the device's RVC/QR — it must never be stubbed with fake codes.
 */
export async function fiscalizeInvoice(_input: FiscalInvoiceInput): Promise<FiscalResult> {
  if (!isEfdConfigured()) {
    return {
      fiscalized: false,
      reason:
        "EFD/VFD is not configured. Provision a TRA-approved VFD and set TRA_VFD_URL / TRA_VFD_TIN / TRA_VFD_CERT to issue fiscal receipts. See docs/efd-integration.md.",
    };
  }
  // Intentionally not implemented: connecting a real VFD requires the TRA
  // EFDMS XML schema and device credentials. Throwing here (rather than
  // returning a fake RVC) makes an un-finished integration fail loudly.
  throw new Error(
    "EFD fiscalization endpoint is configured but the EFDMS client is not implemented yet. See docs/efd-integration.md.",
  );
}
