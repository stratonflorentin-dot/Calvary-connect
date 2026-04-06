'use client';

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Truck, Navigation, Search, Plus, Minus, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import for Leaflet map (no SSR)
const LeafletMap = dynamic(
  () => import('@/components/leaflet-map').then(mod => mod.LeafletMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-100 flex items-center justify-center">Loading map...</div> }
);

interface DriverLocation {
  id: string;
  driverName: string;
  driverRole: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleMake: string;
  vehicleModel: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  status: string;
  isOnline: boolean;
  alertStatus: string;
  lastUpdate: string;
}

export default function LiveMapPage() {
  const { role, isAdmin } = useRole();
  const { user } = useSupabase();
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('Loading...');
  const [showDebug, setShowDebug] = useState(true);

  useEffect(() => {
    const loadLocations = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        console.log('[LiveMap] Loading driver locations...');
        
        // Fetch locations and profiles separately (no foreign key relationship in DB)
        const [{ data: locationsData, error: locError }, { data: profilesData }] = await Promise.all([
          supabase
            .from('driver_locations')
            .select('*')
            .order('last_updated', { ascending: false }),
          supabase
            .from('user_profiles')
            .select('id, name')
        ]);
        
        const error = locError;
          
        if (error) {
          console.error('[LiveMap] Database error:', error);
          setDebugInfo(`Error: ${error.message}`);
          setLocations([]);
        } else {
          console.log('[LiveMap] Raw locations data:', locationsData);
          console.log('[LiveMap] Profiles data:', profilesData);
          console.log('[LiveMap] Loaded', locationsData?.length || 0, 'locations');
          setDebugInfo(`Loaded ${locationsData?.length || 0} drivers from DB`);
          
          // Create lookup map for profiles
          const profileMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);
          
          const transformedLocations = locationsData?.map(loc => {
            const profileName = profileMap.get(loc.driver_id);
            console.log(`[LiveMap] Driver ${loc.driver_id}: profile name =`, profileName);
            return {
              id: loc.id || loc.driver_id,
              driverName: profileName || `Driver ${loc.driver_id?.slice(0, 8)}`,
              driverRole: 'DRIVER',
              vehicleId: loc.driver_id,
              vehiclePlate: 'N/A',
              vehicleMake: 'Unknown',
              vehicleModel: 'Unknown',
              latitude: Number(loc.latitude),
              longitude: Number(loc.longitude),
              heading: loc.heading || 0,
              speed: loc.speed || 0,
              status: loc.is_online ? 'active' : 'inactive',
              isOnline: loc.is_online || false,
              alertStatus: 'none',
              lastUpdate: loc.last_updated
            };
          }) || [];
          
          setDebugInfo(`Showing ${transformedLocations.length} drivers on map`);
          console.log('[LiveMap] Transformed locations:', transformedLocations);
          setLocations(transformedLocations);
        }
      } catch (error) {
        console.error('[LiveMap] Error loading locations:', error);
        setDebugInfo(`Exception: ${error}`);
        setLocations([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadLocations();
    
    const subscription = supabase
      .channel('driver_locations')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'driver_locations' },
        (payload) => {
          console.log('[LiveMap] Real-time update:', payload);
          setDebugInfo(`Real-time update received`);
          loadLocations();
        }
      )
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  if (!isAdmin && !['CEO', 'ADMIN', 'OPERATOR'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  const defaultCenter: [number, number] = [-3.3869, 36.6830];

  const leafletLocations = locations.map(loc => ({
    id: loc.id,
    driverName: loc.driverName,
    latitude: loc.latitude,
    longitude: loc.longitude,
    speed: loc.speed,
    status: loc.status,
    isOnline: loc.isOnline,
    vehiclePlate: loc.vehiclePlate,
    lastUpdate: loc.lastUpdate
  }));

  return (
    <div className="flex h-screen bg-background overflow-hidden touch-none">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 flex flex-col relative h-full">
        {/* Map Header Overlay */}
        <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col md:flex-row gap-2 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md p-3 md:p-4 rounded-2xl shadow-xl border flex-1 md:max-w-sm pointer-events-auto">
            <h2 className="text-base md:text-lg font-headline tracking-tighter mb-1 md:mb-2">Fleet Command Center</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 md:size-4 text-muted-foreground" />
              <Input placeholder="Track truck ID..." className="pl-8 md:pl-9 h-8 md:h-10 text-xs md:text-sm rounded-full bg-white/50" />
            </div>
          </div>
          
          <div className="flex gap-2 pointer-events-auto overflow-x-auto no-scrollbar pb-2 md:pb-0">
            <Badge className="bg-emerald-500 text-white whitespace-nowrap gap-2 py-1.5 md:py-2 px-3 md:px-4 shadow-lg h-fit border-none">
              <div className="size-2 rounded-full bg-white animate-pulse" />
              {locations?.filter(l => l.isOnline).length || 0} Online
            </Badge>
            <Badge className="bg-primary text-white whitespace-nowrap gap-2 py-1.5 md:py-2 px-3 md:px-4 shadow-lg h-fit border-none">
              <Truck className="size-3 md:size-4" /> {locations?.length || 0} Assets
            </Badge>
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="bg-amber-500 text-white whitespace-nowrap gap-2 py-1.5 md:py-2 px-3 md:px-4 shadow-lg h-fit border-none rounded-full text-xs md:text-sm hover:bg-amber-600 transition-colors"
            >
              {showDebug ? 'Hide Debug' : 'Show Debug'}
            </button>
          </div>
        </div>

        {/* Leaflet Map Container */}
        <div className="flex-1 relative w-full h-full z-0">
          <LeafletMap locations={leafletLocations} defaultCenter={defaultCenter} />

          {/* Debug Panel */}
          {showDebug && (
            <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border pointer-events-auto max-w-xs">
              <p className="text-xs font-bold mb-1">Debug Info</p>
              <p className="text-xs text-muted-foreground">{debugInfo}</p>
              <p className="text-xs text-muted-foreground mt-1">Drivers: {locations.length} | Online: {locations.filter(l => l.isOnline).length}</p>
              {locations.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">No drivers. Driver must grant location permission.</p>
              )}
              <button 
                onClick={async () => {
                  const { data, error } = await supabase.from('driver_locations').select('*');
                  console.log('DB check:', { data, error });
                  setDebugInfo(`DB: ${data?.length || 0} records. ${error?.message || 'OK'}`);
                }}
                className="mt-2 w-full py-1 px-2 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
              >Check DB</button>
            </div>
          )}

          {/* Map Controls */}
          <div className="absolute bottom-24 md:bottom-10 right-4 md:right-6 flex flex-col gap-2 pointer-events-auto z-[1000]">
            <button className="size-10 md:size-12 rounded-xl bg-white shadow-xl border flex items-center justify-center hover:bg-muted active:scale-90 transition-transform"><Plus className="size-5" /></button>
            <button className="size-10 md:size-12 rounded-xl bg-white shadow-xl border flex items-center justify-center hover:bg-muted active:scale-90 transition-transform"><Minus className="size-5" /></button>
            <button className="size-10 md:size-12 rounded-xl bg-primary shadow-xl flex items-center justify-center text-white active:scale-95 transition-transform"><MapPin className="size-5" /></button>
          </div>
        </div>

        {/* Active Alerts Panel */}
        <div className="absolute bottom-28 md:bottom-10 left-4 right-4 md:right-auto md:w-80 space-y-2 pointer-events-none z-[1000]">
          {locations?.filter(l => l.alertStatus && l.alertStatus !== 'none').map(l => (
            <Card key={l.id} className="p-3 border-l-4 border-l-rose-500 shadow-2xl bg-white/95 backdrop-blur-md animate-in slide-in-from-left pointer-events-auto">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600"><AlertTriangle className="size-4" /></div>
                <div>
                  <p className="text-xs font-bold">{l.alertStatus?.toUpperCase().replace('_', ' ') || 'ALERT'}</p>
                  <p className="text-[10px] text-muted-foreground">{l.vehiclePlate || 'Unknown'} • {l.driverName || 'Unknown Driver'}</p>
                  <p className="text-[9px] text-muted-foreground">Lat: {l.latitude.toFixed(4)}, Lng: {l.longitude.toFixed(4)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
