
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Truck, Route, DollarSign, BarChart2, 
  Users, Package, MapPin, Sparkles, Bell, Wrench, Calculator, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/roles';
import { useLanguage } from '@/hooks/use-language';

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { t } = useLanguage();

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
      { label: t.notifications, icon: Bell, href: '/notifications' },
    ],
    OPERATIONS: [
      { label: t.trips, icon: Route, href: '/trips' },
      { label: t.fleet_status, icon: Truck, href: '/fleet' },
      { label: t.inventory, icon: Package, href: '/inventory' },
      { label: t.parts_requests, icon: Wrench, href: '/parts-requests' },
      { label: t.fleet_map, icon: MapPin, href: '/map' },
      { label: t.notifications, icon: Bell, href: '/notifications' },
    ],
    MECHANIC: [
      { label: t.service_requests, icon: Wrench, href: '/service-requests' },
      { label: t.inventory, icon: Package, href: '/inventory' },
      { label: t.parts_requests, icon: Truck, href: '/spare-parts' },
      { label: t.truck_history, icon: BarChart2, href: '/truck-history' },
      { label: t.notifications, icon: Bell, href: '/notifications' },
    ],
    ACCOUNTANT: [
      { label: t.expenses, icon: DollarSign, href: '/expenses' },
      { label: t.income, icon: Calculator, href: '/income' },
      { label: t.fuel_approvals, icon: Truck, href: '/fuel-approvals' },
      { label: t.allowances, icon: Users, href: '/allowances' },
      { label: t.monthly_report, icon: BarChart2, href: '/monthly-report' },
    ],
    DRIVER: []
  };

  const navItems = ROLE_NAV[role] || [];

  return (
    <aside className="hidden md:flex flex-col w-60 fixed inset-y-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-50">
      <div className="p-6">
        <h1 className="font-headline text-2xl tracking-tighter text-white">Calvary</h1>
        <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-medium">Connect</p>
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

      <div className="p-4 border-t border-sidebar-border">
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/50 hover:bg-destructive hover:text-white transition-all">
          <LogOut className="size-5" />
          <span>{t.logout}</span>
        </button>
      </div>
    </aside>
  );
}
