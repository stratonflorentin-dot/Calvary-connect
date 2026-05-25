import { supabase } from '@/lib/supabase';
import { FleetVehicle, FleetType, Trip, TripStatus, Expense, MaintenanceRequest, SparePart, PartsRequest, Allowance } from '@/types/roles';
import { AuditService } from './audit-service';
import { SyncManager } from '@/lib/offline-sync';

// Get current user for audit logging
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name, role')
    .eq('id', user.id)
    .single();
    
  return {
    id: user.id,
    name: profile?.name || user.email || 'Unknown',
    role: profile?.role || 'USER'
  };
  static async markInvoicePaid(id: string, accountId: string) {
    const user = await getCurrentUser();
    const { data: invoice, error: invError } = await supabase.from('invoices').select('*').eq('id', id).single();
    if (invError) throw invError;

    const { error: updateError } = await supabase.from('invoices').update({ status: 'paid' }).eq('id', id);
    if (updateError) throw updateError;

    // Record the bank transaction
    const { error: txError } = await supabase.from('bank_statements').insert({
      account_id: accountId,
      date: new Date().toISOString().split('T')[0],
      description: `Payment for Invoice ${invoice.invoice_number}`,
      amount: invoice.amount,
      type: invoice.type === 'receivable' ? 'credit' : 'debit',
      ref: invoice.invoice_number
    });
    if (txError) throw txError;

    // Update bank balance
    const { data: account } = await supabase.from('bank_accounts').select('current_balance').eq('id', accountId).single();
    if (account) {
      const newBalance = invoice.type === 'receivable' 
        ? parseFloat(account.current_balance) + parseFloat(invoice.amount)
        : parseFloat(account.current_balance) - parseFloat(invoice.amount);
      
      await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', accountId);
    }

    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'invoices', id, invoice, { ...invoice, status: 'paid' },
        `Marked invoice ${invoice.invoice_number} as paid and updated bank account ${accountId}`);
    }
  }
}

export class SupabaseService {
  // Utility for offline-aware requests
  private static async performAction(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', data: any, id?: string) {
    if (!SyncManager.isOnline()) {
      await SyncManager.queueRequest(table, action, data);
      return data;
    }

    let error;
    let result;

    if (action === 'INSERT') {
      ({ data: result, error } = await supabase.from(table).insert(data).select().single());
    } else if (action === 'UPDATE') {
      ({ data: result, error } = await supabase.from(table).update(data).eq('id', id).select().single());
    } else if (action === 'DELETE') {
      ({ error } = await supabase.from(table).delete().eq('id', id));
    }

    if (error) throw error;
    return result;
  }

