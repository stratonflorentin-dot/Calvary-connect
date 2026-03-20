
"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Truck, Navigation, Search, Plus, Minus, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { APIProvider, Map, Marker, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { useState } from 'react';

export default function LiveMapPage() {
  const { role } = useRole();
  const firestore = useFirestore();
  const { user } = useUser();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  
  const locationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'driver_locations');
  }, [firestore, user]);

  const { data: locations, isLoading } = useCollection(locationsQuery);

  if (!['CEO', 'OPERATIONS'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  // Default center: Accra, Ghana
  const defaultCenter = { lat: 5.6037, lng: -0.1870 };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 flex flex-col relative">
        {/* Map Header Overlay */}
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-col md:flex-row gap-4 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border flex-1 md:max-w-sm pointer-events-auto">
            <h2 className="text-lg font-headline tracking-tighter mb-2">Fleet Command Center</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Track specific truck..." className="pl-9 rounded-full bg-white/50" />
            </div>
          </div>
          
          <div className="flex gap-2 pointer-events-auto overflow-x-auto no-scrollbar">
            <Badge className="bg-emerald-500 text-white whitespace-nowrap gap-2 py-2 px-4 shadow-lg h-fit">
              <div className="size-2 rounded-full bg-white animate-pulse" />
              {locations?.filter(l => l.isOnline).length || 0} Online
            </Badge>
            <Badge className="bg-primary text-white whitespace-nowrap gap-2 py-2 px-4 shadow-lg h-fit">
              <Truck className="size-4" /> {locations?.length || 0} Total Assets
            </Badge>
          </div>
        </div>

        {/* Google Map Container */}
        <div className="flex-1 relative">
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
            <Map
              defaultCenter={defaultCenter}
              defaultZoom={12}
              gestureHandling={'greedy'}
              disableDefaultUI={true}
              mapId={'bf50a91341416e8'} // Use a valid map ID if you have one for AdvancedMarkers
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
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-rose-500 text-white p-1 rounded-full shadow-lg animate-bounce">
                        <AlertTriangle className="size-4" />
                      </div>
                    )}
                    <div className={cn(
                      "size-10 rounded-full border-2 bg-white shadow-xl flex items-center justify-center transition-transform hover:scale-110",
                      loc.isOnline ? "border-emerald-500" : "border-muted-foreground grayscale"
                    )}>
                      <Navigation 
                        className={cn("size-5", loc.isOnline ? "text-emerald-600" : "text-muted-foreground")} 
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
                  <div className="p-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Truck ID</p>
                    <p className="text-sm font-headline">{selectedDriverId.slice(0, 8)}</p>
                    <p className="text-xs text-emerald-600 font-bold mt-1">
                      {locations.find(l => l.id === selectedDriverId)!.speed} KM/H
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Last Updated: {new Date(locations.find(l => l.id === selectedDriverId)!.lastUpdated).toLocaleTimeString()}
                    </p>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>

          {/* Map Controls */}
          <div className="absolute bottom-24 right-6 flex flex-col gap-2 pointer-events-auto">
            <button className="size-12 rounded-xl bg-white shadow-xl border flex items-center justify-center hover:bg-muted">
              <Plus className="size-5" />
            </button>
            <button className="size-12 rounded-xl bg-white shadow-xl border flex items-center justify-center hover:bg-muted">
              <Minus className="size-5" />
            </button>
            <button className="size-12 rounded-xl bg-primary shadow-xl flex items-center justify-center text-white">
              <MapPin className="size-5" />
            </button>
          </div>
        </div>

        {/* Active Alerts Panel */}
        <div className="absolute bottom-6 left-6 right-6 md:right-auto md:w-80 space-y-2 pointer-events-none">
          {locations?.filter(l => l.alertStatus === 'breakdown').map(l => (
            <Card key={l.id} className="p-3 border-l-4 border-l-rose-500 shadow-2xl bg-white/95 backdrop-blur-md animate-in slide-in-from-left pointer-events-auto">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">BREAKDOWN REPORTED</p>
                  <p className="text-[10px] text-muted-foreground">Truck {l.id.slice(0, 6)} • Lat: {l.latitude.toFixed(4)}, Lng: {l.longitude.toFixed(4)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
