"use client";

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Truck, Route, DollarSign, Users, Package, Fuel } from 'lucide-react';

export function StatCards() {
  const firestore = useFirestore();

  const fleetQuery = useMemoFirebase(() => firestore ? collection(firestore, 'fleet_vehicles') : null, [firestore]);
  const tripsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'trips') : null, [firestore]);
  const incomeQuery = useMemoFirebase(() => firestore ? collection(firestore, 'income') : null, [firestore]);
  const inventoryQuery = useMemoFirebase(() => firestore ? collection(firestore, 'inventory_items') : null, [firestore]);
  const locationsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'driver_locations') : null, [firestore]);

  const { data: fleet } = useCollection(fleetQuery);
  const { data: trips } = useCollection(tripsQuery);
  const { data: income } = useCollection(incomeQuery);
  const { data: inventory } = useCollection(inventoryQuery);
  const { data: locations } = useCollection(locationsQuery);

  const totalRevenue = income?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const activeTrips = trips?.filter(t => t.status !== 'delivered' && t.status !== 'cancelled').length || 0;
  const lowStock = inventory?.filter(i => (i.quantityAvailable || 0) < (i.reorderLevel || 10)).length || 0;
  const onlineDrivers = locations?.filter(l => l.isOnline).length || 0;

  const stats = [
    { label: 'Total Trucks', value: fleet?.length || 0, icon: Truck, gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
    { label: 'Active Trips', value: activeTrips, icon: Route, gradient: 'linear-gradient(135deg, #0f3460, #533483)' },
    { label: 'Total Revenue', value: `$${(totalRevenue / 1000).toFixed(1)}k`, icon: DollarSign, gradient: 'linear-gradient(135deg, #1B4332, #2D6A4F)' },
    { label: 'Fuel Requests', value: '4.2k L', icon: Fuel, gradient: 'linear-gradient(135deg, #7B2D00, #D97706)' },
    { label: 'Drivers Online', value: onlineDrivers, icon: Users, gradient: 'linear-gradient(135deg, #1a3a4a, #0369A1)' },
    { label: 'Low Stock', value: lowStock, icon: Package, gradient: 'linear-gradient(135deg, #7F1D1D, #DC2626)' },
  ];

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
