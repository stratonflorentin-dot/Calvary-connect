"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Truck, Navigation, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function LiveMapPage() {
  const { role } = useRole();
  const firestore = useFirestore();
  
  const locationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'driver_locations');
  }, [firestore]);

  const { data: locations } = useCollection(locationsQuery);

  if (!['CEO', 'OPERATIONS'].includes(role || '')) return <div className="p-8">Access Denied</div>;

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
              <Truck className="size-4" /> 12 Active Trips
            </Badge>
          </div>
        </div>

        {/* Real Live Map (Simulated with high-fidelity placeholder UI) */}
        <div className="flex-1 bg-slate-200 relative overflow-hidden">
          {/* Simulated Map Background */}
          <div className="absolute inset-0 grayscale opacity-40 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/0,0,1/1200x800?access_token=pk.placeholder')] bg-cover" />
          
          {/* Active Pings */}
          {locations?.map((loc) => (
            <div 
              key={loc.id} 
              className="absolute transition-all duration-1000"
              style={{ 
                left: `${(loc.longitude % 1) * 100}%`, 
                top: `${(loc.latitude % 1) * 100}%` 
              }}
            >
              <div className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping scale-150" />
                <div className="relative size-10 rounded-full bg-white shadow-xl border-2 border-primary flex items-center justify-center text-primary group-hover:scale-125 transition-transform">
                  <Navigation className="size-5" style={{ transform: `rotate(${loc.heading || 0}deg)` }} />
                </div>
                
                {/* Tooltip on Hover */}
                <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white p-2 rounded-lg shadow-2xl border w-32 hidden group-hover:block z-20">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Truck</p>
                  <p className="text-xs font-headline">G-2883-24</p>
                  <p className="text-[10px] text-emerald-600 mt-1">{loc.speed} KM/H</p>
                </div>
              </div>
            </div>
          ))}

          {/* Map Controls */}
          <div className="absolute bottom-24 right-6 flex flex-col gap-2">
            <button className="size-12 rounded-xl bg-white shadow-xl border flex items-center justify-center hover:bg-muted"><Plus /></button>
            <button className="size-12 rounded-xl bg-white shadow-xl border flex items-center justify-center hover:bg-muted font-bold text-lg">−</button>
            <button className="size-12 rounded-xl bg-primary shadow-xl flex items-center justify-center text-white"><MapPin /></button>
          </div>
        </div>

        {/* Active Alerts Panel */}
        <div className="absolute bottom-6 left-6 right-6 md:right-auto md:w-80 space-y-2">
          {locations?.filter(l => l.alertStatus === 'breakdown').map(l => (
            <Card key={l.id} className="p-3 border-l-4 border-l-rose-500 shadow-2xl bg-white/95 backdrop-blur-md animate-in slide-in-from-left">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <Truck className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">BREAKDOWN REPORTED</p>
                  <p className="text-[10px] text-muted-foreground">Truck G-7721 • A1 Highway</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
