-- Adds the letterhead fields the Quotation/Invoice PDFs need that
-- company_settings didn't have yet — bank details for the "Bank / A/C
-- Name / Account No. / Branch Code / Swift Code" block, a tagline, and
-- invoice-specific terms (distinct from quotation_terms_conditions added
-- in 100_quotations_module.sql — the real reference quotation PDF has no
-- T&Cs section at all, only the invoice does).
--
-- Seeded with the company's real values, taken directly from
-- INV-2026-0001.pdf / QT-2026-0001.pdf (already-issued real documents,
-- not fabricated) — everything else on that letterhead (company_name,
-- tax_id, vat_registration, phone, email, address) already matched the
-- live company_settings row exactly before this migration.

alter table company_settings
  add column if not exists tagline text,
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number_tzs text,
  add column if not exists bank_account_number_usd text,
  add column if not exists bank_branch_code text,
  add column if not exists bank_swift_code text,
  add column if not exists invoice_terms_conditions text;

update company_settings
   set tagline = coalesce(tagline, 'Powering Cold Chain Logistics'),
       bank_name = coalesce(bank_name, 'CRDB BANK, AZIKIWE'),
       bank_account_name = coalesce(bank_account_name, 'CALVARY INVESTMENT CO LTD'),
       bank_account_number_tzs = coalesce(bank_account_number_tzs, '0150604873500'),
       bank_account_number_usd = coalesce(bank_account_number_usd, '0250604873500'),
       bank_branch_code = coalesce(bank_branch_code, '3'),
       bank_swift_code = coalesce(bank_swift_code, 'CORUTZT'),
       invoice_terms_conditions = coalesce(invoice_terms_conditions,
         '70% payment before loading; 30% payment during offloading.' || chr(10) ||
         '5 free days at the border after arrival. Thereafter, detention charges of USD 250 per day will apply.' || chr(10) ||
         '2 free days for offloading after arrival at the destination. Thereafter, detention charges of USD 250 per day will apply.' || chr(10) ||
         'Any changes to equipment requirements or additional services requested by the customer will be charged separately.');

NOTIFY pgrst, 'reload schema';
