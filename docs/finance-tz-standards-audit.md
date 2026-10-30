# Finance Module — Tanzania Standards Audit & Upgrade Plan

_Audit of the finance/accounting/payroll logic against current Tanzanian tax & reporting
standards. Figures below are from public 2025/26 sources (TRA, PwC, EY, RSM, NBAA) and
**must be confirmed against the current TRA "Taxes & Duties at a Glance" / Finance Act and the
NSSF/WCF schedules before any tax-amount change goes live** — the sources themselves flag drift._

## TZ standards baseline (researched)

| Area | Standard (2025/26) |
|---|---|
| VAT | Mainland **18%** standard; **0%** exports & international/transit transport; Zanzibar 15% |
| VAT withholding (new, from 1 Jul 2025) | Appointed agents withhold **6% of services / 3% of goods** of the VAT and remit it; supplier remits the balance via VAT return |
| WHT (income tax) on resident service fees | ~**5%** resident / 15% non-resident; **no WHT below an annual aggregate of ~TZS 1,000,000** per payee (confirm) |
| PAYE | Progressive bands, first **TZS 270,000 tax-free**, then 8/20/25/30% (2026 Finance Act may revise band limits) |
| NSSF | **10% employee + 10% employer** |
| SDL | **3.5%** mainland, employers with **≥10 employees** |
| WCF | **0.5%** of payroll (employer) |
| EFD / EFDMS | VAT-registered / turnover ≥ **TZS 11M** must issue **fiscal receipts** with a Receipt Verification Code + QR; a quotation/delivery note is **not** a fiscal receipt; buyers can't claim input VAT without a valid code |
| Reporting | IFRS / **IFRS for SMEs** (NBAA); full IFRS for public-interest entities |

Sources: [PwC Tanzania other taxes](https://taxsummaries.pwc.com/tanzania/corporate/other-taxes) ·
[EY Finance Act 2026](https://taxnews.ey.com/news/2026-1546-tanzanian-finance-act-2026-analysis) ·
[RSM Tanzania Tax Guide 2025/26](https://www.rsm.global/tanzania/sites/default/files/media/documents/RSMTZ_Tanzania%20Tax%20Guide%202025-26.pdf) ·
[TRA EFD/VFD](https://www.tra.go.tz/page/efd-vfd-suppliers) ·
[Tally EFDMS](https://tallysolutions.com/ssa/vat/efdms-in-tanzania/) ·
[NBAA / IFRS jurisdiction profile](https://www.ifrs.org/content/ifrs/home/use-around-the-world/use-of-ifrs-standards-by-jurisdiction/view-jurisdiction.html/tanzania).

## What's already correct (good)

- **Progressive PAYE** with versioned, date-effective rate tables — [statutory-rates.ts](src/lib/finance/payroll/statutory-rates.ts). Bands (270k/520k/760k/1M, 8/20/25/30%) match the 2024/25 structure; NSSF 10+10, SDL 3.5%, WCF 0.5% all correct.
- **Transit transport zero-rated**: [operations/pod/page.tsx:190](src/app/operations/pod/page.tsx) applies 0% VAT to transit trips, 18% to local — correct for cross-border haulage.
- **VAT/WHT invoice math** centralized in [tanzania-tax-rules.ts](src/lib/tanzania-tax-rules.ts) with a WHT exemption threshold and VAT-exclusive WHT base.
- Double-entry posting, balanced journals, and verify-before-flip money movement (workflow engine) are sound (prior audit).

## Findings & recommended upgrades

### Tax-amount-changing — require CEO/ADMIN sign-off + TRA confirmation

1. **PAYE base.** `calcPaye` taxes full `grossPay` ([statutory-rates.ts:100](src/lib/finance/payroll/statutory-rates.ts)). TZ practice allows the **employee's statutory NSSF (10%) as a pre-PAYE deduction**, so PAYE should be computed on `gross − nssfEmployee`. Taxing full gross **over-deducts PAYE**. → Change the base once confirmed; implement as a flag on the rate table so historical payslips are unaffected.
2. **SDL ≥10-employee threshold.** `calcSdl` always charges 3.5% ([statutory-rates.ts:143](src/lib/finance/payroll/statutory-rates.ts)); SDL applies only to employers with ≥10 employees. → Gate at the payroll-run level by active headcount.
3. **WHT threshold & basis.** `WHT_EXEMPT = 500,000` applied **per invoice** on `totalBeforeWHT` ([tanzania-tax-rules.ts:10](src/lib/tanzania-tax-rules.ts)). Standard is **no WHT below ~TZS 1,000,000 annual aggregate per payee**, not TZS 500k per invoice. → Confirm the figure/basis; move the test to annual aggregate per payee.
4. **NHIF 3% flat** ([statutory-rates.ts:76](src/lib/finance/payroll/statutory-rates.ts)) — confirm NHIF even applies to this private workforce and its current rate; may be 0 for them.

### New compliance features (scoped, larger)

5. **VAT withholding regime (from 1 Jul 2025).** Not modelled. If a client is an appointed withholding agent, they withhold 6% of the VAT on services. → Add a `vatWithheld` line to invoice math + the customer-invoice/receipt records.
6. **EFD / fiscal receipts.** Invoices aren't fiscalized (no RVC/QR via EFDMS). For a VAT-registered company this is a legal requirement and blocks clients' input-VAT claims. → Integrate TRA EFDMS (device or VFD) — a dedicated project needing TRA credentials; track separately.

### Safe, non-amount-changing — can do now

7. **Centralize the VAT rate.** `0.18` is hardcoded in [credit-notes](src/app/finance/invoicing/credit-notes/page.tsx), [tax-reports](src/app/finance/reports/tax-reports/page.tsx), [pod](src/app/operations/pod/page.tsx), [purchase-orders](src/app/purchase-orders/page.tsx) instead of one source of truth, while quotations/proforma use `settings.default_vat_rate`. → Export `VAT_RATE` from `tanzania-tax-rules.ts` and have all literals reference it (value unchanged, so no behaviour change), with settings as the configurable override.

## Suggested order

Do #7 now (safe). Confirm #1–#4 against TRA, then apply as versioned rate-table/flag changes (no retroactive effect). Scope #5 and #6 as their own projects. Every tax-amount change lands behind CEO/ADMIN sign-off.
