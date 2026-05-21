import { supabase } from '@/lib/supabase';
import { useEffect, useState, useRef } from 'react';
import { debounce } from 'lodash';

export interface DriverProfile {
  id: string;
  name: string;
  vehicle_type: string;
  status: 'online' | 'offline';
  lat: number;
  lng: number;
  speed: number;
  last_update: string;
}

/**
 * Hook that subscribes to Supabase realtime updates for vehicle positions.
 * Only the dynamic fields (lat, lng, speed, status, last_update) are refreshed.
 * Updates are debounced (300 ms) to keep UI smooth.
 */
export function useFleetRealtime() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const driverMap = useRef<Record<string, DriverProfile>>({});

  useEffect(() => {
    // Initial load of static vehicle data.
    supabase.from('vehicles').select('*').then(({ data }) => {
      if (data) {
        data.forEach(d => (driverMap.current[d.id] = d as DriverProfile));
        setDrivers(Object.values(driverMap.current));
      }
    });

    // Realtime subscription – only changes we care about.
    const channel = supabase
      .channel('public:vehicles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, payload => {
        const newData = payload.new as Partial<DriverProfile>;
        const id = newData.id!;
        const prev = driverMap.current[id] ?? {};
        driverMap.current[id] = { ...prev, ...newData } as DriverProfile;
        debouncedUpdate();
      })
      .subscribe();

    const debouncedUpdate = debounce(() => {
      setDrivers(Object.values(driverMap.current));
    }, 300);

    return () => {
      supabase.removeChannel(channel);
      debouncedUpdate.cancel();
    };
  }, []);

  return drivers;
}
