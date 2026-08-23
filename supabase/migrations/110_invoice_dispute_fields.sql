-- Adds a "Dispute" action to the new invoice detail page. Deliberately NOT
-- a new invoices.status value — status already carries real payment-
-- lifecycle meaning (draft/pending/sent/partial/paid/overdue/unpaid/
-- cancelled), and a disputed invoice can be in any of those at once (a
-- "sent, awaiting payment" invoice the customer disputes is still sent
-- and still awaiting payment — disputing it doesn't change what's owed).
-- Layering it as an orthogonal flag avoids conflating "what's the payment
-- state" with "is this contested".
--
-- guard_sent_invoice() (102_shipments_waybills_invoice_lock.sql) only
-- blocks changes to amount/subtotal/tax_amount/currency/customer_id/
-- shipment_id/trip_id/quotation_id once an invoice is locked — these four
-- new columns aren't in that list, so disputing/resolving works
-- regardless of lock state, same as recording a payment already does.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS disputed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disputed_by uuid REFERENCES user_profiles(id);

NOTIFY pgrst, 'reload schema';
