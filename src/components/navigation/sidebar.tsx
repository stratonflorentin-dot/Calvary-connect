"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Truck, Route, DollarSign, BarChart2, 
  Users, Package, MapPin, Sparkles, Bell, Wrench, Calculator, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/roles';

const ROLE_NAV: Record<UserRole, any[]> = {
  CEO: [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
    { label: 'Fleet', icon: Truck, href: '/fleet' },
    { label: 'Finance', icon: DollarSign, href: '/finance' },
    { label: 'Reports', icon: BarChart2, href: '/reports' },
    { label: 'User Management', icon: Users, href: '/users' },
    { label: 'Inventory', icon: Package, href: '/inventory' },
    { label: 'Live Map', icon: MapPin, href: '/map' },
    { label: 'AI Insights', icon: Sparkles, href: '/ai-insights' },
    { label: 'Notifications', icon: Bell, href: '/notifications' },
  ],
  OPERATIONS: [
    { label: 'Trips & Dispatch', icon: Route, href: '/trips' },
    { label: 'Fleet Status', icon: Truck, href: '/fleet' },
    { label: 'Inventory Control', icon: Package, href: '/inventory' },
    { label: 'Parts Requests', icon: Wrench, href: '/parts-requests' },
    { label: 'Fleet Map', icon: MapPin, href: '/map' },
    { label: 'Notifications', icon: Bell, href: '/notifications' },
  ],
  MECHANIC: [
    { label: 'Service Requests', icon: Wrench, href: '/service-requests' },
    { label: 'Inventory', icon: Package, href: '/inventory' },
    { label: 'Spare Parts', icon: Truck, href: '/spare-parts' },
    { label: 'Truck History', icon: BarChart2, href: '/truck-history' },
    { label: 'Notifications', icon: Bell, href: '/notifications' },
  ],
  ACCOUNTANT: [
    { label: 'Expenses', icon: DollarSign, href: '/expenses' },
    { label: 'Income', icon: Calculator, href: '/income' },
    { label: 'Fuel Approvals', icon: Truck, href: '/fuel-approvals' },
    { label: 'Allowances', icon: Users, href: '/allowances' },
    { label: 'Monthly Report', icon: BarChart2, href: '/monthly-report' },
  ],
  DRIVER: [] // Driver is mobile only
};

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
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
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
