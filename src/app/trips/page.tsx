"use client";

import { useState } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Route, Plus, MapPin, Truck as TruckIcon, User } from 'lucide-react';

export default function TripsPage() {
  const { role } = useRole();
  const firestore = useFirestore();
  
  const tripsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'trips'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const fleetQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'fleet_vehicles');
  }, [firestore]);

  const driversQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'roles_driver');
  }, [firestore]);

  const { data: trips, isLoading } = useCollection(tripsQuery);
  const { data: fleet } = useCollection(fleetQuery);
  const { data: drivers } = useCollection(driversQuery);

  const handleCreateTrip = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tripData = {
      originLocation: formData.get('origin') as string,
      destinationLocation: formData.get('destination') as string,
      driverId: formData.get('driverId') as string,
      fleetVehicleId: formData.get('vehicleId') as string,
      status: 'created',
      createdAt: new Date().toISOString(),
      notes: formData.get('notes') as string,
    };

    addDocumentNonBlocking(collection(firestore, 'trips'), tripData);
    e.currentTarget.reset();
  };

  if (!['CEO', 'OPERATIONS'].includes(role || '')) return <div className="p-8">Access Denied</div>;

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
              <Button className="rounded-full gap-2">
                <Plus className="size-4" /> New Trip
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Dispatch New Trip</DialogTitle>
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
                      <SelectValue placeholder="Select driver" />
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
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {fleet?.filter(v => v.status === 'Available').map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name} ({v.plateNumber})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" name="notes" placeholder="Delivery instructions..." />
                </div>

                <Button type="submit" className="w-full">Create & Dispatch</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-0 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-6">Trip ID</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Driver / Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-6">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading trips...</TableCell></TableRow>
              ) : trips?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">No trips dispatched yet.</TableCell></TableRow>
              ) : trips?.map((t) => (
                <TableRow key={t.id}>
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
                    <Badge className={
                      t.status === 'delivered' ? 'bg-emerald-500' :
                      t.status === 'in_transit' ? 'bg-amber-500' :
                      t.status === 'cancelled' ? 'bg-rose-500' : 'bg-primary'
                    }>
                      {t.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="text-right px-6 text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
