// AI Database Context - Provides database schema and query functions for AI agent
import { supabase } from './supabase';

export interface DatabaseSchema {
  tables: {
    name: string;
    columns: { name: string; type: string; description?: string }[];
  }[];
}

export const FLEET_SCHEMA: DatabaseSchema = {
  tables: [
    {
      name: 'vehicles',
      columns: [
        { name: 'id', type: 'UUID', description: 'Vehicle unique identifier' },
        { name: 'plate_number', type: 'TEXT', description: 'License plate' },
        { name: 'make', type: 'TEXT', description: 'Vehicle manufacturer' },
        { name: 'model', type: 'TEXT', description: 'Vehicle model' },
        { name: 'year', type: 'INTEGER', description: 'Manufacturing year' },
        { name: 'status', type: 'TEXT', description: 'Vehicle status (active/maintenance/inactive)' },
        { name: 'fuel_type', type: 'TEXT', description: 'Fuel type (diesel/petrol)' },
        { name: 'current_fuel_level', type: 'INTEGER', description: 'Current fuel percentage' },
        { name: 'mileage', type: 'INTEGER', description: 'Total kilometers' },
        { name: 'assigned_driver_id', type: 'UUID', description: 'Assigned driver' }
      ]
    },
    {
      name: 'trips',
      columns: [
        { name: 'id', type: 'UUID', description: 'Trip unique identifier' },
        { name: 'vehicle_id', type: 'UUID', description: 'Vehicle used' },
        { name: 'driver_id', type: 'UUID', description: 'Driver assigned' },
        { name: 'origin', type: 'TEXT', description: 'Starting location' },
        { name: 'destination', type: 'TEXT', description: 'Ending location' },
        { name: 'distance_km', type: 'INTEGER', description: 'Distance in kilometers' },
        { name: 'revenue', type: 'DECIMAL', description: 'Trip revenue' },
        { name: 'fuel_cost', type: 'DECIMAL', description: 'Fuel cost' },
        { name: 'status', type: 'TEXT', description: 'Trip status' },
        { name: 'created_at', type: 'TIMESTAMP', description: 'Trip creation date' }
      ]
    },
    {
      name: 'expenses',
      columns: [
        { name: 'id', type: 'UUID', description: 'Expense unique identifier' },
        { name: 'vehicle_id', type: 'UUID', description: 'Vehicle for expense' },
        { name: 'category', type: 'TEXT', description: 'Expense category' },
        { name: 'amount', type: 'DECIMAL', description: 'Expense amount' },
        { name: 'description', type: 'TEXT', description: 'Expense description' },
        { name: 'date', type: 'DATE', description: 'Expense date' }
      ]
    },
    {
      name: 'user_profiles',
      columns: [
        { name: 'id', type: 'UUID', description: 'User unique identifier' },
        { name: 'email', type: 'TEXT', description: 'User email' },
        { name: 'name', type: 'TEXT', description: 'User full name' },
        { name: 'role', type: 'TEXT', description: 'User role (CEO/ADMIN/DRIVER/etc)' },
        { name: 'status', type: 'TEXT', description: 'User status' }
      ]
    }
  ]
};

// Data fetchers for AI context
export async function getFleetContext() {
  const [vehicles, trips, expenses, users] = await Promise.all([
    supabase.from('vehicles').select('*').limit(50),
    supabase.from('trips').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('expenses').select('*').order('date', { ascending: false }).limit(100),
    supabase.from('user_profiles').select('*').limit(50)
  ]);

  return {
    vehicles: vehicles.data || [],
    trips: trips.data || [],
    expenses: expenses.data || [],
    users: users.data || []
  };
}

export function getSchemaString(): string {
  return FLEET_SCHEMA.tables.map(table => {
    const cols = table.columns.map(c => `${c.name} (${c.type})`).join(', ');
    return `Table ${table.name}: ${cols}`;
  }).join('\n');
}
