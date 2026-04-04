"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Truck, Route, DollarSign, BarChart2, 
  Users, Package, MapPin, Sparkles, Bell, Wrench, Calculator, LogOut, History, Home, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/roles';
import { useLanguage } from '@/hooks/use-language';
import { useSupabase } from '@/components/supabase-provider';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ADMIN_EMAIL } from '@/lib/supabase';
import { getMenuByRole } from '@/lib/route-config';

// ✅ Move icon map OUTSIDE the component so it's always available
const routeIconMap: Record<string, any> = {
  '/': LayoutDashboard,
  '/fleet': Truck,
  '/trips': Route,
  '/finance': DollarSign,
  '/expenses': DollarSign,
  '/income': Calculator,
  '/fuel-approvals': Truck,
  '/allowances': Users,
  '/reports': BarChart2,
  '/monthly-report': BarChart2,
  '/users': Users,
  '/inventory': Package,
  '/parts-requests': Wrench,
  '/spare-parts': Package,
  '/service-requests': Wrench,
  '/truck-history': History,
  '/map': MapPin,
  '/proof': Home,
  '/report': History,
  '/ai-insights': Sparkles,
  '/audit': Shield,
  '/notifications': Bell,
};

const getIconForRoute = (path: string) => routeIconMap[path] || LayoutDashboard;

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { signOut, user } = useSupabase();
  const isAdminEmail = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // ✅ Track stored role reactively
  const [storedRole, setStoredRole] = useState<UserRole | null>(null);

  useEffect(() => {
    // Read initial value
    const saved = localStorage.getItem('fleet_command_role') as UserRole | null;
    setStoredRole(saved);

    // ✅ Listen for changes when role is switched elsewhere in the app
    const handleStorageChange = () => {
      const updated = localStorage.getItem('fleet_command_role') as UserRole | null;
      setStoredRole(updated);
    };

    window.addEventListener('storage', handleStorageChange);

    // ✅ Also listen for custom event (for same-tab changes)
    window.addEventListener('roleChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('roleChanged', handleStorageChange);
    };
  }, []);

  const effectiveRole = isAdminEmail
    ? (storedRole || role || 'ADMIN')
    : role;

  // ✅ Admin always gets full menu access even when switching roles
  // This allows them to view all features without restriction
  const menuItems = getMenuByRole(
    effectiveRole,
    false,
    t,
    user?.email,
    false  // ✅ Never restrict the menu for the admin/owner
  );

  interface NavItem {
    label: string;
    icon: any;
    href: string;
  }

  const navItems: NavItem[] = menuItems.map(route => ({
    label: route.label,
    icon: getIconForRoute(route.path),
    href: route.path,
  }));

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
        {navItems.map((item: NavItem) => (
          <Link
            key={item.href}  // ✅ Use href as key, not label (labels can duplicate)
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

      <div className="p-4 border-t border-sidebar-border">
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