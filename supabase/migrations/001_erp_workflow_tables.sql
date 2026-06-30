-- ERP Workflow Redesign - Phase 1: Data Model & Relationships
-- This migration adds the missing tables and relationships for the connected ERP workflow

-- 1. Leads Table
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  industry TEXT,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  country TEXT,
  lead_source TEXT, -- Website, Referral, Cold Call, Trade Show, etc.
  probability INTEGER DEFAULT 50, -- 0-100
  status TEXT DEFAULT 'new', -- new, contacted, qualified, converted, lost
  assigned_salesperson_id UUID REFERENCES auth.users(id),
  notes TEXT,
  converted_to_customer_id UUID REFERENCES customers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 2. Update Bookings Table to link to Sales
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id),
ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES contracts(id),
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
ADD COLUMN IF NOT EXISTS booking_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS pickup_location TEXT,
ADD COLUMN IF NOT EXISTS delivery_location TEXT,
ADD COLUMN IF NOT EXISTS cargo_description TEXT,
ADD COLUMN IF NOT EXISTS cargo_weight NUMERIC,
ADD COLUMN IF NOT EXISTS container_size TEXT,
ADD COLUMN IF NOT EXISTS vehicle_requirement TEXT,
ADD COLUMN IF NOT EXISTS pickup_date DATE,
ADD COLUMN IF NOT EXISTS delivery_date DATE,
ADD COLUMN IF NOT EXISTS operations_review_status TEXT DEFAULT 'pending', -- pending, approved, rejected
ADD COLUMN IF NOT EXISTS operations_reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS operations_reviewed_at TIMESTAMP WITH TIME ZONE;

-- 3. Update Trips Table to link to Bookings
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id),
ADD COLUMN IF NOT EXISTS trip_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS fuel_plan TEXT,
ADD COLUMN IF NOT EXISTS expected_route TEXT,
ADD COLUMN IF NOT EXISTS estimated_arrival TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS gps_tracking_id TEXT,
ADD COLUMN IF NOT EXISTS pod_status TEXT DEFAULT 'not_uploaded', -- not_uploaded, uploaded, verified
ADD COLUMN IF NOT EXISTS customer_delivery_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS customer_confirmed_by UUID REFERENCES auth.users(id);

-- 4. Proof of Delivery Table
CREATE TABLE IF NOT EXISTS proof_of_delivery (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  pod_number TEXT UNIQUE NOT NULL,
  delivery_date DATE NOT NULL,
  receiver_name TEXT NOT NULL,
  receiver_signature TEXT, -- Base64 encoded signature image
  delivery_notes TEXT,
  delivery_document_url TEXT, -- S3 URL for signed POD
  attachments TEXT[], -- Array of document URLs
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- pending, verified, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Update Invoices Table to link to workflow
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id),
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id),
ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id),
ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES contracts(id),
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS generated_after_pod BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES proof_of_delivery(id);

-- 6. Update Journal Entries Table to link to documents
ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id),
ADD COLUMN IF NOT EXISTS payment_id UUID,
ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id),
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id),
ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id),
ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES contracts(id);

-- 7. Audit Trail Table
CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  module TEXT NOT NULL, -- sales, operations, finance, management
  action TEXT NOT NULL, -- create, update, delete, view, approve, reject
  entity_type TEXT NOT NULL, -- lead, customer, quotation, contract, booking, trip, invoice, etc.
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  description TEXT
);

-- 8. Notifications Table
-- Drop existing table if it exists to ensure clean schema
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- info, success, warning, error
  module TEXT NOT NULL, -- sales, operations, finance, management
  entity_type TEXT,
  entity_id TEXT,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Update Quotations Table for approval workflow
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft', -- draft, sent, viewed, negotiation, approved, rejected, expired, converted
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sent_to_customer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS viewed_by_customer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS converted_to_booking_id UUID REFERENCES bookings(id);

-- 10. Update Contracts Table for workflow
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS converted_to_booking_ids UUID[], -- Array of booking IDs
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS min_trips INTEGER,
ADD COLUMN IF NOT EXISTS max_trips INTEGER;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_salesperson_id);
CREATE INDEX IF NOT EXISTS idx_bookings_quotation ON bookings(quotation_id);
CREATE INDEX IF NOT EXISTS idx_bookings_contract ON bookings(contract_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_trips_booking ON trips(booking_id);
CREATE INDEX IF NOT EXISTS idx_trips_pod_status ON trips(pod_status);
CREATE INDEX IF NOT EXISTS idx_pod_trip ON proof_of_delivery(trip_id);
CREATE INDEX IF NOT EXISTS idx_invoices_trip ON invoices(trip_id);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_invoice ON journal_entries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_payment ON journal_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Row Level Security Policies
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_of_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Leads RLS
CREATE POLICY "Users can view leads" ON leads FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Sales can create leads" ON leads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Sales can update leads" ON leads FOR UPDATE USING (auth.uid() IS NOT NULL);

-- POD RLS
CREATE POLICY "Users can view POD" ON proof_of_delivery FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Operations can create POD" ON proof_of_delivery FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Operations can update POD" ON proof_of_delivery FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Audit Trail RLS (read-only for all, insert by system)
CREATE POLICY "Users can view audit trail" ON audit_trail FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "System can insert audit trail" ON audit_trail FOR INSERT WITH CHECK (true);

-- Notifications RLS
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Functions for automatic audit trail
CREATE OR REPLACE FUNCTION audit_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_trail (
    user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value,
    description
  )
  VALUES (
    COALESCE(auth.uid(), (SELECT id FROM auth.users LIMIT 1)),
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'create'
      WHEN TG_OP = 'UPDATE' THEN 'update'
      WHEN TG_OP = 'DELETE' THEN 'delete'
    END,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN row_to_json(OLD)
      ELSE NULL
    END,
    CASE
      WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW)
      ELSE NULL
    END,
    TG_TABLE_NAME || ' ' || TG_OP
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to key tables
DROP TRIGGER IF EXISTS audit_leads ON leads;
CREATE TRIGGER audit_leads AFTER INSERT OR UPDATE OR DELETE ON leads
FOR EACH ROW EXECUTE FUNCTION audit_log();

DROP TRIGGER IF EXISTS audit_customers ON customers;
CREATE TRIGGER audit_customers AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW EXECUTE FUNCTION audit_log();

DROP TRIGGER IF EXISTS audit_quotations ON quotations;
CREATE TRIGGER audit_quotations AFTER INSERT OR UPDATE OR DELETE ON quotations
FOR EACH ROW EXECUTE FUNCTION audit_log();

DROP TRIGGER IF EXISTS audit_contracts ON contracts;
CREATE TRIGGER audit_contracts AFTER INSERT OR UPDATE OR DELETE ON contracts
FOR EACH ROW EXECUTE FUNCTION audit_log();

DROP TRIGGER IF EXISTS audit_bookings ON bookings;
CREATE TRIGGER audit_bookings AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION audit_log();

DROP TRIGGER IF EXISTS audit_trips ON trips;
CREATE TRIGGER audit_trips AFTER INSERT OR UPDATE OR DELETE ON trips
FOR EACH ROW EXECUTE FUNCTION audit_log();

DROP TRIGGER IF EXISTS audit_invoices ON invoices;
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION audit_log();
