"use client";

import { useState } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Truck, Plus, Settings } from 'lucide-react';

export default function FleetPage() {
  const { role } = useRole();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const fleetQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'fleet_vehicles');
  }, [firestore, user]);

  const { data: fleet, isLoading } = useCollection(fleetQuery);

  const handleAddVehicle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;
    const formData = new FormData(e.currentTarget);
    const vehicleData = {
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      plateNumber: formData.get('plate') as string,
      condition: 'Good',
      status: 'Available',
      createdAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(collection(firestore, 'fleet_vehicles'), vehicleData);
    e.currentTarget.reset();
  };

  if (!['CEO', 'OPERATIONS'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Fleet Management</h1>
            <p className="text-muted-foreground text-sm">Monitor and expand your logistics assets.</p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2">
                <Plus className="size-4" /> Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Fleet Vehicle</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddVehicle} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Vehicle Name / Model</Label>
                  <Input id="name" name="name" placeholder="Mercedes Axor 2540" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Vehicle Type</Label>
                  <Input id="type" name="type" placeholder="Heavy Duty Truck" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plate">Plate Number</Label>
                  <Input id="plate" name="plate" placeholder="G-2883-24" required />
                </div>
                <Button type="submit" className="w-full">Register Vehicle</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-0 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-6">Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading fleet...</TableCell></TableRow>
              ) : fleet?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">No vehicles registered.</TableCell></TableRow>
              ) : fleet?.map((v) => (
                <TableRow key={v.id}>
                  <td className="px-6 py-4 font-medium flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Truck className="size-5" />
                    </div>
                    {v.name}
                  </td>
                  <td>{v.type}</td>
                  <td className="font-mono text-sm">{v.plateNumber}</td>
                  <td>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                      {v.condition}
                    </Badge>
                  </td>
                  <td>
                    <Badge className={v.status === 'Available' ? 'bg-emerald-500' : 'bg-amber-500'}>
                      {v.status}
                    </Badge>
                  </td>
                  <td className="text-right px-6">
                    <Button variant="ghost" size="icon"><Settings className="size-4" /></Button>
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
