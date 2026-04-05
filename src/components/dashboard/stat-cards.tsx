"use client";

import { useSupabase } from '@/components/supabase-provider';
import { useRole } from '@/hooks/use-role';
import { Truck, Route, Coins, Users, Package, Fuel } from 'lucide-react';
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
    inventoryItems: 0,
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
          .select('id');
        
        // Get real active trips
        const { data: activeTrips } = await supabase
          .from('trips')
          .select('id')
          .in('status', ['in_transit', 'loading']);
        
        // Get real monthly revenue from completed trips
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: monthlyTrips } = await supabase
          .from('trips')
          .select('revenue, price, created_at')
          .gte('created_at', `${currentMonth}-01`)
          .lt('created_at', `${currentMonth}-31`)
          .eq('status', 'completed');
        
        // Calculate revenue from real trip pricing
        const monthlyRevenue = monthlyTrips?.reduce((sum, trip) => {
          const tripRevenue = trip.revenue || trip.price || 0; // Use actual revenue if available
          return sum + Number(tripRevenue);
        }, 0) || 0;
        
        // Get real driver count - use uppercase DRIVER to match role values
        const { data: drivers, error: driverError } = await supabase
          .from('user_profiles')
          .select('id, role')
          .eq('role', 'DRIVER');
        
        if (driverError) {
          console.error('[StatCards] Driver query error:', driverError);
        } else {
          console.log('[StatCards] Found', drivers?.length || 0, 'drivers');
        }
        
        // Get real parts inventory
        const { data: parts } = await supabase
          .from('parts_inventory')
          .select('quantity');
        
        const inventoryItems = parts?.reduce((sum, part) => sum + (part.quantity || 0), 0) || 0;
        
        // Get real fuel consumption from actual fuel records or default to 0
        const { data: fuelRecords } = await supabase
          .from('fuel_logs')
          .select('amount')
          .gte('created_at', `${currentMonth}-01`)
          .lt('created_at', `${currentMonth}-31`);
        
        const fuelConsumption = fuelRecords?.reduce((sum, record) => 
          sum + (record.amount || 0), 0
        ) || 0;
        
        setStats({
          totalVehicles: vehicles?.length || 0,
          activeTrips: activeTrips?.length || 0,
          monthlyRevenue,
          totalDrivers: drivers?.length || 0,
          inventoryItems,
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
      icon: Route,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: t.monthly_revenue || 'Monthly Revenue',
      value: format(stats.monthlyRevenue),
      icon: Coins,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: t.total_drivers || 'Total Drivers',
      value: stats.totalDrivers,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: t.inventory_items || 'Inventory Items',
      value: stats.inventoryItems,
      icon: Package,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: t.fuel_consumption || 'Fuel (L)',
      value: stats.fuelConsumption,
      icon: Fuel,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.title}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
