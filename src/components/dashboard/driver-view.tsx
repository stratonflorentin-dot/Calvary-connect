
"use client";

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Camera, AlertTriangle, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';

export function DriverView() {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Real-time location simulation for the "Live Map"
  useEffect(() => {
    if (locationEnabled && user && firestore) {
      const locRef = doc(firestore, 'driver_locations', user.uid);
      
      // Initial location (Accra)
      let lat = 5.6037;
      let lng = -0.1870;

      const interval = setInterval(() => {
        // Slowly move the truck
        lat += (Math.random() - 0.5) * 0.001;
        lng += (Math.random() - 0.5) * 0.001;

        setDocumentNonBlocking(locRef, {
          id: user.uid,
          latitude: lat,
          longitude: lng,
          heading: Math.random() * 360,
          speed: Math.floor(Math.random() * 60) + 20,
          isOnline: true,
          lastUpdated: new Date().toISOString(),
          alertStatus: 'none'
        }, { merge: true });
      }, 5000);

      return () => {
        clearInterval(interval);
        // Mark offline when unmounting
        setDocumentNonBlocking(locRef, { isOnline: false, lastUpdated: new Date().toISOString() }, { merge: true });
      };
    }
  }, [locationEnabled, user, firestore]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-primary flex flex-col items-center justify-center text-white z-[9999]">
        <TruckIcon className="size-16 mb-4 animate-bounce" />
        <h1 className="text-3xl font-headline tracking-tighter">FleetCommand</h1>
        <div className="absolute bottom-12 w-32 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-accent animate-[typewriter_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
    );
  }

  if (!locationEnabled) {
    return (
      <div className="p-6 h-[100dvh] flex flex-col items-center justify-center text-center space-y-8 bg-white">
        <div className="relative">
          <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping scale-150" />
          <div className="relative size-24 rounded-full bg-amber-500 flex items-center justify-center">
            <MapPin className="size-12 text-white" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-headline tracking-tighter mb-2">Location Required</h2>
          <p className="text-muted-foreground text-sm">
            FleetCommand requires your live location to track deliveries. You cannot use this app without location enabled.
          </p>
        </div>
        <Button 
          onClick={() => setLocationEnabled(true)}
          className="w-full h-14 bg-amber-500 hover:bg-amber-600 font-headline text-lg rounded-2xl shadow-lg active:scale-95 transition-transform"
        >
          Enable Tracking
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-4 px-4 space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-widest font-bold">Driver Console</p>
          <h1 className="text-xl font-headline tracking-tighter">{user?.displayName || 'John Driver'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500 text-[9px] animate-pulse-slow border-none shadow-sm">
            Live Ping
          </Badge>
          <button className="p-2 bg-white rounded-full shadow-sm border">
            <User className="size-5" />
          </button>
        </div>
      </header>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-lg font-headline tracking-tighter">Assigned Trip</h2>
          <span className="text-[10px] text-muted-foreground font-bold">ID: CC-9921</span>
        </div>
        <Card className="border-t-4 border-t-amber-500 shadow-xl overflow-hidden rounded-2xl border-none bg-white">
          <CardContent className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Current Asset</p>
                <Badge variant="outline" className="font-mono text-lg border-primary text-primary px-3 py-1">G-2883-24</Badge>
              </div>
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">In Transit</Badge>
            </div>

            <div className="flex items-center gap-4 py-4">
              <div className="flex flex-col items-center gap-1">
                <div className="size-3 rounded-full bg-primary" />
                <div className="w-[1.5px] h-12 border-l-2 border-dashed border-primary/30" />
                <div className="size-3 rounded-full border-2 border-primary" />
              </div>
              <div className="flex flex-col justify-between h-20 flex-1">
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Origin</p>
                  <p className="font-headline text-base leading-tight">Accra Logistics Hub</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Destination</p>
                  <p className="font-headline text-base leading-tight">Kumasi Terminal</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button className="w-full h-14 bg-primary hover:bg-primary/90 font-headline text-lg rounded-xl shadow-lg active:scale-95 transition-transform">
                COMPLETE DELIVERY
              </Button>
              <Button variant="outline" className="w-full h-12 font-headline border-primary text-primary rounded-xl flex gap-2 active:scale-95 transition-transform">
                <Navigation className="size-4" /> Open Navigator
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button className="bg-white p-6 rounded-2xl shadow-sm border border-muted flex flex-col items-center gap-2 active:scale-90 transition-transform">
          <div className="size-12 rounded-full bg-accent/20 flex items-center justify-center text-accent">
            <Camera className="size-6" />
          </div>
          <p className="font-headline text-xs">Proof</p>
        </button>
        <button className="bg-white p-6 rounded-2xl shadow-sm border border-muted flex flex-col items-center gap-2 active:scale-90 transition-transform">
          <div className="size-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
            <AlertTriangle className="size-6" />
          </div>
          <p className="font-headline text-xs">Breakdown</p>
        </button>
      </div>
    </div>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className}
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-5l-4-4h-3v10h2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}