  // Fleet Vehicle Management
  static async getDrivers() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .ilike('role', 'driver')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  }
    static async getVehicles(filters?: { type?: string; status?: string }) {
    let query = supabase.from('vehicles').select('*');
    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createVehicle(vehicle: Omit<FleetVehicle, 'id' | 'created_at' | 'updated_at'>) {
    const user = await getCurrentUser();
    const data = await this.performAction('vehicles', 'INSERT', {
      ...vehicle,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    // Log audit
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'vehicles', data.id, null, data, 
        `Created vehicle ${vehicle.plateNumber || vehicle.name}`);
    }
    
    return data;
  }

  static async updateVehicle(id: string, updates: Partial<FleetVehicle>) {
    const user = await getCurrentUser();
    
    // Get old data for audit
    const { data: oldData } = SyncManager.isOnline() 
      ? await supabase.from('vehicles').select('*').eq('id', id).single()
      : { data: null };
    
    const data = await this.performAction('vehicles', 'UPDATE', updates, id);
    
    // Log audit
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'vehicles', id, oldData, data,
        `Updated vehicle ${updates.plateNumber || id}`);
    }
    
    return data;
  }

  static async deleteVehicle(id: string) {
    const user = await getCurrentUser();
    
    // Get old data for audit
    const { data: oldData } = SyncManager.isOnline()
      ? await supabase.from('vehicles').select('*').eq('id', id).single()
      : { data: null };
    
    await this.performAction('vehicles', 'DELETE', null, id);
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'DELETE', 'vehicles', id, oldData, null,
        `Deleted vehicle ${oldData?.plateNumber || id}`);
    }
  }

  // Trip Management
  static async getTrips(filters?: { status?: TripStatus; driverId?: string }) {
    let query = supabase.from('trips').select('*');
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.driverId) {
      query = query.eq('driver_id', filters.driverId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createTrip(trip: Omit<Trip, 'id' | 'created_at'>) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('trips')
      .insert({
        ...trip,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Automatically create a Sale and Invoice when a trip is created
    try {
      const sale = await this.createSale({
        client: trip.client_name || 'Trip Customer',
        description: `Revenue for Trip ${data.trip_number || data.id}`,
        total_amount: trip.revenue || trip.price || 0,
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
      });

      await this.createInvoice({
        invoice_number: `INV-${Date.now()}`,
        customer_name: trip.client_name || 'Trip Customer',
        amount: trip.revenue || trip.price || 0,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        type: 'receivable',
        trip_id: data.id,
        linked_revenue: sale.id
      });
    } catch (e) {
      console.error("Failed to auto-create financial records for trip:", e);
    }

    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'trips', data.id, null, data,
        `Created trip for ${trip.vehicle_id || trip.driver_id}`);
    }
    
    return data;
  }

  static async updateTrip(id: string, updates: Partial<Trip>) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('trips').select('*').eq('id', id).single();
    
    const { data, error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'trips', id, oldData, data,
        `Updated trip ${id}`);
    }
    
    return data;
  }

  // Expense Management
  static async getExpenses(filters?: { status?: string; driverId?: string }) {
    let query = supabase.from('expenses').select('*');
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.driverId) {
      query = query.eq('driver_id', filters.driverId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createExpense(expense: Omit<Expense, 'id' | 'created_at'>) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        ...expense,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Automatically create a Payable Invoice when an expense is created
    try {
      await this.createInvoice({
        invoice_number: `BILL-${Date.now()}`,
        customer_name: expense.vendor || 'Expense Vendor',
        amount: expense.amount,
        due_date: expense.date || new Date().toISOString().split('T')[0],
        status: 'pending',
        type: 'payable',
        linked_expense: data.id,
        trip_id: expense.trip_id
      });
    } catch (e) {
      console.error("Failed to auto-create invoice for expense:", e);
    }

    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'expenses', data.id, null, data,
        `Created expense: ${expense.category} - ${expense.amount}`);
    }
    
    return data;
  }

  static async updateExpense(id: string, updates: Partial<Expense>) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('expenses').select('*').eq('id', id).single();
    
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'expenses', id, oldData, data,
        `Updated expense ${id}`);
    }
    
    return data;
  }

  static async deleteExpense(id: string) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('expenses').select('*').eq('id', id).single();
    
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'DELETE', 'expenses', id, oldData, null,
        `Deleted expense ${id}`);
    }
  }

  // Maintenance Requests
  static async getMaintenanceRequests(filters?: { status?: string; vehicleId?: string }) {
    let query = supabase.from('maintenance_requests').select('*');
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.vehicleId) {
      query = query.eq('vehicle_id', filters.vehicleId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createMaintenanceRequest(request: Omit<MaintenanceRequest, 'id' | 'created_at'>) {
    const user = await getCurrentUser();
    const data = await this.performAction('maintenance_requests', 'INSERT', {
      ...request,
      created_at: new Date().toISOString()
    });
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'maintenance_requests', data.id, null, data,
        `Created maintenance request for ${request.vehicle_id}`);
    }
    
    return data;
  }

  static async updateMaintenanceRequest(id: string, updates: Partial<MaintenanceRequest>) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('maintenance_requests').select('*').eq('id', id).single();
    
    const { data, error } = await supabase
      .from('maintenance_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'maintenance_requests', id, oldData, data,
        `Updated maintenance request ${id}`);
    }
    
    return data;
  }

  // Spare Parts
  static async getSpareParts(filters?: { category?: string }) {
    let query = supabase.from('spare_parts').select('*');
    
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    
    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async createSparePart(part: Omit<SparePart, 'id' | 'created_at'>) {
    const user = await getCurrentUser();
    const data = await this.performAction('spare_parts', 'INSERT', {
      ...part,
      created_at: new Date().toISOString()
    });
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'spare_parts', data.id, null, data,
        `Created spare part: ${part.name}`);
    }
    
    return data;
  }

  // Parts Requests
  static async getPartsRequests(filters?: { status?: string }) {
    let query = supabase.from('parts_requests').select('*');
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createPartsRequest(request: Omit<PartsRequest, 'id' | 'created_at'>) {
    const user = await getCurrentUser();
    const data = await this.performAction('parts_requests', 'INSERT', {
      ...request,
      created_at: new Date().toISOString()
    });
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'parts_requests', data.id, null, data,
        `Created parts request for ${request.part_id} - ${request.quantity_requested}`);
    }
    
    return data;
  }

  // Allowances
  static async getAllowances(filters?: { employeeId?: string }) {
    let query = supabase.from('allowances').select('*');
    
    if (filters?.employeeId) {
      query = query.eq('employee_id', filters.employeeId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createAllowance(allowance: Omit<Allowance, 'id' | 'created_at'>) {
    const user = await getCurrentUser();
    const data = await this.performAction('allowances', 'INSERT', {
      ...allowance,
      created_at: new Date().toISOString()
    });
    
    // Automatically create a Payable Invoice for worker allowance
    try {
      await this.createInvoice({
        invoice_number: `ALW-${Date.now()}`,
        customer_name: allowance.workerName,
        amount: allowance.amount,
        due_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        type: 'payable',
        trip_id: allowance.trip_id,
        description: `Allowance: ${allowance.type} for ${allowance.workerName}`
      });
    } catch (e) {
      console.error("Failed to auto-create invoice for allowance:", e);
    }

    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'allowances', data.id, null, data,
        `Created allowance for ${allowance.workerName} - ${allowance.amount}`);
    }
    
    return data;
  }

  static async updateAllowance(id: string, updates: Partial<Allowance>) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('allowances').select('*').eq('id', id).single();
    
    const { data, error } = await supabase
      .from('allowances')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'allowances', id, oldData, data,
        `Updated allowance for ${oldData?.workerName || id}`);
    }
    
    return data;
  }

  // ========== FINANCE LEDGERS ==========

  // Purchases
  static async getPurchases() {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createPurchase(purchase: any) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('purchases')
      .insert({
        ...purchase,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'purchases', data.id, null, data,
        `Created purchase from ${purchase.client_name || purchase.clientName} for ${purchase.amount}`);
    }
    
    return data;
  }

  static async updatePurchase(id: string, updates: any) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('purchases').select('*').eq('id', id).single();
    
    const { data, error } = await supabase
      .from('purchases')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'purchases', id, oldData, data,
        `Updated purchase ${id}`);
    }
    
    return data;
  }

  static async deletePurchase(id: string) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('purchases').select('*').eq('id', id).single();
    
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'DELETE', 'purchases', id, oldData, null,
        `Deleted purchase ${id}`);
    }
  }

  // Sales
  static async getSales() {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createSale(sale: any) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('sales')
      .insert({
        ...sale,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'sales', data.id, null, data,
        `Created sale to ${sale.clientName} for ${sale.amount}`);
    }
    
    return data;
  }

  static async updateSale(id: string, updates: any) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('sales').select('*').eq('id', id).single();
    
    const { data, error } = await supabase
      .from('sales')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'sales', id, oldData, data,
        `Updated sale ${id}`);
    }
    
    return data;
  }

  static async deleteSale(id: string) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('sales').select('*').eq('id', id).single();
    
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'DELETE', 'sales', id, oldData, null,
        `Deleted sale ${id}`);
    }
  }

  // Invoices
  static async getInvoices() {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async createInvoice(invoice: any) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        ...invoice,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'invoices', data.id, null, data,
        `Created invoice for ${invoice.clientName} - ${invoice.amount}`);
    }
    
    return data;
  }

  static async updateInvoice(id: string, updates: any) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('invoices').select('*').eq('id', id).single();
    
    const { data, error } = await supabase
      .from('invoices')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'invoices', id, oldData, data,
        `Updated invoice ${id}`);
    }
    
    return data;
  }

  static async deleteInvoice(id: string) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('invoices').select('*').eq('id', id).single();
    
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'DELETE', 'invoices', id, oldData, null,
        `Deleted invoice ${id}`);
    }
  }

  // Fuel Requests
  static async getFuelRequests(filters?: { status?: string }) {
    let query = supabase.from('fuel_requests').select('*');
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createFuelRequest(request: any) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('fuel_requests')
      .insert({
        ...request,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'fuel_requests', data.id, null, data,
        `Created fuel request for ${request.driverName || request.vehicleId} - ${request.amount}`);
    }
    
    return data;
  }

  static async updateFuelRequest(id: string, updates: any) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('fuel_requests').select('*').eq('id', id).single();
    
    const { data, error } = await supabase
      .from('fuel_requests')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'fuel_requests', id, oldData, data,
        `Updated fuel request ${id}`);
    }
    
    return data;
  }

  static async deleteFuelRequest(id: string) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('fuel_requests').select('*').eq('id', id).single();
    
    const { error } = await supabase.from('fuel_requests').delete().eq('id', id);
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'DELETE', 'fuel_requests', id, oldData, null,
        `Deleted fuel request ${id}`);
    }
  }

  // Taxes
  static async getTaxes() {
    const { data, error } = await supabase
      .from('taxes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createTax(tax: any) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('taxes')
      .insert({
        ...tax,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'taxes', data.id, null, data,
        `Created ${tax.type} tax for ${tax.period} - ${tax.amount}`);
    }
    
    return data;
  }

  static async updateTax(id: string, updates: any) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('taxes').select('*').eq('id', id).single();
    
    const { data, error } = await supabase
      .from('taxes')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'taxes', id, oldData, data,
        `Updated tax ${id}`);
    }
    
    return data;
  }

  static async deleteTax(id: string) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('taxes').select('*').eq('id', id).single();
    
    const { error } = await supabase.from('taxes').delete().eq('id', id);
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'DELETE', 'taxes', id, oldData, null,
        `Deleted tax ${id}`);
    }
  }

  // Reports
  static async getReports() {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createReport(report: any) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('reports')
      .insert({
        ...report,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'reports', data.id, null, data,
        `Created report: ${report.title}`);
    }
    
    return data;
  }

  static async updateReport(id: string, updates: any) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('reports').select('*').eq('id', id).single();
    
    const { data, error } = await supabase
      .from('reports')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'reports', id, oldData, data,
        `Updated report ${id}`);
    }
    
    return data;
  }

  static async deleteReport(id: string) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('reports').select('*').eq('id', id).single();
    
    const { error } = await supabase.from('reports').delete().eq('id', id);
    if (error) throw error;
    
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'DELETE', 'reports', id, oldData, null,
        `Deleted report ${id}`);
    }
  }

  // ========== HR & PERFORMANCE ==========

  // Meetings
  static async getMeetings() {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createMeeting(meeting: any) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('meetings')
      .insert({
        ...meeting,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'meetings', data.id, null, data,
        `Created meeting: ${meeting.title}`);
    }
    return data;
  }

  // Performance Appraisals
  static async getPerformances(employeeId?: string) {
    let query = supabase.from('performances').select('*');
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query.order('review_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createPerformance(performance: any) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('performances')
      .insert({
        ...performance,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'performances', data.id, null, data,
        `Created performance review for ${performance.employee_id}`);
    }
    return data;
  }

  // ========== INSURANCE ==========

  // Insurance Policies
  static async getInsurancePolicies() {
    const { data, error } = await supabase
      .from('insurance_policies')
      .select('*')
      .order('renewal_date', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async createInsurancePolicy(policy: any) {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('insurance_policies')
      .insert({
        ...policy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'CREATE', 'insurance_policies', data.id, null, data,
        `Created insurance policy for ${policy.vehicle_id}`);
    }
    return data;
  }

  static async updateInsurancePolicy(id: string, updates: any) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase.from('insurance_policies').select('*').eq('id', id).single();
    const { data, error } = await supabase
      .from('insurance_policies')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (user && SyncManager.isOnline()) {
      await AuditService.logCRUD(user, 'UPDATE', 'insurance_policies', id, oldData, data,
        `Updated insurance policy ${id}`);
    }
    return data;
  }
}

