"use client";

import { cn } from '@/lib/utils';
import { Truck, Route, DollarSign, Users, Package, Fuel } from 'lucide-react';

interface StatItem {
  label: string;
  value: string | number;
  icon: any;
  gradient: string;
}

const stats: StatItem[] = [
  { label: 'Total Trucks', value: 24, icon: Truck, gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
  { label: 'Active Trips', value: 8, icon: Route, gradient: 'linear-gradient(135deg, #0f3460, #533483)' },
  { label: 'Total Revenue', value: '$124.5k', icon: DollarSign, gradient: 'linear-gradient(135deg, #1B4332, #2D6A4F)' },
  { label: 'Fuel Consumption', value: '4.2k L', icon: Fuel, gradient: 'linear-gradient(135deg, #7B2D00, #D97706)' },
  { label: 'Drivers Online', value: 12, icon: Users, gradient: 'linear-gradient(135deg, #1a3a4a, #0369A1)' },
  { label: 'Low Stock', value: 5, icon: Package, gradient: 'linear-gradient(135deg, #7F1D1D, #DC2626)' },
];

export function StatCards() {
  return (
    <div className="w-full">
      {/* Mobile Horizontal Scroll */}
      <div className="md:hidden flex overflow-x-auto no-scrollbar story-snap gap-3 py-2 px-1">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="min-w-[140px] h-24 rounded-2xl p-4 flex flex-col justify-between shrink-0"
            style={{ background: stat.gradient }}
          >
            <stat.icon className="size-5 text-white/70 self-end" />
            <div>
              <p className="text-[10px] text-white/60 font-medium uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-headline text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Grid */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card border-l-[3px] border-primary p-5 rounded-2xl shadow-sm hover:-translate-y-1 transition-transform duration-200"
          >
            <div className="flex justify-between items-start mb-2">
              <p className="text-[11px] font-sans font-medium text-muted-foreground uppercase tracking-widest">{stat.label}</p>
              <stat.icon className="size-6 text-primary" />
            </div>
            <p className="text-3xl font-headline tracking-tighter text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
