
"use client";


import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Truck, Route, DollarSign, BarChart2, Users, Package, MapPin, Sparkles, Bell, Wrench, Calculator, LogOut, History, Home, Shield, User as UserIcon,
  Briefcase, Building2, CalendarDays
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/roles';
import { useLanguage } from '@/hooks/use-language';
import { getNavigationMenuByRole } from '@/lib/route-config';
import { useSupabase } from '@/components/supabase-provider';

// Map route paths to icons
const routeIconMap: Record<string, any> = {
  '/': LayoutDashboard,
  '/fleet': Truck,
  '/trips': Route,
  '/bookings': CalendarDays,
  '/customers': Building2,
  '/sales': Briefcase,
  '/finance': DollarSign,
  '/expenses': DollarSign,
  '/income': Calculator,
  '/fuel-approvals': Truck,
  '/allowances': Users,
  '/reports': BarChart2,
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
  '/profile': UserIcon,
  '/hr/insurance': Shield,
  '/hr/meetings': CalendarDays,
};

export function BottomTabs({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user, signOut } = useSupabase();

  // Get menu items for the current role
  const menuItems = getNavigationMenuByRole(role, false, t, user?.email);

  const tabs = menuItems.slice(0, 5);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-sm backdrop-blur">
      <div className="flex h-[64px] items-center gap-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          const Icon = routeIconMap[tab.path] || LayoutDashboard;
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={cn(
                "relative flex min-w-[74px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs transition-all active:scale-95",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className={cn(
                "size-5 transition-colors",
                isActive ? "text-primary-foreground" : "text-muted-foreground"
              )} />
              <span className={cn(
                "max-w-[64px] truncate whitespace-nowrap text-[10px] transition-colors",
                isActive ? "font-semibold text-primary-foreground" : "text-muted-foreground"
              )}>{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={signOut}
          className="flex min-w-[74px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs text-destructive transition-all hover:bg-destructive/10 active:scale-95"
        >
          <LogOut className="size-5" />
          <span className="text-[10px] font-semibold">{t.logout || "Logout"}</span>
        </button>
      </div>
    </nav>
  );
}
