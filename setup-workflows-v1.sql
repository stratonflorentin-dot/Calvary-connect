-- Calvary Connect: expense review, proof of delivery, maintenance, notifications
-- Run in Supabase SQL editor (idempotent).

-- Expenses: accountant comments & receipts
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS accountant_comment TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS client_reference TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS driver_id UUID;

-- Proof of delivery
CREATE TABLE IF NOT EXISTS delivery_proofs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id TEXT,
  driver_id UUID,
  delivery_photo_url TEXT,
  document_url TEXT,
  delivery_notes TEXT,
  customer_signature TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE delivery_proofs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_proofs_auth" ON delivery_proofs;
CREATE POLICY "delivery_proofs_auth" ON delivery_proofs
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Maintenance workflow columns
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS driver_id UUID;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS vehicle_id UUID;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS photo_urls TEXT[];
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS mechanic_notes TEXT;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS issue_description TEXT;

-- Notifications: category for filtering
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- Sync legacy is_read -> read if needed
UPDATE notifications SET read = COALESCE(read, is_read, false) WHERE read IS NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_proofs_driver ON delivery_proofs(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_trip ON delivery_proofs(trip_id);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
