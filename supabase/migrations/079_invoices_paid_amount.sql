-- invoices.paid_amount is read and written throughout
-- src/app/finance/invoicing/customer-invoices/page.tsx (recordPayment(), the
-- outstanding-balance displays, the payment-history detail view — a dozen+
-- references) but the column was never actually migrated onto the live
-- table. Recording a payment against a real invoice would fail with
-- "column invoices.paid_amount does not exist" the moment one exists — gone
-- unnoticed so far only because 0 invoices exist in production yet.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
