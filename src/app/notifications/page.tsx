"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

export default function NotificationsPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [notifications, setNotifications] = useState([]);
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
          .order('created_at', { ascending: false });
        
        if (error) {
          console.log('Notifications error - skipping:', error);
          setNotifications([]);
        } else {
          setNotifications(realNotifications || []);
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
        .update({ is_read: true })
        .eq('id', id);
        
      if (error) {
        console.error('Error marking notification as read:', error);
      } else {
        // Update local state
        setNotifications(prev => 
          prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-headline tracking-tighter">Notifications Center</h1>
          <p className="text-muted-foreground text-sm font-sans">Alerts and updates for your account.</p>
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
                className={cn(!n.is_read && 'border-primary/30 bg-primary/5')}
              >
                <CardHeader className="py-4 flex flex-row items-start gap-3">
                  {getIcon(n.severity || 'info')}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-headline leading-tight">{n.title || 'Notification'}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                    </p>
                  </div>
                  {!n.is_read && (
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => markRead(n.id)}>
                      Mark read
                    </Button>
                  )}
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
