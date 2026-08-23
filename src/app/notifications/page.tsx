"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Info, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { isAllowedNotification } from '@/lib/notification-categories';
import type { Notification as NotificationRecord } from '@/services/notification-service';

export default function NotificationsPage() {
  const { role, isAdmin } = useRole();
  const { user } = useSupabase();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Load real notifications from database
        const { data: realNotifications, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.log('Notifications error - skipping:', error);
          setNotifications([]);
        } else {
          const filtered = (realNotifications || []).filter(isAllowedNotification);
          setNotifications(filtered);
        }
      } catch (error) {
        console.log('Notifications loading error - skipping:', error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [user]);

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'success': return <CheckCircle className="size-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="size-5 text-amber-500" />;
      case 'error': return <AlertCircle className="size-5 text-rose-500" />;
      default: return <Info className="size-5 text-blue-500" />;
    }
  };

  const markRead = async (id: string) => {
    try {
      // Update notification as read in database
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) {
        console.error('Error marking notification as read:', error);
      } else {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) {
        console.error('Error deleting notification:', error);
        return;
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const clearAll = async () => {
    if (!user || notifications.length === 0) return;
    try {
      const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
      if (error) {
        console.error('Error clearing notifications:', error);
        return;
      }
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Notifications Center</h1>
            <p className="text-muted-foreground text-sm font-sans">
              Trips, fuel, expenses, maintenance, and delivery updates only.
            </p>
          </div>
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" className="shrink-0 text-red-500 hover:text-red-600" onClick={clearAll}>
              <Trash2 className="size-3.5 mr-1.5" />
              Clear all
            </Button>
          )}
        </header>
        <div className="max-w-2xl space-y-4">
          {!notifications || notifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                No notifications yet.
              </CardContent>
            </Card>
          ) : (
            notifications.map((n) => (
              <Card
                key={n.id}
                className={cn(!n.read && 'border-primary/30 bg-primary/5')}
              >
                <CardHeader className="py-4 flex flex-row items-start gap-3">
                  {getIcon(n.type || 'info')}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-headline leading-tight">{n.title || 'Notification'}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!n.read && (
                      <Button size="sm" variant="outline" onClick={() => markRead(n.id || '')}>
                        Mark read
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => deleteNotification(n.id || '')}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

