import { supabase } from '@/lib/supabase';

export interface NotificationData {
  user_id?: string;
  title: string;
  message: string;
  type: 'meeting' | 'employee' | 'insurance' | 'trip' | 'maintenance' | 'payment' | 'welcome' | 'system';
  severity: 'info' | 'success' | 'warning' | 'error';
  is_read?: boolean;
  created_at?: string;
}

export class NotificationService {
  // Create notification for specific user
  static async createForUser(userId: string, data: Omit<NotificationData, 'user_id' | 'created_at' | 'is_read'>) {
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        ...data,
        is_read: false,
        created_at: new Date().toISOString()
      });
      
      if (error) {
        console.error('Error creating notification:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error creating notification:', error);
      return false;
    }
  }

  // Create notification for multiple users
  static async createForUsers(userIds: string[], data: Omit<NotificationData, 'user_id' | 'created_at' | 'is_read'>) {
    try {
      const notifications = userIds.map(userId => ({
        user_id: userId,
        ...data,
        is_read: false,
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('notifications').insert(notifications);
      
      if (error) {
        console.error('Error creating notifications:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error creating notifications:', error);
      return false;
    }
  }

  // Create notification for users with specific roles
  static async createForRoles(roles: string[], data: Omit<NotificationData, 'user_id' | 'created_at' | 'is_read'>) {
    try {
      const { data: users, error: userError } = await supabase
        .from('user_profiles')
        .select('id')
        .in('role', roles);
      
      if (userError) {
        console.error('Error fetching users for roles:', userError);
        return false;
      }

      if (!users || users.length === 0) {
        return true; // No users found, but not an error
      }

      return await this.createForUsers(users.map(u => u.id), data);
    } catch (error) {
      console.error('Error creating notifications for roles:', error);
      return false;
    }
  }

  // Create notification for all admin users
  static async createForAdmins(data: Omit<NotificationData, 'user_id' | 'created_at' | 'is_read'>) {
    return await this.createForRoles(['admin', 'hr', 'ceo'], data);
  }

  // Create notification for all users
  static async createForAllUsers(data: Omit<NotificationData, 'user_id' | 'created_at' | 'is_read'>) {
    try {
      const { data: users, error: userError } = await supabase
        .from('user_profiles')
        .select('id');
      
      if (userError) {
        console.error('Error fetching all users:', userError);
        return false;
      }

      if (!users || users.length === 0) {
        return true;
      }

      return await this.createForUsers(users.map(u => u.id), data);
    } catch (error) {
      console.error('Error creating notifications for all users:', error);
      return false;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      if (error) {
        console.error('Error marking notification as read:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  // Delete notification
  static async delete(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      
      if (error) {
        console.error('Error deleting notification:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  // Get notifications for user
  static async getForUser(userId: string, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  // Get unread count for user
  static async getUnreadCount(userId: string) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      if (error) {
        console.error('Error fetching unread count:', error);
        return 0;
      }
      
      return data?.length || 0;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }
}
