
"use client";

import { useState } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Route, Plus, MapPin, Truck as TruckIcon, User, ChevronDown, ChevronUp, Image as ImageIcon, Camera, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TripsPage() {
  const { role } = useRole();
  const firestore = useFirestore();
  const { user } = useUser();
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  
  const tripsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !role) return null;
    return query(collection(firestore, 'trips'), orderBy('createdAt', 'desc'));
  }, [firestore, user, role]);

  const fleetQuery = useMemoFirebase(() => {
    if (!firestore || !user || !role) return null;
    return collection(firestore, 'fleet_vehicles');
  }, [firestore, user, role]);

  const driversQuery = useMemoFirebase(() => {
    if (!firestore || !user || !role) return null;
    return collection(firestore, 'roles_driver');
  }, [firestore, user, role]);

  const { data: trips, isLoading } = useCollection(tripsQuery);
  const { data: fleet } = useCollection(fleetQuery);
  const { data: drivers } = useCollection(driversQuery);

  const handleCreateTrip = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;
    const formData = new FormData(e.currentTarget);
    const driverId = formData.get('driverId') as string;
    const vehicleId = formData.get('vehicleId') as string;
    
    const tripData = {
      originLocation: formData.get('origin') as string,
      destinationLocation: formData.get('destination') as string,
      driverId,
      fleetVehicleId: vehicleId,
      agentContactNumber: formData.get('agentContact') as string,
      status: 'created',
      createdAt: new Date().toISOString(),
      notes: formData.get('notes') as string,
    };

    addDocumentNonBlocking(collection(firestore, 'trips'), tripData);

    const vehicleRef = doc(firestore, 'fleet_vehicles', vehicleId);
    updateDocumentNonBlocking(vehicleRef, { status: 'In Use' });

    const notificationRef = collection(firestore, 'users', driverId, 'notifications');
    addDocumentNonBlocking(notificationRef, {
      title: 'New Trip Assigned',
      message: `You have been assigned a new trip from ${tripData.originLocation} to ${tripData.destinationLocation}. Contact Agent: ${tripData.agentContactNumber}`,
      type: 'trip_assigned',
      severity: 'info',
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    e.currentTarget.reset();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-emerald-500';
      case 'in_transit': return 'bg-amber-500 animate-pulse-slow';
      case 'loaded': return 'bg-primary';
      case 'cancelled': return 'bg-rose-500';
      default: return 'bg-slate-400';
    }
  };

  if (role && !['CEO', 'OPERATIONS'].includes(role)) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Trips & Dispatch</h1>
            <p className="text-muted-foreground text-sm">Schedule and track logistics deliveries.</p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2 shadow-lg hover:scale-105 transition-transform">
                <Plus className="size-4" /> New Trip
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-headline text-2xl">Dispatch New Trip</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTrip} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="origin">Origin</Label>
                    <Input id="origin" name="origin" placeholder="Accra Hub" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination">Destination</Label>
                    <Input id="destination" name="destination" placeholder="Kumasi Terminal" required />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Assigned Driver</Label>
                  <Select name="driverId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select active driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers?.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assigned Vehicle</Label>
                  <Select name="vehicleId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select available truck" />
                    </SelectTrigger>
                    <SelectContent>
                      {fleet?.filter(v => v.status === 'Available').map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name} ({v.plateNumber})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agentContact">Agent's Contact Number</Label>
                  <Input id="agentContact" name="agentContact" placeholder="+255 700 000 000" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Delivery Notes</Label>
                  <Input id="notes" name="notes" placeholder="Special instructions..." />
                </div>

                <Button type="submit" className="w-full h-12 text-lg font-headline">Create & Dispatch</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block bg-card rounded-2xl shadow-sm border p-0 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-6">Trip ID</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Driver / Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-6">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading trips...</TableCell></TableRow>
              ) : trips?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">No trips dispatched yet.</TableCell></TableRow>
              ) : trips?.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4 font-mono text-xs text-primary">{t.id.slice(0, 8)}</td>
                  <td>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{t.originLocation}</span>
                      <span className="text-[10px] text-muted-foreground">to</span>
                      <span className="text-sm font-medium">{t.destinationLocation}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 text-xs">
                        <User className="size-3 text-muted-foreground" />
                        {drivers?.find(d => d.id === t.driverId)?.name || 'Unknown'}
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <TruckIcon className="size-3 text-muted-foreground" />
                        {fleet?.find(v => v.id === t.fleetVehicleId)?.plateNumber || 'Unknown'}
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge className={cn("text-[10px] font-bold", getStatusColor(t.status))}>
                      {t.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="text-right px-6">
                    <TripEvidenceDialog tripId={t.id} status={t.status} />
                  </td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Feed-style View */}
        <div className="md:hidden space-y-4">
          {trips?.map((t) => (
            <Card key={t.id} className="relative overflow-hidden border-none shadow-md bg-white">
              <div className={cn("absolute top-0 left-0 right-0 h-[4px]", getStatusColor(t.status))} />
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase">Trip #{t.id.slice(0, 8)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-headline text-base">{t.originLocation}</span>
                      <Route className="size-4 text-primary" />
                      <span className="font-headline text-base">{t.destinationLocation}</span>
                    </div>
                  </div>
                  <Badge className={cn("text-[9px]", getStatusColor(t.status))}>
                    {t.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <User className="size-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{drivers?.find(d => d.id === t.driverId)?.name || 'Unknown'}</span>
                      <span className="text-[10px] text-muted-foreground">{fleet?.find(v => v.id === t.fleetVehicleId)?.plateNumber}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <TripEvidenceDialog tripId={t.id} status={t.status} />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full"
                      onClick={() => setExpandedTripId(expandedTripId === t.id ? null : t.id)}
                    >
                      {expandedTripId === t.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </Button>
                  </div>
                </div>

                {expandedTripId === t.id && (
                  <div className="mt-4 pt-4 border-t space-y-3 animate-in slide-in-from-top duration-300">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Support Contact</p>
                      <a href={`tel:${t.agentContactNumber}`} className="text-xs text-primary font-bold flex items-center gap-2">
                        <Phone className="size-3" /> {t.agentContactNumber}
                      </a>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Dispatcher Notes</p>
                      <p className="text-xs">{t.notes || 'No specific notes provided.'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="text-[10px] h-8">View Logs</Button>
                      <Button variant="destructive" size="sm" className="text-[10px] h-8">Cancel Trip</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

function TripEvidenceDialog({ tripId, status }: { tripId: string, status: string }) {
  const firestore = useFirestore();
  const proofQuery = useMemoFirebase(() => {
    if (!firestore || status !== 'delivered') return null;
    return collection(firestore, 'trips', tripId, 'delivery_proofs');
  }, [firestore, tripId, status]);

  const { data: proofs } = useCollection(proofQuery);

  if (status !== 'delivered') return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10">
          <Camera className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Delivery Proof - Trip #{tripId.slice(0, 8)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          {proofs && proofs.length > 0 ? (
            proofs.map((proof, idx) => (
              <div key={idx} className="space-y-4">
                <div className="aspect-video rounded-xl overflow-hidden bg-muted border">
                  <img src={proof.photoUrl} alt="Delivery proof" className="w-full h-full object-cover" />
                </div>
                <div className="flex justify-between items-center text-xs">
                  <p className="font-bold text-emerald-600 flex items-center gap-2">
                    <CheckCircle2 className="size-3" /> Successfully Delivered
                  </p>
                  <p className="text-muted-foreground">{new Date(proof.uploadedAt).toLocaleString()}</p>
                </div>
                <p className="text-sm bg-muted/50 p-4 rounded-xl border italic">"{proof.caption}"</p>
              </div>
            ))
          ) : (
            <div className="py-12 text-center space-y-4">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <ImageIcon className="size-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No photos uploaded for this trip yet.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
