
"use client";

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Camera, AlertTriangle, User, DollarSign, Gauge, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export function DriverView() {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mileage, setMileage] = useState(12450);
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Real-time location & mileage simulation
  useEffect(() => {
    if (locationEnabled && user && firestore) {
      const locRef = doc(firestore, 'driver_locations', user.uid);
      let lat = 5.6037;
      let lng = -0.1870;

      const interval = setInterval(() => {
        lat += (Math.random() - 0.5) * 0.001;
        lng += (Math.random() - 0.5) * 0.001;
        setMileage(prev => prev + 0.1);

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
        setDocumentNonBlocking(locRef, { isOnline: false, lastUpdated: new Date().toISOString() }, { merge: true });
      };
    }
  }, [locationEnabled, user, firestore]);

  const handleReportExpense = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user) return;
    const formData = new FormData(e.currentTarget);
    const expenseData = {
      category: formData.get('category') as string,
      amount: Number(formData.get('amount')),
      notes: formData.get('notes') as string,
      isApproved: false,
      createdAt: new Date().toISOString(),
      reporterUserId: user.uid
    };
    addDocumentNonBlocking(collection(firestore, 'expenses'), expenseData);
    toast({ title: "Expense Reported", description: "Sent to accounting for approval." });
    (e.target as HTMLFormElement).reset();
  };

  const handleUploadProof = () => {
    toast({ title: "Proof Captured", description: "Photo proof of delivery has been logged." });
  };

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
          <p className="text-muted-foreground text-sm">FleetCommand requires your live location to track deliveries.</p>
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
    <div className="pb-24 pt-4 px-4 space-y-6 animate-in fade-in duration-500 max-w-md mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-widest font-bold">Active Mission</p>
          <h1 className="text-xl font-headline tracking-tighter">{user?.displayName || 'Driver Console'}</h1>
        </div>
        <Badge className="bg-emerald-500 text-[9px] animate-pulse-slow">Live Ping</Badge>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-none bg-primary text-white shadow-lg rounded-2xl">
          <CardContent className="p-4 flex flex-col gap-1">
            <Gauge className="size-4 text-accent mb-1" />
            <p className="text-[10px] opacity-70 uppercase font-bold">Today's Mileage</p>
            <p className="text-xl font-headline">{mileage.toFixed(1)} <span className="text-xs">KM</span></p>
          </CardContent>
        </Card>
        <Card className="border-none bg-white shadow-lg rounded-2xl">
          <CardContent className="p-4 flex flex-col gap-1">
            <DollarSign className="size-4 text-emerald-500 mb-1" />
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Earnings</p>
            <p className="text-xl font-headline text-primary">$420.00</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-t-4 border-t-primary shadow-xl rounded-2xl border-none bg-white">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-headline uppercase tracking-tighter">Current Assignment</CardTitle>
            <Badge variant="outline" className="font-mono text-[10px]">G-2883-24</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 py-2">
            <div className="flex flex-col items-center gap-1">
              <div className="size-2.5 rounded-full bg-primary" />
              <div className="w-[1px] h-10 border-l border-dashed border-primary/40" />
              <div className="size-2.5 rounded-full border border-primary" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-[8px] text-muted-foreground uppercase font-bold">Origin</p>
                <p className="font-headline text-sm">Accra Logistics Hub</p>
              </div>
              <div>
                <p className="text-[8px] text-muted-foreground uppercase font-bold">Destination</p>
                <p className="font-headline text-sm text-primary">Kumasi Terminal</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Button className="w-full h-14 bg-primary hover:bg-primary/90 font-headline text-lg rounded-xl shadow-lg">
              COMPLETE DELIVERY
            </Button>
            <Button variant="outline" className="w-full h-12 font-headline border-primary text-primary rounded-xl flex gap-2">
              <Navigation className="size-4" /> Start Navigator
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <button className="bg-white p-4 rounded-2xl shadow-sm border border-muted flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <Camera className="size-5 text-accent" />
              <p className="text-[10px] font-bold">PROOF</p>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Upload Proof of Delivery</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="aspect-video bg-muted rounded-xl flex items-center justify-center border-2 border-dashed">
                <Camera className="size-8 text-muted-foreground" />
              </div>
              <Button onClick={handleUploadProof} className="w-full h-12">Submit Proof</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <button className="bg-white p-4 rounded-2xl shadow-sm border border-muted flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <DollarSign className="size-5 text-emerald-500" />
              <p className="text-[10px] font-bold">EXPENSE</p>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Report Trip Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReportExpense} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input name="category" placeholder="Fuel, Toll, etc." required />
              </div>
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input name="amount" type="number" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input name="notes" placeholder="Optional details" />
              </div>
              <Button type="submit" className="w-full h-12">Log Expense</Button>
            </form>
          </DialogContent>
        </Dialog>

        <button className="bg-white p-4 rounded-2xl shadow-sm border border-muted flex flex-col items-center gap-1 active:scale-90 transition-transform">
          <AlertTriangle className="size-5 text-rose-500" />
          <p className="text-[10px] font-bold">ISSUE</p>
        </button>
      </div>
    </div>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-5l-4-4h-3v10h2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}
