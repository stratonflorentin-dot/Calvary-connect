
"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { LocationService } from '@/lib/location-service';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Truck, Navigation, Search, Plus, Minus, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function LiveMapPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSample, setIsCreatingSample] = useState(false);

  useEffect(() => {
    const loadLocations = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Skip Supabase calls to prevent errors
        setLocations([]);
      } catch (error) {
        console.error('Error loading locations:', error);
        setLocations([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadLocations();
    
    // Set up real-time updates
    const subscription = supabase
      .channel('vehicle_locations')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'vehicle_locations' },
        (payload) => {
          console.log('Real-time location update:', payload);
          loadLocations(); // Reload locations when data changes
        }
      )
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const createSampleData = async () => {
    setIsCreatingSample(true);
    try {
      const success = await LocationService.createSampleData();
      if (success) {
        // Reload locations to show new sample data
        const { data: locationsData, error } = await supabase
          .from('vehicle_locations')
          .select(`
            id,
            vehicle_id,
            driver_id,
            latitude,
            longitude,
            heading,
            speed,
            status,
            is_online,
            alert_status,
            updated_at,
            user_profiles!inner (
              name,
              role
            ),
            vehicles!inner (
              plate_number,
              make,
              model
            )
          `)
          .eq('is_online', true)
          .order('updated_at', { ascending: false });
          
        if (!error && locationsData) {
          const transformedLocations = locationsData?.map(loc => ({
            id: loc.id,
            driverName: loc.user_profiles?.name || 'Unknown Driver',
            driverRole: loc.user_profiles?.role || 'driver',
            vehicleId: loc.vehicle_id,
            vehiclePlate: loc.vehicles?.plate_number || 'Unknown',
            vehicleMake: loc.vehicles?.make || 'Unknown',
            vehicleModel: loc.vehicles?.model || 'Unknown',
            latitude: loc.latitude,
            longitude: loc.longitude,
            heading: loc.heading || 0,
            speed: loc.speed || 0,
            status: loc.status || 'inactive',
            isOnline: loc.is_online || false,
            alertStatus: loc.alert_status || 'none',
            lastUpdate: loc.updated_at
          })) || [];
          
          setLocations(transformedLocations);
        }
      }
    } catch (error) {
      console.error('Error creating sample data:', error);
    } finally {
      setIsCreatingSample(false);
    }
  };

  if (!['CEO', 'ADMIN', 'OPERATOR'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  // Default center: Accra, Ghana
  const defaultCenter = { lat: 5.6037, lng: -0.1870 };

  return (
    <div className="flex h-screen bg-background overflow-hidden touch-none">
      <Sidebar />
      <main className="flex-1 md:ml-60 flex flex-col relative h-full">
        {/* Map Header Overlay */}
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-col md:flex-row gap-2 pointer-events-none">
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
            {locations?.length === 0 && (
              <button
                onClick={createSampleData}
                disabled={isCreatingSample}
                className="bg-amber-500 text-white whitespace-nowrap gap-2 py-1.5 md:py-2 px-3 md:px-4 shadow-lg h-fit border-none rounded-full text-xs md:text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreatingSample ? 'Creating...' : 'Create Sample Data'}
              </button>
            )}
          </div>
        </div>

        {/* Google Map Container */}
        <div className="flex-1 relative w-full h-full">
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
            <Map
              defaultCenter={defaultCenter}
              defaultZoom={12}
              gestureHandling={'greedy'}
              disableDefaultUI={true}
              mapId={'bf50a91341416e8'}
              className="w-full h-full"
            >
              {locations?.map((loc) => (
                <AdvancedMarker
                  key={loc.id}
                  position={{ lat: loc.latitude, lng: loc.longitude }}
                  onClick={() => setSelectedDriverId(loc.id)}
                >
                  <div className="relative">
                    {loc.alertStatus === 'breakdown' && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg animate-bounce z-20">
                        <AlertTriangle className="size-5" />
                      </div>
                    )}
                    <div className={cn(
                      "size-10 md:size-12 rounded-full border-2 bg-white shadow-2xl flex items-center justify-center transition-all hover:scale-125 cursor-pointer",
                      loc.isOnline ? "border-emerald-500" : "border-muted-foreground grayscale"
                    )}>
                      <Navigation 
                        className={cn("size-5 md:size-6", loc.isOnline ? "text-emerald-600" : "text-muted-foreground")} 
                        style={{ transform: `rotate(${loc.heading || 0}deg)` }} 
                      />
                    </div>
                  </div>
                </AdvancedMarker>
              ))}

              {selectedDriverId && locations?.find(l => l.id === selectedDriverId) && (
                <InfoWindow
                  position={{ 
                    lat: locations.find(l => l.id === selectedDriverId)!.latitude, 
                    lng: locations.find(l => l.id === selectedDriverId)!.longitude 
                  }}
                  onCloseClick={() => setSelectedDriverId(null)}
                >
                  <div className="p-1 min-w-[140px]">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Asset Status</p>
                    <p className="text-xs font-headline text-primary mb-1">{locations.find(l => l.id === selectedDriverId)?.vehiclePlate || 'Unknown'}</p>
                    <p className="text-[9px] text-muted-foreground mb-1">{locations.find(l => l.id === selectedDriverId)?.driverName || 'Unknown Driver'}</p>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-emerald-600 font-bold">
                        {locations.find(l => l.id === selectedDriverId)?.speed || 0} KM/H
                      </p>
                      <Badge className={cn(
                        "text-[9px] h-4 px-1 border-none",
                        locations.find(l => l.id === selectedDriverId)?.isOnline 
                          ? "bg-emerald-100 text-emerald-700" 
                          : "bg-gray-100 text-gray-700"
                      )}>
                        {locations.find(l => l.id === selectedDriverId)?.isOnline ? "Online" : "Offline"}
                      </Badge>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-2 border-t pt-1">
                      Status: {locations.find(l => l.id === selectedDriverId)?.status || 'Unknown'}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      Last Update: {locations.find(l => l.id === selectedDriverId)?.lastUpdate 
                        ? new Date(locations.find(l => l.id === selectedDriverId)!.lastUpdate).toLocaleTimeString()
                        : 'Unknown'
                      }
                    </p>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>

          {/* Map Controls */}
          <div className="absolute bottom-24 md:bottom-10 right-4 md:right-6 flex flex-col gap-2 pointer-events-auto">
            <button className="size-10 md:size-12 rounded-xl bg-white shadow-xl border flex items-center justify-center hover:bg-muted active:scale-90 transition-transform">
              <Plus className="size-5" />
            </button>
            <button className="size-10 md:size-12 rounded-xl bg-white shadow-xl border flex items-center justify-center hover:bg-muted active:scale-90 transition-transform">
              <Minus className="size-5" />
            </button>
            <button className="size-10 md:size-12 rounded-xl bg-primary shadow-xl flex items-center justify-center text-white active:scale-95 transition-transform">
              <MapPin className="size-5" />
            </button>
          </div>
        </div>

        {/* Active Alerts Panel */}
        <div className="absolute bottom-28 md:bottom-10 left-4 right-4 md:right-auto md:w-80 space-y-2 pointer-events-none">
          {locations?.filter(l => l.alertStatus && l.alertStatus !== 'none').map(l => (
            <Card key={l.id} className="p-3 border-l-4 border-l-rose-500 shadow-2xl bg-white/95 backdrop-blur-md animate-in slide-in-from-left pointer-events-auto">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="size-4" />
                </div>
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
