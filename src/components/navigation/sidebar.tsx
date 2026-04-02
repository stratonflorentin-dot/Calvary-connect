
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { signOut, user } = useSupabase();
  const { role, changeRole } = useRole();

  // Check if current user is the admin (stratonflorentin@gmail.com)
  const isAdminUser = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const currentRole = role || 'CEO';

  const ROLE_NAV: Record<UserRole, any[]> = {
    CEO: [
      { label: t.dashboard, icon: LayoutDashboard, href: '/' },
      { label: t.fleet, icon: Truck, href: '/fleet' },
      { label: t.finance, icon: DollarSign, href: '/finance' },
      { label: t.monthly_report, icon: BarChart2, href: '/reports' },
      { label: t.users, icon: Users, href: '/users' },
      { label: t.inventory, icon: Package, href: '/inventory' },
      { label: t.map, icon: MapPin, href: '/map' },
      { label: t.ai_insights, icon: Sparkles, href: '/ai-insights' },
      { label: 'Audit Log', icon: Shield, href: '/audit' },
      { label: t.notifications, icon: Bell, href: '/notifications' },
    ],
    ADMIN: [
      // Admin has access to ALL pages from all roles
      { label: t.dashboard, icon: LayoutDashboard, href: '/' },
      { label: t.fleet, icon: Truck, href: '/fleet' },
      { label: t.trips, icon: Route, href: '/trips' },
      { label: t.finance, icon: DollarSign, href: '/finance' },
      { label: t.expenses, icon: DollarSign, href: '/expenses' },
      { label: t.income, icon: Calculator, href: '/income' },
      { label: t.fuel_approvals, icon: Truck, href: '/fuel-approvals' },
      { label: t.allowances, icon: Users, href: '/allowances' },
      { label: t.monthly_report, icon: BarChart2, href: '/reports' },
      { label: t.users, icon: Users, href: '/users' },
      { label: t.inventory, icon: Package, href: '/inventory' },
      { label: t.parts_requests, icon: Wrench, href: '/parts-requests' },
      { label: t.request_parts, icon: Package, href: '/spare-parts' },
      { label: t.service_requests, icon: Wrench, href: '/service-requests' },
      { label: t.truck_history, icon: History, href: '/truck-history' },
      { label: t.map, icon: MapPin, href: '/map' },
      { label: t.proof, icon: Home, href: '/proof' },
      { label: t.report_maintenance, icon: History, href: '/report' },
      { label: t.ai_insights, icon: Sparkles, href: '/ai-insights' },
      { label: 'Audit Log', icon: Shield, href: '/audit' },
      { label: t.notifications, icon: Bell, href: '/notifications' },
    ],
    OPERATOR: [
      { label: t.dashboard, icon: LayoutDashboard, href: '/' },
      { label: t.trips, icon: Route, href: '/trips' },
      { label: t.fleet_status, icon: Truck, href: '/fleet' },
      { label: t.inventory, icon: Package, href: '/inventory' },
      { label: t.parts_requests, icon: Wrench, href: '/parts-requests' },
      { label: t.fleet_map, icon: MapPin, href: '/map' },
      { label: t.notifications, icon: Bell, href: '/notifications' },
    ],
    MECHANIC: [
      { label: t.dashboard, icon: LayoutDashboard, href: '/' },
      { label: t.service_requests, icon: Wrench, href: '/service-requests' },
      { label: t.parts_requests, icon: Package, href: '/spare-parts' },
      { label: t.inventory, icon: Package, href: '/inventory' },
      { label: t.truck_history, icon: History, href: '/truck-history' },
      { label: t.notifications, icon: Bell, href: '/notifications' },
    ],
    ACCOUNTANT: [
      { label: t.dashboard, icon: LayoutDashboard, href: '/' },
      { label: t.expenses, icon: DollarSign, href: '/expenses' },
      { label: t.income, icon: Calculator, href: '/income' },
      { label: t.fuel_approvals, icon: Truck, href: '/fuel-approvals' },
      { label: t.allowances, icon: Users, href: '/allowances' },
      { label: t.monthly_report, icon: BarChart2, href: '/monthly-report' },
    ],
    DRIVER: [
      { label: t.dashboard, icon: LayoutDashboard, href: '/' },
      { label: t.trips, icon: Route, href: '/trips' },
      { label: t.fleet, icon: Truck, href: '/fleet' },
      { label: t.map, icon: MapPin, href: '/map' },
      { label: t.proof, icon: Home, href: '/proof' },
      { label: t.report_maintenance, icon: History, href: '/report' },
      { label: t.notifications, icon: Bell, href: '/notifications' },
    ],
    HR: [
      { label: t.dashboard, icon: LayoutDashboard, href: '/' },
      { label: t.users, icon: Users, href: '/users' },
      { label: t.allowances, icon: Users, href: '/allowances' },
      { label: t.monthly_report, icon: BarChart2, href: '/monthly-report' },
      { label: t.notifications, icon: Bell, href: '/notifications' },
    ]
  };

  const navItems = ROLE_NAV[currentRole] || [];

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
            key={item.label}
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
                  onClick={() => changeRole(r)}
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
