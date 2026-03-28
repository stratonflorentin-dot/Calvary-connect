'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DEMO_MODE } from '@/lib/supabase';
import { CheckCircle, AlertTriangle, Database, Settings, ExternalLink } from 'lucide-react';

export function SupabaseSetupAssistant() {
  const [showSetup, setShowSetup] = useState(false);
  const [setupStep, setSetupStep] = useState(1);

  useEffect(() => {
    // Show setup assistant if not in demo mode and there are errors
    if (!DEMO_MODE) {
      setShowSetup(true);
    }
  }, []);

  const setupSteps = [
    {
      title: "Open Supabase Dashboard",
      description: "Go to your Supabase project dashboard",
      action: "https://qaqonhjeqtlatqsrqcnx.supabase.co",
      status: "pending"
    },
    {
      title: "Open SQL Editor",
      description: "Click 'SQL Editor' in the left sidebar, then 'New query'",
      action: null,
      status: "pending"
    },
    {
      title: "Run Database Setup",
      description: "Copy and paste the SQL from quick-setup.sql file",
      action: null,
      status: "pending"
    },
    {
      title: "Refresh Your App",
      description: "The demo banner should disappear and you can sign up",
      action: null,
      status: "pending"
    }
  ];

  if (DEMO_MODE || !showSetup) return null;

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Database className="size-5" />
          Supabase Setup Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            Your app is connected to Supabase but the database tables haven't been created yet. 
            Follow these steps to complete the setup:
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {setupSteps.map((step, index) => (
            <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-white">
              <Badge variant="outline" className="mt-1">
                {index + 1}
              </Badge>
              <div className="flex-1">
                <h4 className="font-medium">{step.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                {step.action && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => window.open(step.action, '_blank')}
                  >
                    <ExternalLink className="size-3 mr-1" />
                    Open Dashboard
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 p-3 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Fixed SQL Setup:</h4>
          <p className="text-sm text-blue-700 mb-2">
            Copy the entire content from <code>fixed-setup.sql</code> file and paste it into the SQL Editor.
          </p>
          <p className="text-sm text-blue-700 mb-2 font-medium">
            Admin Login: stratonflorentin@gmail.com | Password: Tony@5002
          </p>
          <p className="text-sm text-orange-600 mb-2">
            ⚠️ Use this FIXED version - resolves JWT role error!
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(`
-- Fixed Supabase Database Setup for Fleet Management System
-- This version fixes the JWT role issue

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('CEO', 'OPERATOR', 'DRIVER', 'MECHANIC', 'ACCOUNTANT', 'HR')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plate_number TEXT UNIQUE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('TRUCK', 'TRAILER', 'ESCORT_CAR', 'HOSE')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'out_of_service')),
  mileage INTEGER DEFAULT 0,
  fuel_capacity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trips Table
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  driver_id TEXT,
  truck_id UUID REFERENCES vehicles(id),
  trailer_id UUID REFERENCES vehicles(id),
  escort_car_id UUID REFERENCES vehicles(id),
  hose_id UUID REFERENCES vehicles(id),
  cargo_type TEXT,
  cargo_weight REAL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('FUEL', 'MAINTENANCE', 'TOLL', 'FOOD', 'OTHER')),
  amount REAL NOT NULL,
  description TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Maintenance Requests Table
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id TEXT,
  issue_description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spare Parts Table
CREATE TABLE IF NOT EXISTS spare_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  part_number TEXT UNIQUE,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 5,
  unit_price REAL,
  supplier TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parts Requests Table
CREATE TABLE IF NOT EXISTS parts_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id UUID REFERENCES spare_parts(id),
  requested_by TEXT,
  quantity INTEGER NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allowances Table
CREATE TABLE IF NOT EXISTS allowances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DAILY_ALLOWANCE', 'TRIP_ALLOWANCE', 'MEAL_ALLOWANCE', 'ACCOMMODATION')),
  amount REAL NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowances ENABLE ROW LEVEL SECURITY;

-- Create a function to get user role from user_profiles
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Fixed RLS Policies - Using user_profiles table instead of JWT
-- User Profiles
CREATE POLICY "Users can view their own profile" ON user_profiles FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "Admins can view all profiles" ON user_profiles FOR SELECT USING (get_user_role() = 'CEO');

-- Vehicles
CREATE POLICY "Authenticated users can view vehicles" ON vehicles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage vehicles" ON vehicles FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Trips
CREATE POLICY "Authenticated users can view trips" ON trips FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage trips" ON trips FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Expenses
CREATE POLICY "Authenticated users can view expenses" ON expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage expenses" ON expenses FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Maintenance Requests
CREATE POLICY "Authenticated users can view maintenance requests" ON maintenance_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage maintenance requests" ON maintenance_requests FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Spare Parts
CREATE POLICY "Authenticated users can view spare parts" ON spare_parts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage spare parts" ON spare_parts FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Parts Requests
CREATE POLICY "Authenticated users can view parts requests" ON parts_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage parts requests" ON parts_requests FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Allowances
CREATE POLICY "Authenticated users can view allowances" ON allowances FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "CEO and OPERATOR can manage allowances" ON allowances FOR ALL USING (get_user_role() IN ('CEO', 'OPERATOR'));

-- Insert sample vehicles
INSERT INTO vehicles (plate_number, make, model, year, type, status) VALUES
('ABC-123', 'Volvo', 'FH16', 2022, 'TRUCK', 'available'),
('DEF-456', 'Great Dane', 'Drop Deck', 2021, 'TRAILER', 'available'),
('GHI-789', 'Ford', 'Explorer', 2023, 'ESCORT_CAR', 'available'),
('JKL-012', 'Generic', 'Hose Kit', 2022, 'HOSE', 'available')
ON CONFLICT (plate_number) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(type);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);

-- Setup complete message
SELECT '✅ Fleet Management Database Setup Complete!' as status,
       'Tables created, RLS policies applied, sample data inserted.' as message;
              `);
              alert('✅ FIXED SQL copied to clipboard!\n\nThis version resolves the JWT role error.\n\nNow:\n1. Go to your Supabase dashboard\n2. Open SQL Editor\n3. Paste and run this FIXED SQL\n4. Then sign up with: stratonflorentin@gmail.com\n5. Use password: Tony@5002');
            }}
          >
            <Settings className="size-3 mr-1" />
            Copy Fixed SQL
          </Button>
        </div>

        <Button 
          onClick={() => setShowSetup(false)}
          variant="outline"
          className="w-full"
        >
          Hide Setup Assistant
        </Button>
      </CardContent>
    </Card>
  );
}
