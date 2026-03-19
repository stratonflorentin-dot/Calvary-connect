"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, Truck, DollarSign, MapPin, User, Route, Package, Wrench, History, Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/roles';

const ROLE_TABS: Record<UserRole, any[]> = {
  CEO: [
    { label: 'Home', icon: Home, href: '/' },
    { label: 'Fleet', icon: Truck, href: '/fleet' },
    { label: 'Finance', icon: DollarSign, href: '/finance' },
    { label: 'Map', icon: MapPin, href: '/map' },
    { label: 'Profile', icon: User, href: '/profile' },
  ],
  OPERATIONS: [
    { label: 'Trips', icon: Route, href: '/trips' },
    { label: 'Fleet', icon: Truck, href: '/fleet' },
    { label: 'Inventory', icon: Package, href: '/inventory' },
    { label: 'Map', icon: MapPin, href: '/map' },
    { label: 'Profile', icon: User, href: '/profile' },
  ],
  DRIVER: [
    { label: 'My Trips', icon: Route, href: '/trips' },
    { label: 'Proof', icon: Home, href: '/proof' },
    { label: 'Report', icon: History, href: '/report' },
    { label: 'Profile', icon: User, href: '/profile' },
  ],
  MECHANIC: [
    { label: 'Requests', icon: Wrench, href: '/requests' },
    { label: 'Parts', icon: Truck, href: '/parts' },
    { label: 'Inventory', icon: Package, href: '/inventory' },
    { label: 'History', icon: History, href: '/history' },
    { label: 'Profile', icon: User, href: '/profile' },
  ],
  ACCOUNTANT: [
    { label: 'Overview', icon: Home, href: '/finance' },
    { label: 'Expenses', icon: DollarSign, href: '/expenses' },
    { label: 'Income', icon: Calculator, href: '/income' },
    { label: 'Fuel', icon: Truck, href: '/fuel' },
    { label: 'Profile', icon: User, href: '/profile' },
  ]
};

export function BottomTabs({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const tabs = ROLE_TABS[role] || [];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(60px+env(safe-area-inset-bottom))] bg-white border-t border-border flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] z-50">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className="flex flex-col items-center justify-center gap-1 w-full relative transition-transform active:scale-125 duration-150"
          >
            <tab.icon className={cn(
              "size-6 transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )} />
            {isActive && <div className="size-1 rounded-full bg-primary absolute -bottom-1" />}
          </Link>
        );
      })}
    </nav>
  );
}
