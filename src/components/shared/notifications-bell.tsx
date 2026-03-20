"use client";

import { Bell, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection, useMemoFirebase, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export function NotificationsBell() {
  const firestore = useFirestore();
  const { user } = useUser();

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
  }, [firestore, user]);

  const { data: notifications } = useCollection(notificationsQuery);
  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const handleMarkAsRead = (id: string) => {
    if (!firestore || !user) return;
    const notifRef = doc(firestore, 'users', user.uid, 'notifications', id);
    updateDocumentNonBlocking(notifRef, { isRead: true });
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="size-4 text-rose-500" />;
      case 'warning': return <AlertCircle className="size-4 text-amber-500" />;
      case 'success': return <CheckCircle className="size-4 text-emerald-500" />;
      default: return <Info className="size-4 text-blue-500" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-full hover:bg-accent transition-colors outline-none group">
          <Bell className="size-6 text-foreground group-active:animate-bounce" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 size-5 flex items-center justify-center p-0 bg-destructive text-white border-2 border-background animate-in fade-in zoom-in">
              {unreadCount}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden rounded-xl border shadow-2xl">
        <DropdownMenuLabel className="p-4 bg-muted/50 font-headline flex justify-between items-center">
          <span>Notifications</span>
          {unreadCount > 0 && <Badge variant="secondary" className="text-[10px]">{unreadCount} New</Badge>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-96 overflow-y-auto">
          {(!notifications || notifications.length === 0) ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No notifications yet.
            </div>
          ) : (
            notifications.map((notif) => (
              <DropdownMenuItem 
                key={notif.id} 
                className={cn(
                  "p-4 cursor-pointer focus:bg-accent border-b last:border-0 flex flex-col items-start gap-1 transition-colors",
                  !notif.isRead && "bg-primary/5"
                )}
                onClick={() => handleMarkAsRead(notif.id)}
              >
                <div className="flex justify-between w-full items-center">
                  <div className="flex items-center gap-2">
                    {getIcon(notif.severity)}
                    <span className={cn(
                      "text-xs font-bold",
                      notif.severity === 'critical' ? 'text-destructive' : 'text-foreground'
                    )}>{notif.title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{notif.message}</p>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <button className="w-full py-3 text-sm font-medium text-primary hover:bg-accent transition-colors">
          View all notifications
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
