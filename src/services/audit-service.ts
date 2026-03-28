import { supabase } from '@/lib/supabase';

export interface AuditLogEntry {
  userId: string;
  userName: string;
  userRole: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW';
  tableName: string;
  recordId?: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  changeSummary: string;
}

export class AuditService {
  /**
   * Log an audit entry to the database
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const { error } = await supabase.rpc('log_audit_change', {
        p_user_id: entry.userId,
        p_user_name: entry.userName,
        p_user_role: entry.userRole,
        p_action: entry.action,
        p_table_name: entry.tableName,
        p_record_id: entry.recordId,
        p_old_data: entry.oldData || null,
        p_new_data: entry.newData || null,
        p_change_summary: entry.changeSummary
      });

      if (error) {
        console.error('Audit log failed:', error);
      }
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }

  /**
   * Get audit logs with filtering
   */
  static async getLogs(filters?: {
    userId?: string;
    tableName?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]> {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.tableName) {
      query = query.eq('table_name', filters.tableName);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to get audit logs:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Notify CEO/Admin about critical changes
   */
  static async notifyAdmins(
    senderId: string,
    senderName: string,
    tableName: string,
    action: string,
    recordId: string,
    summary: string
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('notify_ceo_admin_on_change', {
        p_sender_id: senderId,
        p_sender_name: senderName,
        p_table_name: tableName,
        p_action: action,
        p_record_id: recordId,
        p_summary: summary
      });

      if (error) {
        console.error('Admin notification failed:', error);
      }
    } catch (err) {
      console.error('Notification error:', err);
    }
  }

  /**
   * Log CRUD operations with automatic admin notification for critical tables
   */
  static async logCRUD(
    user: { id: string; name: string; role: string },
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    tableName: string,
    recordId: string,
    oldData: Record<string, any> | null,
    newData: Record<string, any> | null,
    summary: string,
    notifyAdmins: boolean = true
  ): Promise<void> {
    // Log the audit entry
    await this.log({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      tableName,
      recordId,
      oldData,
      newData,
      changeSummary: summary
    });

    // Notify admins for critical changes
    if (notifyAdmins && action !== 'VIEW') {
      const criticalTables = ['purchases', 'sales', 'invoices', 'expenses', 'fuel_requests', 'allowances', 'taxes', 'vehicles', 'users'];
      if (criticalTables.includes(tableName)) {
        await this.notifyAdmins(user.id, user.name, tableName, action, recordId, summary);
      }
    }
  }
}

export default AuditService;
