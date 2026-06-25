-- Add vehicle status and deletion tracking to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'sold', 'decommissioned')),
ADD COLUMN IF NOT EXISTS sold_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sold_to TEXT,
ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS sale_notes TEXT,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Create vehicle sales/deletion audit table
CREATE TABLE IF NOT EXISTS vehicle_deletion_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL,
  vehicle_plate TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  mileage_at_deletion INTEGER,
  sale_price DECIMAL(10, 2),
  sold_to TEXT,
  sold_date TIMESTAMP WITH TIME ZONE,
  deletion_reason TEXT,
  deleted_by UUID REFERENCES user_profiles(id),
  deleted_by_name TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  previous_status TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit table
ALTER TABLE vehicle_deletion_audit ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit table
CREATE POLICY "Users can view vehicle deletion audit" ON vehicle_deletion_audit
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/Operator can manage vehicle deletion audit" ON vehicle_deletion_audit
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'operator', 'ceo')
    )
  );

-- Function to handle vehicle deletion/sale
CREATE OR REPLACE FUNCTION handle_vehicle_deletion(
  p_vehicle_id UUID,
  p_deletion_reason TEXT,
  p_sold_to TEXT DEFAULT NULL,
  p_sale_price DECIMAL DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_vehicle RECORD;
  v_audit_id UUID;
BEGIN
  -- Get vehicle information before deletion
  SELECT * INTO v_vehicle 
  FROM vehicles 
  WHERE id = p_vehicle_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle not found');
  END IF;
  
  -- Create audit record
  INSERT INTO vehicle_deletion_audit (
    vehicle_id,
    vehicle_plate,
    vehicle_make,
    vehicle_model,
    vehicle_year,
    mileage_at_deletion,
    sale_price,
    sold_to,
    sold_date,
    deletion_reason,
    deleted_by,
    deleted_by_name,
    previous_status,
    notes
  ) VALUES (
    v_vehicle.id,
    v_vehicle.plate_number,
    v_vehicle.make,
    v_vehicle.model,
    v_vehicle.year,
    v_vehicle.mileage,
    p_sale_price,
    p_sold_to,
    CASE WHEN p_deletion_reason = 'sold' THEN NOW() ELSE NULL END,
    p_deletion_reason,
    auth.uid(),
    current_setting('app.current_user_name', 'Unknown'),
    v_vehicle.status,
    p_notes
  ) RETURNING id INTO v_audit_id;
  
  -- Update vehicle status and mark as deleted
  UPDATE vehicles SET
    status = CASE 
      WHEN p_deletion_reason = 'sold' THEN 'sold'
      WHEN p_deletion_reason = 'decommissioned' THEN 'decommissioned'
      ELSE 'decommissioned'
    END,
    sold_date = CASE WHEN p_deletion_reason = 'sold' THEN NOW() ELSE NULL END,
    sold_to = p_sold_to,
    sale_price = p_sale_price,
    sale_notes = p_notes,
    deleted_at = NOW(),
    deleted_by = auth.uid(),
    deletion_reason = p_deletion_reason
  WHERE id = p_vehicle_id;
  
  -- Create notification for admin users
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    severity,
    is_read,
    created_at
  )
  SELECT 
    up.id,
    CASE 
      WHEN p_deletion_reason = 'sold' THEN 'Vehicle Sold'
      ELSE 'Vehicle Decommissioned'
    END,
    format('Vehicle %s (%s %s %s) has been %s%s', 
      v_vehicle.plate_number,
      v_vehicle.make,
      v_vehicle.model,
      v_vehicle.year::text,
      p_deletion_reason,
      CASE WHEN p_sold_to IS NOT NULL THEN format(' to %s', p_sold_to) ELSE '' END
    ),
    'vehicle',
    CASE 
      WHEN p_deletion_reason = 'sold' THEN 'info'
      ELSE 'warning'
    END,
    false,
    NOW()
  FROM user_profiles up
  WHERE up.role IN ('admin', 'operator', 'ceo');
  
  RETURN json_build_object(
    'success', true, 
    'audit_id', v_audit_id,
    'vehicle_plate', v_vehicle.plate_number,
    'message', format('Vehicle %s marked as %s', v_vehicle.plate_number, p_deletion_reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for audit performance
CREATE INDEX IF NOT EXISTS idx_vehicle_deletion_audit_vehicle_id ON vehicle_deletion_audit(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_deletion_audit_deleted_at ON vehicle_deletion_audit(deleted_at DESC);

-- Success message
SELECT '✅ Vehicle deletion system created successfully!' as status,
       'Fleet vehicles can now be properly decommissioned or sold with full audit trail.' as message;
