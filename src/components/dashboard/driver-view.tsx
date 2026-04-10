"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { SupabaseService } from '@/services/supabase-service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Camera, AlertTriangle, Coins, DollarSign, Gauge, CheckCircle2, Languages, Wrench, Phone, Truck as TruckIcon, ClipboardList, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import { useLanguage } from '@/hooks/use-language';
import { LocationPermissionPrompt } from '@/components/location-permission-prompt';
import { useGeolocation } from '@/hooks/use-geolocation';
import { DriverLocationMap } from '@/components/driver-location-map';
import { SilentLocationTracker } from '@/components/silent-location-tracker';

export function DriverView() {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mileage, setMileage] = useState(0);
  const { user } = useSupabase();
  const { format, toggleCurrency } = useCurrency();
  const { lang, toggleLanguage, t } = useLanguage();

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Demo data for driver functionality
  const [activeTrips, setActiveTrips] = useState([]);
  const [myTrips, setMyTrips] = useState([]);
  const [myAllowances, setMyAllowances] = useState([]);

  useEffect(() => {
    const loadDriverData = async () => {
      if (!user) return;
      
      try {
        // Load real trips assigned to this driver
        const { data: driverTrips } = await supabase
          .from('trips')
          .select('*')
          .eq('driver_id', user.id)
          .order('created_at', { ascending: false });
        
        // Load real photos for this driver
        const { data: driverPhotos } = await supabase
          .from('driver_photos')
          .select('*')
          .eq('driver_id', user.id)
          .order('created_at', { ascending: false });
        
        setUploadedPhotos(driverPhotos || []);
        
        // Load real allowances for this driver
        const { data: driverAllowances } = await supabase
          .from('driver_allowances')
          .select('*')
          .eq('driver_id', user.id)
          .order('created_at', { ascending: false });
        
        // Separate active and completed trips (include PENDING status)
        const active = driverTrips?.filter(trip => 
          trip.status === 'PENDING' || 
          trip.status === 'IN_PROGRESS' || 
          trip.status === 'in_transit' || 
          trip.status === 'loading'
        ) || [];
        const completed = driverTrips?.filter(trip => 
          trip.status === 'COMPLETED' || 
          trip.status === 'completed' || 
          trip.status === 'delivered'
        ) || [];
        
        setActiveTrips(active);
        setMyTrips(completed);
        setMyAllowances(driverAllowances || []);
        
        // Auto-generate allowance for new trips
        if (driverTrips && driverAllowances) {
          for (const trip of driverTrips) {
            const hasAllowance = driverAllowances.some(allowance => 
              allowance.trip_id === trip.id
            );
            
            if (!hasAllowance && (trip.status === 'PENDING' || trip.status === 'IN_PROGRESS' || trip.status === 'in_transit' || trip.status === 'loading')) {
              // Calculate allowance based on trip distance/duration
              const allowanceAmount = calculateAllowance(trip);
              
              await supabase.from('driver_allowances').insert({
                driver_id: user.id,
                trip_id: trip.id,
                amount: allowanceAmount,
                status: 'approved',
                created_at: new Date().toISOString(),
                reason: `Trip allowance: ${trip.origin} → ${trip.destination}`
              });
            }
          }
          
          // Refresh allowances after adding new ones
          const { data: refreshedAllowances } = await supabase
            .from('driver_allowances')
            .select('*')
            .eq('driver_id', user.id);
          setMyAllowances(refreshedAllowances || []);
        }
        
      } catch (error) {
        console.error('Error loading driver data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDriverData();
  }, [user]);

  // Calculate allowance based on trip details
  const calculateAllowance = (trip: any) => {
    // Base allowance calculation
    let baseAmount = 500; // Base amount for any trip
    
    // Distance-based allowance
    if (trip.distance) {
      const distance = parseInt(trip.distance.toString().replace(/[^0-9]/g, ''));
      baseAmount += Math.floor(distance * 0.5); // 0.5 per km
    }
    
    // Time-based allowance
    if (trip.estimated_time) {
      const hours = parseInt(trip.estimated_time.toString().replace(/[^0-9]/g, ''));
      baseAmount += hours * 100; // 100 per hour
    }
    
    // Cargo type adjustments
    if (trip.cargo) {
      const cargoType = trip.cargo.toLowerCase();
      if (cargoType.includes('perishable')) baseAmount += 200;
      if (cargoType.includes('hazardous') || cargoType.includes('dangerous')) baseAmount += 300;
      if (cargoType.includes('heavy') || cargoType.includes('machinery')) baseAmount += 150;
    }
    
    return baseAmount;
  };

  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const { startTracking, isTracking } = useGeolocation({ enabled: locationEnabled, interval: 30000 });

  // Show location prompt on mount
  useEffect(() => {
    if (user && showLocationPrompt) {
      // Check if location permission already granted
      navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          setLocationEnabled(true);
          startTracking();
        }
      });
    }
  }, [user, showLocationPrompt, startTracking]);

  const activeTrip = activeTrips?.[0];

  // Handle location granted
  const handleLocationGranted = () => {
    setLocationEnabled(true);
    setShowLocationPrompt(false);
    startTracking();
    toast({
      title: "Location Enabled",
      description: "Your location is now being tracked for route monitoring.",
    });
  };

  // Handle location denied
  const handleLocationDenied = () => {
    setLocationEnabled(false);
    setShowLocationPrompt(false);
    toast({
      title: "Location Required",
      description: "Location access is required for full functionality.",
      variant: "destructive",
    });
  };

  const myTripsSorted = useMemo(() => {
    if (!myTrips?.length) return [];
    return [...myTrips].sort((a, b) => {
      const ta = (a.created_at as string) || '';
      const tb = (b.created_at as string) || '';
      return tb.localeCompare(ta);
    });
  }, [myTrips]);

  const allowanceTotal = useMemo(
    () => myAllowances?.reduce((sum, a) => sum + (Number(a.amount) || 0), 0) ?? 0,
    [myAllowances]
  );

  const tripStatusStyle = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-500/15 text-emerald-700 border-emerald-200';
      case 'in_transit':
        return 'bg-amber-500/15 text-amber-800 border-amber-200';
      case 'loaded':
        return 'bg-primary/15 text-primary border-primary/30';
      case 'cancelled':
        return 'bg-rose-500/15 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-500/10 text-slate-700 border-slate-200';
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const getCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings.',
      });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);

        // Stop the stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
    }
  };

  useEffect(() => {
    if (locationEnabled && user) {
      // NOTE: Location layout tracking runs visually but is disconnected from the DB because backend.json lacks a telemetry table.
      console.log('Location tracking active (Simulation only - no telemetry DB attached)');
    }
  }, [locationEnabled, user]);

  const handleReportExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    const formData = new FormData(e.currentTarget);
    try {
      await SupabaseService.createExpense({
        category: formData.get('category') as string,
        amount: Number(formData.get('amount')),
        notes: (formData.get('notes') as string) || '',
        description: formData.get('description') as string,
        photoUrl: capturedImage || undefined,
        status: 'pending',
        userName: user.name || 'Driver',
        driverId: user.id
      } as any);
      
      toast({ title: "Expense Reported", description: "Sent to accounting for approval." });
      setCapturedImage(null);
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Error reporting expense:', error);
      toast({ title: "Error", description: "Failed to report expense.", variant: "destructive" });
    }
  };

  const handleUploadProof = async () => {
    if (!user || !activeTrip || !capturedImage) return;

    try {
      // Convert base64 to blob for upload
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], `delivery-proof-${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      // Upload to Supabase Storage
      const fileName = `driver-${user.id}/trip-${activeTrip.id}/${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('driver-photos')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('driver-photos')
        .getPublicUrl(fileName);
      
      // Save photo record to database
      const { error: dbError } = await supabase.from('driver_photos').insert({
        driver_id: user.id,
        trip_id: activeTrip.id,
        photo_url: publicUrl,
        photo_type: 'delivery_proof',
        description: `Delivery proof for trip: ${activeTrip.origin} → ${activeTrip.destination}`,
        file_size: file.size,
        file_type: file.type
      });
      
      if (dbError) throw dbError;
      
      toast({ 
        title: "Photo Uploaded Successfully", 
        description: "Delivery proof has been saved to database." 
      });
      
      // Clear captured image and refresh photos
      setCapturedImage(null);
      
      // Refresh uploaded photos
      const { data: refreshedPhotos } = await supabase
        .from('driver_photos')
        .select('*')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });
      setUploadedPhotos(refreshedPhotos || []);
      
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast({ 
        title: "Upload Failed", 
        description: error.message || "Failed to upload photo to database.",
        variant: "destructive"
      });
    }
  };

  const handleUploadExpensePhoto = async () => {
    if (!user || !capturedImage) return;

    try {
      // Convert base64 to blob for upload
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], `expense-receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      // Upload to Supabase Storage
      const fileName = `driver-${user.id}/expenses/${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('driver-photos')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('driver-photos')
        .getPublicUrl(fileName);
      
      // Save photo record to database
      const { error: dbError } = await supabase.from('driver_photos').insert({
        driver_id: user.id,
        photo_url: publicUrl,
        photo_type: 'expense_receipt',
        description: 'Expense receipt photo',
        file_size: file.size,
        file_type: file.type
      });
      
      if (dbError) throw dbError;
      
      toast({ 
        title: "Receipt Uploaded", 
        description: "Expense receipt has been saved to database." 
      });
      
      // Clear captured image and refresh photos
      setCapturedImage(null);
      
      // Refresh uploaded photos
      const { data: refreshedPhotos } = await supabase
        .from('driver_photos')
        .select('*')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });
      setUploadedPhotos(refreshedPhotos || []);
      
    } catch (error: any) {
      console.error('Error uploading receipt:', error);
      toast({ 
        title: "Upload Failed", 
        description: error.message || "Failed to upload receipt to database.",
        variant: "destructive"
      });
    }
  };

  const handleReportIssue = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    const formData = new FormData(e.currentTarget);
    try {
      await SupabaseService.createMaintenanceRequest({
        truckId: activeTrip?.truckId || activeTrip?.fleetVehicleId || 'UNKNOWN_VEHICLE',
        issueDescription: formData.get('description') as string,
        severity: 'Medium',
        status: 'pending',
        reportedByUserId: user.id
      } as any);
      
      toast({ title: "Issue Reported", description: "Maintenance request submitted." });
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      console.error('Error reporting issue:', error);
      toast({ title: "Error", description: "Failed to report issue.", variant: "destructive" });
    }
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
        {/* Show location permission prompt first */}
        <LocationPermissionPrompt 
          onGranted={() => {
            setLocationEnabled(true);
          }}
          onDenied={() => {
            // Still allow access but location won't be tracked
            setLocationEnabled(true);
          }}
          required={false}
        />
        <div className="relative">
          <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping scale-150" />
          <div className="relative size-24 rounded-full bg-amber-500 flex items-center justify-center">
            <MapPin className="size-12 text-white" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-headline tracking-tighter mb-2">Location Services</h2>
          <p className="text-muted-foreground text-sm">Enable location for optimal delivery tracking.</p>
        </div>
        <Button
          onClick={() => setLocationEnabled(true)}
          className="w-full h-14 bg-amber-500 hover:bg-amber-600 font-headline text-lg rounded-2xl shadow-lg"
        >
          Continue to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-4 px-4 sm:px-6 lg:px-8 space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Silent location tracker - invisible to driver, runs continuously */}
      <SilentLocationTracker />
      
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-widest font-bold">{t.active_mission}</p>
          <h1 className="text-xl sm:text-2xl font-headline tracking-tighter">{user?.displayName || 'Driver Console'}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={toggleLanguage} className="rounded-full text-primary hover:bg-primary/10 gap-2">
            <Languages className="size-4" />
            <span className="text-[10px] font-bold uppercase">{lang === 'en' ? 'SW' : 'EN'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleCurrency} className="rounded-full text-primary hover:bg-primary/10">
            <Coins className="size-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-none bg-primary text-white shadow-lg rounded-2xl">
          <CardContent className="p-4 flex flex-col gap-1">
            <Gauge className="size-4 text-accent mb-1" />
            <p className="text-[10px] opacity-70 uppercase font-bold">{t.mileage}</p>
            <p className="text-xl font-headline">{mileage.toFixed(1)} <span className="text-xs">KM</span></p>
          </CardContent>
        </Card>
        <Card className="border-none bg-white shadow-lg rounded-2xl">
          <CardContent className="p-4 flex flex-col gap-1">
            <Wallet className="size-4 text-emerald-500 mb-1" />
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Trip Allowances</p>
            <p className="text-xl font-headline text-primary truncate">{format(allowanceTotal)}</p>
            <p className="text-[8px] text-muted-foreground">
              {myAllowances.length > 0 ? `${myAllowances.length} allowance${myAllowances.length > 1 ? 's' : ''}` : 'No allowances yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none bg-white shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
          <ClipboardList className="size-4 text-primary" />
          <CardTitle className="text-sm font-headline uppercase tracking-tighter">{t.assigned_work}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-[10px] text-muted-foreground mb-3">{t.assignments_hint}</p>
          {myTripsSorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t.no_assigned_trips}</p>
          ) : (
            <ScrollArea className="h-[min(280px,50vh)] pr-3">
              <ul className="space-y-2">
                {myTripsSorted.map((trip) => (
                  <li
                    key={trip.id}
                    className={`rounded-xl border p-3 text-left ${activeTrip?.id === trip.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-muted bg-muted/20'}`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[45%]">
                        {trip.fleetVehicleId || trip.id?.slice(0, 8) || '—'}
                      </span>
                      <Badge variant="outline" className={`text-[9px] capitalize shrink-0 ${tripStatusStyle(trip.status || 'created')}`}>
                        {(trip.status || 'created').replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs font-headline leading-tight">
                      {trip.originLocation || '—'} <span className="text-muted-foreground font-sans font-normal">→</span>{' '}
                      {trip.destinationLocation || '—'}
                    </p>
                    {trip.created_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(trip.created_at).toLocaleString()}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="border-none bg-white shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-emerald-600" />
            <CardTitle className="text-sm font-headline uppercase tracking-tighter">{t.your_allowances}</CardTitle>
          </div>
          <span className="text-xs font-bold text-primary">{format(allowanceTotal)}</span>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <p className="text-[10px] text-muted-foreground">{t.allowance_total}</p>
          {!myAllowances?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t.no_allowance_records}</p>
          ) : (
            <ScrollArea className="h-[min(200px,35vh)] pr-3">
              <ul className="space-y-2">
                {myAllowances
                  .slice()
                  .sort((a, b) => ((b.created_at as string) || '').localeCompare((a.created_at as string) || ''))
                  .map((a) => (
                    <li key={a.id} className="flex justify-between items-center rounded-xl border border-muted bg-muted/10 px-3 py-2 text-sm">
                      <span className="text-muted-foreground text-xs">
                        {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                      </span>
                      <span className="font-headline text-primary">{format(Number(a.amount) || 0)}</span>
                    </li>
                  ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="border-t-4 border-t-primary shadow-xl rounded-2xl border-none bg-white">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-headline uppercase tracking-tighter">Current Assignment</CardTitle>
            <Badge variant="outline" className="font-mono text-[10px]">
              {activeTrip?.fleetVehicleId || activeTrip?.id?.slice(0, 10) || '—'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {activeTrip ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 py-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="size-2.5 rounded-full bg-primary" />
                  <div className="w-[1px] h-10 border-l border-dashed border-primary/40" />
                  <div className="size-2.5 rounded-full border border-primary" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-[8px] text-muted-foreground uppercase font-bold">Origin</p>
                    <p className="font-headline text-sm">{activeTrip.originLocation}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-muted-foreground uppercase font-bold">Destination</p>
                    <p className="font-headline text-sm text-primary">{activeTrip.destinationLocation}</p>
                  </div>
                </div>
              </div>

              {activeTrip.agentContactNumber && (
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-primary/60">{t.agent_contact}</p>
                    <p className="text-sm font-bold text-primary">{activeTrip.agentContactNumber}</p>
                  </div>
                  <a href={`tel:${activeTrip.agentContactNumber}`} className="size-10 rounded-full bg-primary text-white flex items-center justify-center active:scale-90 transition-transform">
                    <Phone className="size-5" />
                  </a>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full h-14 bg-primary hover:bg-primary/90 font-headline text-lg rounded-xl shadow-lg">
                      {t.complete_delivery.toUpperCase()}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>{t.capture}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <video ref={videoRef} className="w-full aspect-video rounded-xl bg-black object-cover" autoPlay playsInline muted />
                      <canvas ref={canvasRef} className="hidden" />

                      {capturedImage && (
                        <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-emerald-500">
                          <img src={capturedImage} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="size-12 text-white" />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button onClick={getCameraPermission} variant="outline" className="flex-1">
                          Enable Camera
                        </Button>
                        <Button onClick={capturePhoto} className="flex-1 bg-accent hover:bg-accent/90" disabled={!hasCameraPermission}>
                          {t.take_photo}
                        </Button>
                      </div>

                      <Button onClick={handleUploadProof} className="w-full h-12 font-headline" disabled={!capturedImage}>
                        SUBMIT EVIDENCE
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" className="w-full h-12 font-headline border-primary text-primary rounded-xl flex gap-2">
                  <Navigation className="size-4" /> {t.start_nav}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-4">
              <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
              <p className="text-sm text-muted-foreground">Waiting for new dispatch.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <button className="bg-white p-4 rounded-2xl shadow-sm border border-muted flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <Camera className="size-5 text-blue-500" />
              <p className="text-[10px] font-bold">PHOTOS</p>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle>My Photos</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4 max-h-64 overflow-y-auto">
              {uploadedPhotos.length === 0 ? (
                <div className="text-center py-8">
                  <Camera className="size-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No photos uploaded yet</p>
                  <p className="text-xs text-muted-foreground mt-2">Take photos using the camera buttons</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {uploadedPhotos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img 
                        src={photo.photo_url} 
                        alt={photo.description}
                        className="w-full aspect-square object-cover rounded-lg border"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <div className="text-white text-center p-2">
                          <p className="text-xs font-medium">{photo.photo_type.replace('_', ' ')}</p>
                          <p className="text-xs">{new Date(photo.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-sm">Total Photos:</p>
                  <p className="font-bold text-lg text-blue-600">{uploadedPhotos.length}</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild disabled={!activeTrip}>
            <button className="bg-white p-4 rounded-2xl shadow-sm border border-muted flex flex-col items-center gap-1 active:scale-90 transition-transform disabled:opacity-50">
              <Camera className="size-5 text-accent" />
              <p className="text-[10px] font-bold">{t.proof.toUpperCase()}</p>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle>{t.capture}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <video ref={videoRef} className="w-full aspect-video rounded-xl bg-black object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              {capturedImage && <img src={capturedImage} className="w-full aspect-video rounded-xl object-cover" />}
              <div className="flex gap-2">
                <Button onClick={getCameraPermission} variant="outline" className="flex-1">Camera</Button>
                <Button onClick={capturePhoto} className="flex-1">{t.take_photo}</Button>
              </div>
              <Button onClick={handleUploadProof} className="w-full h-12" disabled={!capturedImage}>Submit</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <button className="bg-white p-4 rounded-2xl shadow-sm border border-muted flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <Wallet className="size-5 text-emerald-500" />
              <p className="text-[10px] font-bold">ALLOWANCES</p>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle>My Trip Allowances</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4 max-h-64 overflow-y-auto">
              {myAllowances.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="size-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No allowances yet</p>
                  <p className="text-xs text-muted-foreground mt-2">Allowances are automatically generated when trips are assigned</p>
                </div>
              ) : (
                myAllowances.map((allowance) => (
                  <div key={allowance.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{allowance.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(allowance.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">{format(allowance.amount)}</p>
                      <Badge variant="secondary" className="text-xs">
                        {allowance.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
              
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <p className="font-bold">Total Allowances:</p>
                  <p className="font-bold text-xl text-emerald-600">{format(allowanceTotal)}</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <button className="bg-white p-4 rounded-2xl shadow-sm border border-muted flex flex-col items-center gap-1 active:scale-90 transition-transform">
              <AlertTriangle className="size-5 text-rose-500" />
              <p className="text-[10px] font-bold">{t.issue.toUpperCase()}</p>
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

              <div className="space-y-2">
                <Label>Evidence Photo</Label>
                <div className="grid grid-cols-1 gap-2">
                  <video ref={videoRef} className="w-full aspect-video rounded-xl bg-black object-cover" autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2">
                    <Button type="button" onClick={getCameraPermission} variant="outline" size="sm" className="flex-1">Camera On</Button>
                    <Button type="button" onClick={capturePhoto} variant="secondary" size="sm" className="flex-1">Snap</Button>
                  </div>
                  {capturedImage && <img src={capturedImage} className="w-full aspect-video rounded-xl object-cover border" />}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.issue_description}</Label>
                <Textarea name="description" placeholder="Describe the issue..." required />
              </div>

              <Button type="submit" variant="destructive" className="w-full h-12 font-headline">
                <AlertTriangle className="size-4 mr-2" />
                {t.submit_report.toUpperCase()}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
