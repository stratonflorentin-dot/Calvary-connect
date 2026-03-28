
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, Truck, DollarSign, MapPin, User, Users, Route, Package, Wrench, History, Calculator, LayoutDashboard, BarChart2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/roles';
import { useLanguage } from '@/hooks/use-language';

export function BottomTabs({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const ROLE_TABS: Record<UserRole, any[]> = {
    CEO: [
      { label: t.home, icon: Home, href: '/' },
      { label: t.fleet, icon: Truck, href: '/fleet' },
      { label: t.finance, icon: DollarSign, href: '/finance' },
      { label: t.map, icon: MapPin, href: '/map' },
      { label: t.profile, icon: User, href: '/profile' },
    ],
    OPERATOR: [
      { label: t.home, icon: LayoutDashboard, href: '/' },
      { label: t.trips, icon: Route, href: '/trips' },
      { label: t.fleet, icon: Truck, href: '/fleet' },
      { label: t.map, icon: MapPin, href: '/map' },
      { label: t.profile, icon: User, href: '/profile' },
    ],
    DRIVER: [
      { label: t.home, icon: LayoutDashboard, href: '/' },
      { label: t.trips, icon: Route, href: '/trips' },
      { label: t.proof, icon: Home, href: '/proof' },
      { label: t.report_maintenance, icon: History, href: '/report' },
      { label: t.profile, icon: User, href: '/profile' },
    ],
    MECHANIC: [
      { label: t.home, icon: LayoutDashboard, href: '/' },
      { label: t.service_requests, icon: Wrench, href: '/service-requests' },
      { label: t.parts_requests, icon: Package, href: '/spare-parts' },
      { label: t.truck_history, icon: History, href: '/truck-history' },
      { label: t.profile, icon: User, href: '/profile' },
    ],
    ACCOUNTANT: [
      { label: t.home, icon: LayoutDashboard, href: '/' },
      { label: t.expenses, icon: DollarSign, href: '/expenses' },
      { label: t.income, icon: Calculator, href: '/income' },
      { label: t.fuel, icon: Truck, href: '/fuel-approvals' },
      { label: t.profile, icon: User, href: '/profile' },
    ],
    HR: [
      { label: t.home, icon: Home, href: '/' },
      { label: t.users, icon: Users, href: '/users' },
      { label: t.allowances, icon: DollarSign, href: '/allowances' },
      { label: t.monthly_report, icon: BarChart2, href: '/monthly-report' },
    ]
  };

  const tabs = ROLE_TABS[role] || [];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(60px+env(safe-area-inset-bottom))] bg-white border-t border-border flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] z-50">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className="flex flex-col items-center justify-center gap-1 w-full relative transition-transform active:scale-95 duration-150 py-2"
          >
            <tab.icon className={cn(
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
