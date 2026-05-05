"use client";
// Calvary Fleet Stats v2.1 - East Africa Logistics

import { useSupabase } from '@/components/supabase-provider';
import { useRole } from '@/hooks/use-role';
import { Truck, MapPin, DollarSign, Users, Package, Thermometer, AlertTriangle, TrendingUp, Anchor, Navigation } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function StatCards() {
  const { user } = useSupabase();
  const { role } = useRole();
  const { format } = useCurrency();
  const { t } = useLanguage();

  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeTrips: 0,
    monthlyRevenue: 0,
    totalDrivers: 0,
    crossBorderTrips: 0,
    coldChainActive: 0,
    heavyCargoTrips: 0,
    fuelConsumption: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRealStats = async () => {
      try {
        setLoading(true);

        // Get real vehicle count
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('id, type, status');

        // Get real active trips with cargo type
        const { data: activeTrips } = await supabase
          .from('trips')
          .select('id, status, cargo_type, has_reefer')
          .in('status', ['in_transit', 'loading', 'pending']);

        // Get real monthly revenue from completed trips
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: monthlyTrips } = await supabase
          .from('trips')
          .select('revenue, price, created_at')
          .gte('created_at', `${currentMonth}-01`)
          .eq('status', 'completed');

        // Calculate revenue from real trip pricing
        const monthlyRevenue = monthlyTrips?.reduce((sum, trip) => {
          const tripRevenue = trip.revenue || trip.price || 0;
          return sum + Number(tripRevenue);
        }, 0) || 0;

        // Get real driver count
        const { data: drivers } = await supabase
          .from('user_profiles')
          .select('id, role')
          .eq('role', 'DRIVER');

        // Get cross-border trips (destination includes border regions or neighboring countries)
        const crossBorderTrips = activeTrips?.filter(trip => {
          const dest = (trip.destination || '').toLowerCase();
          return dest.includes('border') || dest.includes('dr Congo') || dest.includes('kenya') ||
                 dest.includes('zambia') || dest.includes('burundi') || dest.includes('rwanda') ||
                 dest.includes('uganda');
        }).length || 0;

        // Get cold chain active trips (reefer containers)
        const coldChainActive = activeTrips?.filter(trip => trip.has_reefer || trip.cargo_type === 'REEFER' || trip.cargo_type === 'cold_chain').length || 0;

        // Get heavy cargo trips (lowbed/dump trucks)
        const heavyCargoTrips = activeTrips?.filter(trip =>
          trip.cargo_type === 'LOWBED' || trip.cargo_type === 'heavy_equipment' || trip.cargo_type === 'machinery'
        ).length || 0;

        // Get real fuel consumption from actual fuel records
        const { data: fuelRecords } = await supabase
          .from('fuel_logs')
          .select('amount')
          .gte('created_at', `${currentMonth}-01`);

        const fuelConsumption = fuelRecords?.reduce((sum, record) =>
          sum + (record.amount || 0), 0
        ) || 0;

        setStats({
          totalVehicles: vehicles?.length || 0,
          activeTrips: activeTrips?.length || 0,
          monthlyRevenue,
          totalDrivers: drivers?.length || 0,
          crossBorderTrips,
          coldChainActive,
          heavyCargoTrips,
          fuelConsumption
        });

      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRealStats();
  }, [user]);

  const statItems = [
    {
      title: t.total_fleet || 'Total Fleet',
      value: stats.totalVehicles,
      icon: Truck,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: t.active_trips || 'Active Trips',
      value: stats.activeTrips,
      icon: Navigation,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: t.monthly_revenue || 'Monthly Revenue',
      value: format(stats.monthlyRevenue),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      title: t.cross_border || 'Cross-Border',
      value: stats.crossBorderTrips,
      icon: Anchor,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: t.cold_chain || 'Cold Chain Active',
      value: stats.coldChainActive,
      icon: Thermometer,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50'
    },
    {
      title: t.heavy_cargo || 'Heavy Cargo',
      value: stats.heavyCargoTrips,
      icon: Package,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      title: t.total_drivers || 'Total Drivers',
      value: stats.totalDrivers,
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: t.fuel_consumption || 'Fuel (L)',
      value: stats.fuelConsumption.toLocaleString(),
      icon: MapPin,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4">
      {statItems.map((stat, index) => (
        <div
          key={index}
          className="rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className={cn("p-2 rounded-lg", stat.bgColor)}>
              <stat.icon className={cn("size-5", stat.color)} />
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.title}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}