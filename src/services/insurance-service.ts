import { supabase } from '@/lib/supabase';
import { TruckInsurance, InsuranceClaim, InsuranceSummary, InsuranceStatus } from '@/types/roles';
import { AuditService } from './audit-service';
import { addDays, differenceInDays, parseISO } from 'date-fns';

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
}

export class InsuranceService {
  // ==================== CRUD Operations ====================
  
  static async createInsurance(insurance: Omit<TruckInsurance, 'id' | 'created_at' | 'updated_at'>) {
    const user = await getCurrentUser();
    
    // Validate TIRA compliance for Tanzania
    const status = this.calculateInsuranceStatus(insurance.expiry_date);
    
    const insuranceData = {
      ...insurance,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: user?.id || 'system',
    };

    const { data, error } = await supabase
      .from('truck_insurance')
      .insert(insuranceData)
      .select()
      .single();
    
    if (error) throw error;

    if (user) {
      await AuditService.logCRUD(
        user, 
        'CREATE', 
        'truck_insurance', 
        data.id, 
        null, 
        data,
        `Created insurance policy: ${insurance.insurer_name} - TIRA Ref: ${insurance.tira_reference_number}`
      );
    }

    return data;
  }

  static async updateInsurance(id: string, updates: Partial<TruckInsurance>) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase
      .from('truck_insurance')
      .select('*')
      .eq('id', id)
      .single();

    // Recalculate status if expiry_date changes
    const status = updates.expiry_date 
      ? this.calculateInsuranceStatus(updates.expiry_date)
      : oldData?.status;

    const { data, error } = await supabase
      .from('truck_insurance')
      .update({
        ...updates,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;

    if (user) {
      await AuditService.logCRUD(
        user,
        'UPDATE',
        'truck_insurance',
        id,
        oldData,
        data,
        `Updated insurance policy: ${data.insurer_name}`
      );
    }

    return data;
  }

  static async deleteInsurance(id: string) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase
      .from('truck_insurance')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('truck_insurance')
      .delete()
      .eq('id', id);
    
    if (error) throw error;

    if (user) {
      await AuditService.logCRUD(
        user,
        'DELETE',
        'truck_insurance',
        id,
        oldData,
        null,
        `Deleted insurance policy: ${oldData?.insurer_name}`
      );
    }
  }

  static async getInsurance(id: string) {
    const { data, error } = await supabase
      .from('truck_insurance')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as TruckInsurance;
  }

  static async getInsuranceByVehicle(vehicleId: string) {
    const { data, error } = await supabase
      .from('truck_insurance')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as TruckInsurance[];
  }

  static async getAllInsurance(filters?: {
    status?: InsuranceStatus;
    insurer?: string;
    policy_type?: string;
  }) {
    let query = supabase.from('truck_insurance').select('*');
    
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.insurer) query = query.ilike('insurer_name', `%${filters.insurer}%`);
    if (filters?.policy_type) query = query.eq('policy_type', filters.policy_type);
    
    const { data, error } = await query.order('expiry_date', { ascending: true });
    
