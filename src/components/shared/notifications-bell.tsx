"use client";

import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState } from 'react';

export function NotificationsBell() {
  const [unreadCount] = useState(3);

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
        <DropdownMenuLabel className="p-4 bg-muted/50 font-headline">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-96 overflow-y-auto">
          {[
            { title: "Parts request submitted", msg: "A new request was sent for Truck XYZ", type: 'info', time: '2m ago' },
            { title: "Low Stock Alert", msg: "Engine Oil is below reorder level", type: 'warning', time: '1h ago' },
            { title: "Breakdown Reported", msg: "Truck plate G-772 reported breakdown", type: 'critical', time: '3h ago' },
          ].map((notif, i) => (
            <DropdownMenuItem key={i} className="p-4 cursor-pointer focus:bg-accent border-b last:border-0 flex flex-col items-start gap-1">
              <div className="flex justify-between w-full items-center">
                <span className={cn(
                  "text-xs font-bold",
                  notif.type === 'critical' ? 'text-destructive' : 'text-primary'
                )}>{notif.title}</span>
                <span className="text-[10px] text-muted-foreground">{notif.time}</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{notif.msg}</p>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <button className="w-full py-3 text-sm font-medium text-primary hover:bg-accent transition-colors">
          View all notifications
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
