-- VAT withholding (Tanzania Finance Act 2025): when the customer is a
-- TRA-appointed VAT withholding agent, they withhold part of the VAT (6% of the
-- taxable value on services) and remit it to TRA directly. Record the flag and
-- the withheld amount on the invoice so the tax invoice and VAT return reflect it.
alter table public.invoices
  add column if not exists vat_withholding_agent boolean not null default false,
  add column if not exists vat_withheld numeric not null default 0;

comment on column public.invoices.vat_withholding_agent is
  'Customer is a TRA-appointed VAT withholding agent (Finance Act 2025, from 2025-07-01)';
comment on column public.invoices.vat_withheld is
  'VAT withheld at source by the customer (6% of taxable value on services); reduces amount paid to supplier';
