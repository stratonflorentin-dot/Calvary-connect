
"use client";


import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Truck, Route, DollarSign, BarChart2, Users, Package, MapPin, Sparkles, Bell, Wrench, Calculator, LogOut, History, Home, Shield, Camera, User as UserIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/roles';
import { useLanguage } from '@/hooks/use-language';
import { getMenuByRole } from '@/lib/route-config';
import { useSupabase } from '@/components/supabase-provider';

// Map route paths to icons
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
  '/profile': UserIcon,
};

export function BottomTabs({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user } = useSupabase();

  // Get menu items for the current role
  const menuItems = getMenuByRole(role, false, t, user?.email);

  // Only show up to 5 main items (customize as needed)
  const tabs = menuItems.slice(0, 5);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(60px+env(safe-area-inset-bottom))] bg-white border-t border-border flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] z-50">
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;
        const Icon = routeIconMap[tab.path] || LayoutDashboard;
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className="flex flex-col items-center justify-center gap-1 w-full relative transition-transform active:scale-95 duration-150 py-2"
          >
            <Icon className={cn(
              "size-6 transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )} />
            <span className={cn(
              "text-xs transition-colors",
              isActive ? "text-primary font-medium" : "text-muted-foreground"
            )}>{tab.label}</span>
            {isActive && <div className="size-1 rounded-full bg-primary absolute -bottom-1" />}
          </Link>
        );
      })}
    </nav>
  );
}
