# EFD / EFDMS Fiscal Receipts — integration requirements

Tanzania requires VAT-registered businesses to issue **fiscal** receipts/invoices through a
TRA-approved Electronic Fiscal Device (EFD) or Virtual Fiscal Device (VFD). The app currently
produces a well-formatted **tax invoice PDF**, which is *not* a fiscal receipt: it has no Receipt
Verification Code (RVC) or TRA QR code, so a customer cannot use it to claim input VAT.

This is a compliance feature that **cannot be completed in code alone** — it needs provisioning from
TRA. The code seam is in place ([src/lib/finance/efd.ts](src/lib/finance/efd.ts)); it reports
"not configured" and never fabricates a fiscal code.

## What must be provisioned (owner / TRA)

1. A TRA-approved **VFD** (virtual fiscal device) or physical EFD, registered to the company's TIN/VRN.
2. VFD **credentials**: endpoint URL, registration/serial, and the signing certificate/keys TRA issues.
3. The current **TRA EFDMS XML schema** (receipt payload format) for the device's protocol version.

Set these as environment variables (read by `isEfdConfigured()`):

```
TRA_VFD_URL=...     # VFD fiscalization endpoint
TRA_VFD_TIN=...     # company TIN registered with the device
TRA_VFD_CERT=...    # signing certificate / key material
```

## What the code work will be (once provisioned)

1. Implement the EFDMS client in `fiscalizeInvoice`: build the TRA EFDMS XML for the invoice, sign it
   with the device cert, POST to the VFD, and parse the returned **RVC + verification URL**.
2. Add invoice columns (migration, needs sign-off): `fiscal_rvc`, `fiscal_qr_url`, `fiscal_device_serial`,
   `fiscalized_at`, `fiscal_status`.
3. Call `fiscalizeInvoice` when an invoice is issued; store the result; render the RVC + QR on the
   invoice PDF ([tra-invoice-dialog.tsx](src/components/financial/tra-invoice-dialog.tsx)).
4. Block/annotate "download invoice" as **proforma / not-yet-fiscalized** until fiscalization succeeds,
   so a non-fiscal document is never mistaken for a fiscal receipt.

## Status

- Seam + config guard: done.
- VAT withholding (related Finance Act 2025 change): implemented in `calculateInvoiceTotals`
  (`vatWithholdingAgent` → `vatWithheld`); UI toggle + an invoice column to persist it still to do
  (migration under sign-off). See [finance-tz-standards-audit.md](docs/finance-tz-standards-audit.md).
- Real EFDMS client: **blocked on TRA VFD provisioning** (above).
