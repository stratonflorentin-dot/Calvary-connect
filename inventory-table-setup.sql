-- Create inventory table for warehouse management
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  category TEXT,
  quantity_available INTEGER DEFAULT 0,
  unit TEXT, -- e.g., 'liters', 'pieces', 'sets'
  min_stock_level INTEGER DEFAULT 0,
  max_stock_level INTEGER,
  unit_cost DECIMAL(10, 2),
  supplier TEXT,
  location TEXT,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  last_restocked TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view inventory" ON inventory
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/Operator can manage inventory" ON inventory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'operator', 'ceo')
    )
  );

CREATE POLICY "Mechanics can view inventory" ON inventory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'mechanic'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity_available);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON inventory(created_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();

-- Create a view for low stock alerts
CREATE OR REPLACE VIEW low_stock_alerts AS
SELECT 
  id,
  item_name,
  category,
  quantity_available,
  min_stock_level,
  unit,
  last_restocked,
  CASE 
    WHEN quantity_available = 0 THEN 'out_of_stock'
    WHEN quantity_available <= min_stock_level THEN 'critical'
    WHEN quantity_available <= (min_stock_level * 1.5) THEN 'low'
    ELSE 'normal'
  END as alert_level
FROM inventory
WHERE quantity_available <= (min_stock_level * 1.5)
AND status = 'active';

-- Success message
SELECT '✅ Inventory table created successfully!' as status,
       'Warehouse inventory system is now ready for real stock management.' as message;
