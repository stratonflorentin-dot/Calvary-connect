-- New feature: a "Client Email" page so CEO/ADMIN/SALESMAN/ACCOUNTANT staff
-- can email customers from inside the app (from info@calvary.co.tz) instead
-- of a separate mail client, with every send logged against the customer
-- record. Replaces the Instagram inbox this session removed as the
-- client-communication channel.
--
-- client_emails is a plain send-log (this is the "send-only" phase agreed
-- with the user — no inbound/reply sync yet). customer_id is nullable
-- because staff can send to a contact who isn't in the customers table yet.
--
-- Same role set as customers_all (043_lock_down_customers_rls.sql): a
-- DRIVER/MECHANIC/HR account has no business emailing clients or seeing who
-- else did, same reasoning as that migration.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS client_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  sender_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_emails_customer_id ON client_emails(customer_id);
CREATE INDEX IF NOT EXISTS idx_client_emails_created_at ON client_emails(created_at DESC);

REVOKE ALL ON client_emails FROM anon;
ALTER TABLE client_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_emails_all ON client_emails;
CREATE POLICY client_emails_all ON client_emails FOR ALL
  USING (current_user_role() IN ('CEO', 'ADMIN', 'SALESMAN', 'ACCOUNTANT'))
  WITH CHECK (current_user_role() IN ('CEO', 'ADMIN', 'SALESMAN', 'ACCOUNTANT'));

INSERT INTO public.schema_migrations (version) VALUES ('047_client_emails.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
