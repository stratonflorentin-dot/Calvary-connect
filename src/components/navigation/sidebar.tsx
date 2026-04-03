
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback } from 'react';
import { 
  LayoutDashboard, Truck, Route, DollarSign, BarChart2, 
  Users, Package, MapPin, Sparkles, Bell, Wrench, Calculator, LogOut, History, Home, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/roles';
import { useLanguage } from '@/hooks/use-language';
import { useSupabase } from '@/components/supabase-provider';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useRole } from '@/hooks/use-role';
import { ADMIN_EMAIL } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  CEO: { label: 'CEO', color: 'bg-emerald-500' },
  ADMIN: { label: 'Admin', color: 'bg-blue-500' },
  OPERATOR: { label: 'Operator', color: 'bg-amber-500' },
  DRIVER: { label: 'Driver', color: 'bg-orange-500' },
  MECHANIC: { label: 'Mechanic', color: 'bg-purple-500' },
  ACCOUNTANT: { label: 'Accountant', color: 'bg-cyan-500' },
  HR: { label: 'HR', color: 'bg-pink-500' },
};

// All possible navigation items - stable across role changes
const ALL_NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/', roles: ['CEO', 'ADMIN', 'OPERATOR', 'DRIVER', 'MECHANIC', 'ACCOUNTANT', 'HR'] },
  { label: 'Fleet', icon: Truck, href: '/fleet', roles: ['CEO', 'ADMIN', 'DRIVER'] },
  { label: 'Trips', icon: Route, href: '/trips', roles: ['ADMIN', 'OPERATOR', 'DRIVER'] },
  { label: 'Finance', icon: DollarSign, href: '/finance', roles: ['CEO', 'ADMIN', 'ACCOUNTANT'] },
  { label: 'Expenses', icon: DollarSign, href: '/expenses', roles: ['ADMIN', 'ACCOUNTANT'] },
  { label: 'Income', icon: Calculator, href: '/income', roles: ['ADMIN', 'ACCOUNTANT'] },
  { label: 'Monthly Report', icon: BarChart2, href: '/monthly-report', roles: ['CEO', 'ADMIN', 'HR'] },
  { label: 'Users', icon: Users, href: '/users', roles: ['CEO', 'ADMIN', 'HR'] },
  { label: 'Inventory', icon: Package, href: '/inventory', roles: ['CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'] },
  { label: 'Parts Requests', icon: Wrench, href: '/parts-requests', roles: ['ADMIN', 'OPERATOR'] },
  { label: 'Request Parts', icon: Package, href: '/spare-parts', roles: ['MECHANIC'] },
  { label: 'Service Requests', icon: Wrench, href: '/service-requests', roles: ['ADMIN', 'MECHANIC'] },
  { label: 'Truck History', icon: History, href: '/truck-history', roles: ['ADMIN', 'MECHANIC'] },
  { label: 'Map', icon: MapPin, href: '/map', roles: ['CEO', 'ADMIN', 'OPERATOR', 'DRIVER'] },
  { label: 'Proof', icon: Home, href: '/proof', roles: ['ADMIN', 'DRIVER'] },
  { label: 'Report Maintenance', icon: History, href: '/report', roles: ['ADMIN', 'DRIVER'] },
  { label: 'Allowances', icon: Users, href: '/allowances', roles: ['ADMIN', 'HR'] },
  { label: 'Fuel Approvals', icon: Truck, href: '/fuel-approvals', roles: ['ADMIN', 'ACCOUNTANT'] },
  { label: 'AI Insights', icon: Sparkles, href: '/ai-insights', roles: ['CEO', 'ADMIN'] },
  { label: 'Audit Log', icon: Shield, href: '/audit', roles: ['CEO', 'ADMIN'] },
  { label: 'Notifications', icon: Bell, href: '/notifications', roles: ['CEO', 'ADMIN', 'OPERATOR', 'DRIVER', 'MECHANIC', 'HR'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { signOut, user } = useSupabase();
  const { role, changeRole } = useRole();

  // Check if current user is the admin
  const isAdminUser = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const currentRole = role || 'CEO';

  // Filter nav items based on current role
  // Admin sees everything, others see only their role's items
  const navItems = isAdminUser 
    ? ALL_NAV_ITEMS 
    : ALL_NAV_ITEMS.filter(item => item.roles.includes(currentRole));

  // Role change handler - stay on current page if accessible
  const handleRoleChange = useCallback((newRole: UserRole) => {
    changeRole(newRole);
  }, [changeRole]);

  return (
    <aside className="hidden md:flex flex-col w-60 fixed inset-y-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-50">
      <div className="p-6 flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl tracking-tighter text-white">Calvary</h1>
          <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-medium">Connect</p>
        </div>
        <NotificationBell />
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
              pathname === item.href 
                ? "bg-primary text-white" 
                : "hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-white"
            )}
          >
            <item.icon className={cn(
              "size-5 transition-colors",
              pathname === item.href ? "text-white" : "text-sidebar-foreground/50 group-hover:text-white"
            )} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        {/* Role Switcher - Only for Admin */}
        {isAdminUser && (
          <div className="bg-sidebar-accent/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wider">
              Switch Role
            </p>
            <div className="grid grid-cols-2 gap-1">
              {(['CEO', 'ADMIN', 'OPERATOR', 'DRIVER', 'MECHANIC', 'ACCOUNTANT', 'HR'] as UserRole[]).map((r) => (
                <Button
                  key={r}
                  variant={currentRole === r ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleRoleChange(r)}
                  className={cn(
                    'text-xs h-7 px-2 justify-start',
                    currentRole === r 
                      ? 'bg-primary text-white hover:bg-primary/90' 
                      : 'text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full mr-2', ROLE_CONFIG[r].color)} />
                  {ROLE_CONFIG[r].label}
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-sidebar-foreground/40">
              You have full admin access in all roles
            </p>
          </div>
        )}

        <button 
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/50 hover:bg-destructive hover:text-white transition-all"
          onClick={signOut}
        >
          <LogOut className="size-5" />
          <span>{t.logout}</span>
        </button>
      </div>
    </aside>
  );
}
