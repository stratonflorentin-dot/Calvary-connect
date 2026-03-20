
"use client";

import { useEffect, useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Camera, AlertTriangle, Coins, DollarSign, Gauge, CheckCircle2, Languages, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, setDocumentNonBlocking, addDocumentNonBlocking, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import { useLanguage } from '@/hooks/use-language';

export function DriverView() {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mileage, setMileage] = useState(12450);
  const { user } = useUser();
  const firestore = useFirestore();
  const { format, toggleCurrency } = useCurrency();
  const { lang, toggleLanguage, t } = useLanguage();

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Query for the driver's active trip
  const activeTripQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'trips'),
      where('driverId', '==', user.uid),
      where('status', 'in', ['created', 'loaded', 'in_transit']),
      limit(1)
    );
  }, [firestore, user]);

  const { data: activeTrips } = useCollection(activeTripQuery);
  const activeTrip = activeTrips?.[0];

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
          // We don't overwrite alertStatus here to keep breakdown alerts active
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
      reporterUserId: user.uid,
      photoUrl: capturedImage || `https://picsum.photos/seed/${Math.random()}/600/400`,
      tripId: activeTrip?.id || null
    };
    addDocumentNonBlocking(collection(firestore, 'expenses'), expenseData);
    toast({ title: "Expense Reported", description: "Sent to accounting for approval." });
    setCapturedImage(null);
    (e.target as HTMLFormElement).reset();
  };

  const handleUploadProof = () => {
    if (!firestore || !user || !activeTrip) return;

    const proofData = {
      tripId: activeTrip.id,
      driverId: user.uid,
      photoUrl: capturedImage || `https://picsum.photos/seed/${activeTrip.id}/600/400`,
      uploadedAt: new Date().toISOString(),
      caption: "Delivery successful at destination."
    };

    addDocumentNonBlocking(collection(firestore, 'trips', activeTrip.id, 'delivery_proofs'), proofData);
    const tripRef = doc(firestore, 'trips', activeTrip.id);
    setDocumentNonBlocking(tripRef, { status: 'delivered', deliveredAt: new Date().toISOString() }, { merge: true });

    toast({ title: "Delivery Complete", description: "Proof captured and trip marked as delivered." });
    setCapturedImage(null);
  };

  const handleReportIssue = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user) return;
    const formData = new FormData(e.currentTarget);
    const type = formData.get('issueType') as string;
    const description = formData.get('description') as string;
    const severity = formData.get('severity') as string;

    const maintenanceData = {
      fleetVehicleId: activeTrip?.fleetVehicleId || 'unknown',
      reporterUserId: user.uid,
      issueDescription: description,
      severity: severity,
      status: 'pending',
      reportedAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(collection(firestore, 'maintenance_requests'), maintenanceData);

    // If it's a breakdown, update live location status for map alerts
    if (type === 'breakdown') {
      const locRef = doc(firestore, 'driver_locations', user.uid);
      updateDocumentNonBlocking(locRef, { alertStatus: 'breakdown' });
    }

    toast({ 
      title: "Issue Reported", 
      description: type === 'breakdown' ? "Emergency breakdown signal sent to command center." : "Maintenance request submitted to garage." 
    });
    
    (e.target as HTMLFormElement).reset();
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
          className="w-full h-14 bg-amber-500 hover:bg-amber-600 font-headline text-lg rounded-2xl shadow-lg"
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
          <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-widest font-bold">{t.active_mission}</p>
          <h1 className="text-xl font-headline tracking-tighter">{user?.displayName || 'Driver Console'}</h1>
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

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-none bg-primary text-white shadow-lg rounded-2xl">
          <CardContent className="p-4 flex flex-col gap-1">
            <Gauge className="size-4 text-accent mb-1" />
            <p className="text-[10px] opacity-70 uppercase font-bold">{t.mileage}</p>
            <p className="text-xl font-headline">{mileage.toFixed(1)} <span className="text-xs">KM</span></p>
          </CardContent>
        </Card>
        <Card className="border-none bg-white shadow-lg rounded-2xl">
          <CardContent className="p-4 flex flex-col gap-1">
            <DollarSign className="size-4 text-emerald-500 mb-1" />
            <p className="text-[10px] text-muted-foreground uppercase font-bold">{t.earnings}</p>
            <p className="text-xl font-headline text-primary truncate">{format(420)}</p>
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
              <DollarSign className="size-5 text-emerald-500" />
              <p className="text-[10px] font-bold">{t.expense.toUpperCase()}</p>
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

              <Button type="submit" className="w-full h-12">Log Expense</Button>
            </form>
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
              <DialogTitle>{t.issue}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReportIssue} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>{t.severity}</Label>
                <Select name="severity" defaultValue="Medium" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low (Informational)</SelectItem>
                    <SelectItem value="Medium">Medium (Attention Required)</SelectItem>
                    <SelectItem value="Critical">Critical (Stop Vehicle)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Issue Type</Label>
                <Select name="issueType" defaultValue="maintenance" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">{t.report_maintenance}</SelectItem>
                    <SelectItem value="breakdown">{t.report_breakdown}</SelectItem>
                  </SelectContent>
                </Select>
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
