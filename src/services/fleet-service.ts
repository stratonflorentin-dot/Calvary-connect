import { supabase } from '@/lib/supabase';
import { FleetVehicle, FleetType, Trip, TripStatus, Expense, MaintenanceRequest, SparePart, PartsRequest, Allowance } from '@/types/roles';

export class FleetService {
  // Fleet Vehicle Management
  static async createVehicle(vehicle: Omit<FleetVehicle, 'id' | 'created_at' | 'updated_at'>) {
    const vehicleData = {
      ...vehicle,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('vehicles')
      .insert(vehicleData)
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  }

  static async updateVehicle(id: string, updates: Partial<FleetVehicle>) {
    const { error } = await supabase
      .from('vehicles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) throw error;
  }

  static async getVehicles(type?: FleetType, status?: string) {
    let query = supabase.from('vehicles').select('*');
    
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    
    const { data, error } = await query;
    if (error) throw error;
    
    return data as FleetVehicle[];
  }

  static async getVehicle(id: string) {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as FleetVehicle;
  }

  // Trip Management
  static async createTrip(trip: Omit<Trip, 'id' | 'created_at' | 'updated_at'>) {
    const tripData = {
      ...trip,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('trips')
      .insert(tripData)
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  }

  static async updateTrip(id: string, updates: Partial<Trip>) {
    const { error } = await supabase
      .from('trips')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) throw error;
  }

  static async getTrips(status?: TripStatus, driverId?: string) {
    let queryBuilder = supabase.from('trips').select('*');
    
    if (status) queryBuilder = queryBuilder.eq('status', status);
    if (driverId) queryBuilder = queryBuilder.eq('driverId', driverId);
    
    const { data, error } = await queryBuilder.order('created_at', { ascending: false });
    if (error) throw error;
    
    return data as Trip[];
  }

  static async getTrip(id: string) {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Trip;
  }

  // Expense Management
  static async createExpense(expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) {
    const expenseData = {
      ...expense,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('expenses')
      .insert(expenseData)
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  }

  static async updateExpense(id: string, updates: Partial<Expense>) {
    const { error } = await supabase
      .from('expenses')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) throw error;
  }

  static async getExpenses(type?: string, driverId?: string) {
    let query = supabase.from('expenses').select('*');
    
    if (type) query = query.eq('type', type);
    if (driverId) query = query.eq('driverId', driverId);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    return data as Expense[];
  }

  // Maintenance Request Management
  static async createMaintenanceRequest(request: Omit<MaintenanceRequest, 'id' | 'created_at' | 'updated_at'>) {
    const requestData = {
      ...request,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('maintenance_requests')
      .insert(requestData)
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  }

  static async updateMaintenanceRequest(id: string, updates: Partial<MaintenanceRequest>) {
    const { error } = await supabase
      .from('maintenance_requests')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) throw error;
  }

  static async getMaintenanceRequests(priority?: string, mechanicId?: string) {
    let query = supabase.from('maintenance_requests').select('*');
    
    if (priority) query = query.eq('priority', priority);
    if (mechanicId) query = query.eq('mechanicId', mechanicId);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    return data as MaintenanceRequest[];
  }

  // Spare Parts Management
  static async createSparePart(part: Omit<SparePart, 'id' | 'created_at' | 'updated_at'>) {
    const partData = {
      ...part,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('spare_parts')
      .insert(partData)
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  }

  static async updateSparePart(id: string, updates: Partial<SparePart>) {
    const { error } = await supabase
      .from('spare_parts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) throw error;
  }

  static async getSpareParts(category?: string) {
    let query = supabase.from('spare_parts').select('*');
    
    if (category) query = query.eq('category', category);
    
    const { data, error } = await query.order('name');
    if (error) throw error;
    
    return data as SparePart[];
  }

  // Parts Request Management
  static async createPartsRequest(request: Omit<PartsRequest, 'id' | 'created_at' | 'updated_at'>) {
    const requestData = {
      ...request,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('parts_requests')
      .insert(requestData)
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  }

  static async updatePartsRequest(id: string, updates: Partial<PartsRequest>) {
    const { error } = await supabase
      .from('parts_requests')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) throw error;
  }

  static async getPartsRequests(requestedBy?: string) {
    let query = supabase.from('parts_requests').select('*');
    
    if (requestedBy) query = query.eq('requestedBy', requestedBy);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    return data as PartsRequest[];
  }

  // Allowance Management
  static async createAllowance(allowance: Omit<Allowance, 'id' | 'created_at' | 'updated_at'>) {
    const allowanceData = {
      ...allowance,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('allowances')
      .insert(allowanceData)
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  }

  static async updateAllowance(id: string, updates: Partial<Allowance>) {
    const { error } = await supabase
      .from('allowances')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) throw error;
  }

  static async getAllowances(employeeId?: string, type?: string) {
    let query = supabase.from('allowances').select('*');
    
    if (employeeId) query = query.eq('employeeId', employeeId);
    if (type) query = query.eq('type', type);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    return data as Allowance[];
  }

  // Utility Methods
  static async getAvailableVehicles(type?: FleetType) {
    let query = supabase
      .from('vehicles')
      .select('*')
      .eq('status', 'available');
    
    if (type) query = query.eq('type', type);
    
    const { data, error } = await query;
    if (error) throw error;
    
    return data as FleetVehicle[];
  }

  static async getDriverActiveTrips(driverId: string) {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('driverId', driverId)
      .in('status', ['created', 'loaded', 'in_transit'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Trip[];
  }

  static async getVehicleMaintenanceHistory(vehicleId: string) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('vehicleId', vehicleId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as MaintenanceRequest[];
  }

  static async getLowStockParts() {
    const { data, error } = await supabase
      .from('spare_parts')
      .select('*')
      .lt('quantity', 'reorder_level');
    
    if (error) throw error;
    return data as SparePart[];
  }
}