    if (error) throw error;
    return data as TruckInsurance[];
  }

  // ==================== Business Logic ====================

  static calculateInsuranceStatus(expiryDate: string): InsuranceStatus {
    const today = new Date();
    const expiry = parseISO(expiryDate);
    const daysUntilExpiry = differenceInDays(expiry, today);

    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 30) return 'expiring_soon';
    return 'active';
  }

  static async getExpiringPolicies(daysThreshold: number = 30) {
    const { data, error } = await supabase
      .from('truck_insurance')
      .select('*')
      .in('status', ['expiring_soon', 'expired'])
      .order('expiry_date', { ascending: true });
    
    if (error) throw error;

    return (data as TruckInsurance[]).filter(policy => {
      const daysUntilExpiry = differenceInDays(
        parseISO(policy.expiry_date),
        new Date()
      );
      return daysUntilExpiry <= daysThreshold && daysUntilExpiry >= -30;
    });
  }

  // TIRA Tanzania Compliance: Every truck must have at minimum Third Party coverage
  static async validateTIRACompliance() {
    const { data: vehicles, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, plate_number');
    
    if (vehicleError) throw vehicleError;

    const complianceReport = await Promise.all(
      (vehicles || []).map(async (vehicle) => {
        const { data: insurance } = await supabase
          .from('truck_insurance')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .in('policy_type', ['third_party', 'third_party_cargo', 'comprehensive', 'cross_border']);
        
        const activePolicy = (insurance || []).find(
          p => p.status === 'active' && parseISO(p.expiry_date) > new Date()
        );

        return {
          vehicle_id: vehicle.id,
          plate_number: vehicle.plate_number,
          compliant: !!activePolicy,
          active_policy: activePolicy,
        };
      })
    );

    return complianceReport;
  }

  // Flag cross-border trucks requiring COMESA Yellow Card
  static async checkCrossBorderCoverage() {
    const { data, error } = await supabase
      .from('truck_insurance')
      .select('*')
      .eq('is_cross_border', true);
    
    if (error) throw error;

    return (data as TruckInsurance[]).map(policy => ({
      ...policy,
      needs_yellow_card: policy.is_cross_border && !policy.has_comesa_yellow_card,
    }));
  }

  // ==================== Bulk Operations ====================

  static async bulkImportInsurance(records: Array<Partial<TruckInsurance>>) {
    const user = await getCurrentUser();
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const record of records) {
      try {
        const status = this.calculateInsuranceStatus(record.expiry_date!);
        const insuranceData = {
          ...record,
          status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: user?.id || 'system',
        };

        const { error } = await supabase
          .from('truck_insurance')
          .insert(insuranceData);

        if (error) {
          results.failed++;
          results.errors.push(`Row for vehicle ${record.vehicle_id}: ${error.message}`);
        } else {
          results.success++;
        }
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Row for vehicle ${record.vehicle_id}: ${err.message}`);
      }
    }

    if (user) {
      await AuditService.logCRUD(
        user,
        'CREATE',
        'truck_insurance',
        'bulk-import',
        null,
        { imported: results.success, failed: results.failed },
        `Bulk imported ${results.success} insurance policies`
      );
    }

    return results;
  }

  // ==================== Reporting ====================

  static async getInsuranceSummary(): Promise<InsuranceSummary> {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id');

    const { data: insurance } = await supabase
      .from('truck_insurance')
      .select('*');

    const policies = (insurance || []) as TruckInsurance[];
    const vehicleIds = (vehicles || []).map(v => v.id);

    const today = new Date();
    const expiringWithin30 = policies.filter(p => {
      const daysUntilExpiry = differenceInDays(parseISO(p.expiry_date), today);
      return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    });

    const expired = policies.filter(p => {
      const daysUntilExpiry = differenceInDays(parseISO(p.expiry_date), today);
      return daysUntilExpiry < 0;
    });

    const crossBorder = policies.filter(p => p.is_cross_border);

    // TIRA Compliance: Check each vehicle has at least one active Third Party policy
    const complianceReport = await this.validateTIRACompliance();
    const compliant = complianceReport.filter(c => c.compliant).length;
    const nonCompliant = complianceReport.filter(c => !c.compliant).length;

    return {
      total_vehicles: vehicleIds.length,
      total_active_policies: policies.filter(p => p.status === 'active').length,
      expiring_within_30_days: expiringWithin30.length,
      expired_policies: expired.length,
      mandatory_tira_compliance: {
        compliant,
        non_compliant: nonCompliant,
      },
      cross_border_coverage: {
        with_yellow_card: crossBorder.filter(p => p.has_comesa_yellow_card).length,
        without_yellow_card: crossBorder.filter(p => !p.has_comesa_yellow_card).length,
      },
      total_annual_premium: policies.reduce((sum, p) => sum + (p.annual_premium || 0), 0),
    };
  }

  // ==================== Claims Management ====================

  static async createClaim(claim: Omit<InsuranceClaim, 'id' | 'created_at' | 'updated_at'>) {
    const user = await getCurrentUser();
    const claimData = {
      ...claim,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('insurance_claims')
      .insert(claimData)
      .select()
      .single();
    
    if (error) throw error;

    if (user) {
      await AuditService.logCRUD(
        user,
        'CREATE',
        'insurance_claims',
        data.id,
        null,
        data,
        `Created insurance claim: ${claim.claim_type} - TZS ${claim.claim_amount}`
      );
    }

    return data;
  }

  static async getClaimsByInsurance(insuranceId: string) {
    const { data, error } = await supabase
      .from('insurance_claims')
      .select('*')
      .eq('truck_insurance_id', insuranceId)
      .order('claim_date', { ascending: false });
    
    if (error) throw error;
    return data as InsuranceClaim[];
  }

  static async getClaimsByVehicle(vehicleId: string) {
    const { data, error } = await supabase
      .from('insurance_claims')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('claim_date', { ascending: false });
    
    if (error) throw error;
    return data as InsuranceClaim[];
  }

  static async updateClaim(id: string, updates: Partial<InsuranceClaim>) {
    const user = await getCurrentUser();
    const { data: oldData } = await supabase
      .from('insurance_claims')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('insurance_claims')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;

    if (user) {
      await AuditService.logCRUD(user, 'UPDATE', 'insurance_claims', id, oldData, data, `Updated claim status`);
    }

    return data;
  }
}
