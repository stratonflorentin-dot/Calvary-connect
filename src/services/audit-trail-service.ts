import { supabase } from '@/lib/supabase';

export type AuditModule = 'sales' | 'operations' | 'finance' | 'management' | 'hr' | 'warehouse' | 'maintenance';
export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'approve' | 'reject' | 'convert' | 'verify' | 'reconcile';
export type AuditEntityType = 
  | 'lead' 
  | 'customer' 
  | 'quotation' 
  | 'contract' 
  | 'booking' 
  | 'trip' 
  | 'invoice' 
  | 'payment' 
  | 'journal_entry' 
  | 'expense' 
  | 'revenue' 
  | 'pod' 
  | 'vehicle' 
  | 'driver' 
  | 'employee' 
  | 'allowance' 
  | 'maintenance_request'
  | 'part'
  | 'user';

export interface AuditLog {
  id?: string;
  user_id?: string;
  timestamp?: string;
  module: AuditModule;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id?: string;
  old_value?: any;
  new_value?: any;
  ip_address?: string;
  description: string;
}

/**
 * Audit Trail Serivce
 * Logs all critical actions across the ERP system for compliance and traceability
 */
export class AuditTrailService {
  /**
   * Log an audit event
   */
  static async log(log: AuditLog): Promise<void> {
    try {
      const { error } = await supabase.from('audit_trail').insert([{
        user_id: log.user_id,
        module: log.module,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        old_value: log.old_value,
        new_value: log.new_value,
        ip_address: log.ip_address || await this.getClientIP(),
        description: log.description,
      }]);

      if (error) {
        console.error('[AuditTrail] Failed to log audit event:', error);
      }
    } catch (err) {
      console.error('[AuditTrail] Error logging audit event:', err);
    }
  }

  /**
   * Log a create action
   */
  static async logCreate(
    module: AuditModule,
    entityType: AuditEntityType,
    entityId: string,
    newValue: any,
    userId?: string,
    description?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      module,
      action: 'create',
      entity_type: entityType,
      entity_id: entityId,
      new_value: newValue,
      description: description || `Created ${entityType} (${entityId})`,
    });
  }

  /**
   * Log an update action
   */
  static async logUpdate(
    module: AuditModule,
    entityType: AuditEntityType,
    entityId: string,
    oldValue: any,
    newValue: any,
    userId?: string,
    description?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      module,
      action: 'update',
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue,
      new_value: newValue,
      description: description || `Updated ${entityType} (${entityId})`,
    });
  }

  /**
   * Log a delete action
   */
  static async logDelete(
    module: AuditModule,
    entityType: AuditEntityType,
    entityId: string,
    oldValue: any,
    userId?: string,
    description?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      module,
      action: 'delete',
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue,
      description: description || `Deleted ${entityType} (${entityId})`,
    });
  }

  /**
   * Log an approve action
   */
  static async logApprove(
    module: AuditModule,
    entityType: AuditEntityType,
    entityId: string,
    userId?: string,
    description?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      module,
      action: 'approve',
      entity_type: entityType,
      entity_id: entityId,
      description: description || `Approved ${entityType} (${entityId})`,
    });
  }

  /**
   * Log a reject action
   */
  static async logReject(
    module: AuditModule,
    entityType: AuditEntityType,
    entityId: string,
    reason?: string,
    userId?: string,
    description?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      module,
      action: 'reject',
      entity_type: entityType,
      entity_id: entityId,
      new_value: { reason },
      description: description || `Rejected ${entityType} (${entityId})${reason ? `: ${reason}` : ''}`,
    });
  }

  /**
   * Log a convert action (e.g., lead to customer, quotation to booking)
   */
  static async logConvert(
    module: AuditModule,
    fromEntityType: AuditEntityType,
    toEntityType: AuditEntityType,
    fromEntityId: string,
    toEntityId: string,
    userId?: string,
    description?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      module,
      action: 'convert',
      entity_type: toEntityType,
      entity_id: toEntityId,
      new_value: { from_entity_type: fromEntityType, from_entity_id: fromEntityId },
      description: description || `Converted ${fromEntityType} (${fromEntityId}) to ${toEntityType} (${toEntityId})`,
    });
  }

  /**
   * Log a verify action (e.g., POD verification)
   */
  static async logVerify(
    module: AuditModule,
    entityType: AuditEntityType,
    entityId: string,
    userId?: string,
    description?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      module,
      action: 'verify',
      entity_type: entityType,
      entity_id: entityId,
      description: description || `Verified ${entityType} (${entityId})`,
    });
  }

  /**
   * Get audit logs for an entity
   */
  static async getEntityLogs(
    entityType: AuditEntityType,
    entityId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('audit_trail')
        .select('*, auth.users(email, name)')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[AuditTrail] Error fetching entity logs:', err);
      return [];
    }
  }

  /**
   * Get audit logs for a user
   */
  static async getUserLogs(
    userId: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('audit_trail')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[AuditTrail] Error fetching user logs:', err);
      return [];
    }
  }

  /**
   * Get audit logs for a module
   */
  static async getModuleLogs(
    module: AuditModule,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('audit_trail')
        .select('*, auth.users(email, name)')
        .eq('module', module)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[AuditTrail] Error fetching module logs:', err);
      return [];
    }
  }

  /**
   * Get client IP address (simplified - in production, use proper IP detection)
   */
  private static async getClientIP(): Promise<string> {
    // In a real implementation, this would get the actual client IP
    // For now, return a placeholder
    return 'client-ip';
  }
}

// Convenience exports
export const auditLog = AuditTrailService.log.bind(AuditTrailService);
export const logCreate = AuditTrailService.logCreate.bind(AuditTrailService);
export const logUpdate = AuditTrailService.logUpdate.bind(AuditTrailService);
export const logDelete = AuditTrailService.logDelete.bind(AuditTrailService);
export const logApprove = AuditTrailService.logApprove.bind(AuditTrailService);
export const logReject = AuditTrailService.logReject.bind(AuditTrailService);
export const logConvert = AuditTrailService.logConvert.bind(AuditTrailService);
export const logVerify = AuditTrailService.logVerify.bind(AuditTrailService);
