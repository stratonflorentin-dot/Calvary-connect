
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase, DEMO_MODE } from '@/lib/supabase';
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
  const { user } = useSupabase();
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [fleet, setFleet] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        console.log('No user found, skipping data load');
        setIsLoading(false);
        return;
      }
      
      // Skip Supabase calls in demo mode to prevent fetch errors
      if (DEMO_MODE) {
        console.log('Demo mode: skipping Supabase data fetch');
        setTrips([]);
        setFleet([]);
        setDrivers([]);
        setIsLoading(false);
        return;
      }
      
      console.log('Loading data for user:', user.email);
      setIsLoading(true);
      
      try {
        const { data: tripsData, error: tripsError } = await supabase
          .from('trips')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (tripsError) {
          console.error('Error loading trips:', tripsError?.message || JSON.stringify(tripsError) || 'Unknown error');
          // Continue with empty data instead of breaking
        }
        
        const { data: fleetData, error: fleetError } = await supabase
          .from('vehicles')
          .select('*');
          
        if (fleetError) {
          console.error('Error loading fleet:', fleetError?.message || JSON.stringify(fleetError) || 'Unknown error');
          // Continue with empty data instead of breaking
        }
        
        const { data: driversData, error: driversError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('role', 'DRIVER');
          
        if (driversError) {
          console.error('Error loading drivers:', driversError?.message || JSON.stringify(driversError) || 'Unknown error');
          // Continue with empty data instead of breaking
        }
        
        console.log('Data loaded:', { tripsData, fleetData, driversData });
        setTrips(tripsData || []);
        setFleet(fleetData || []);
        setDrivers(driversData || []);
      } catch (error) {
        console.error('Unexpected error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [user]);

  const handleCreateTrip = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const driverId = formData.get('driverId') as string;
    const truckId = formData.get('truckId') as string;
    const trailerId = formData.get('trailerId') as string;
    const escortCarId = formData.get('escortCarId') as string;
    
    const tripData = {
      origin: formData.get('origin') as string,
      destination: formData.get('destination') as string,
      driver_id: driverId,
      truck_id: truckId,
      trailer_id: trailerId !== 'none' ? trailerId : null,
      escort_car_id: escortCarId !== 'none' ? escortCarId : null,
      agent_contact_number: formData.get('agentContact') as string,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      notes: formData.get('notes') as string,
    };

    await supabase.from('trips').insert([tripData]);
    
    // Update vehicle statuses
    await supabase.from('vehicles').update({ status: 'in_use' }).eq('id', truckId);
    if (trailerId !== 'none') {
      await supabase.from('vehicles').update({ status: 'in_use' }).eq('id', trailerId);
    }
    if (escortCarId !== 'none') {
      await supabase.from('vehicles').update({ status: 'in_use' }).eq('id', escortCarId);
    }

    e.currentTarget.reset();
    
    // Refresh trips and fleet
    const { data: updatedTrips } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });
    const { data: updatedFleet } = await supabase
      .from('vehicles')
      .select('*');
    
    setTrips(updatedTrips || []);
    setFleet(updatedFleet || []);
  };

  const handleCancelTrip = async (tripId: string) => {
    const confirmed = window.confirm('Are you sure you want to cancel this trip? This will release all assigned vehicles.');
    if (!confirmed) return;

    try {
      // Get trip details to release vehicles
      const trip = trips.find(t => t.id === tripId);
      if (!trip) return;

      // Cancel the trip
      await supabase.from('trips').update({ status: 'CANCELLED' }).eq('id', tripId);

      // Release vehicles back to available status
      if (trip.truck_id) {
        await supabase.from('vehicles').update({ status: 'available' }).eq('id', trip.truck_id);
      }
      if (trip.trailer_id) {
        await supabase.from('vehicles').update({ status: 'available' }).eq('id', trip.trailer_id);
      }
      if (trip.escort_car_id) {
        await supabase.from('vehicles').update({ status: 'available' }).eq('id', trip.escort_car_id);
      }

      // Refresh data
      const { data: updatedTrips } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false });
      const { data: updatedFleet } = await supabase
        .from('vehicles')
        .select('*');
      
      setTrips(updatedTrips || []);
      setFleet(updatedFleet || []);
      
      alert('Trip cancelled successfully and vehicles released.');
    } catch (error) {
      console.error('Error cancelling trip:', error);
      alert('Error cancelling trip. Please try again.');
    }
  };

  const handleViewLogs = (tripId: string) => {
    // For now, show basic trip info. In a real app, this would open a detailed logs view
    const trip = trips.find(t => t.id === tripId);
    if (trip) {
      const assignedVehicles = [];
      if (trip.truck_id) {
        const truck = fleet?.find(v => v.id === trip.truck_id);
        if (truck) assignedVehicles.push(`Truck: ${truck.make} ${truck.model} (${truck.plate_number})`);
      }
      if (trip.trailer_id) {
        const trailer = fleet?.find(v => v.id === trip.trailer_id);
        if (trailer) assignedVehicles.push(`Trailer: ${trailer.make} ${trailer.model} (${trailer.plate_number})`);
      }
      if (trip.escort_car_id) {
        const escort = fleet?.find(v => v.id === trip.escort_car_id);
        if (escort) assignedVehicles.push(`Escort: ${escort.make} ${escort.model} (${escort.plate_number})`);
      }
      
      const logMessage = `Trip Logs:\n\nTrip ID: ${tripId.slice(0, 8)}\nRoute: ${trip.origin} to ${trip.destination}\nDriver: ${drivers?.find(d => d.id === trip.driver_id)?.name || 'Unknown'}\nStatus: ${trip.status}\nCreated: ${new Date(trip.created_at).toLocaleString()}\n\nAssigned Vehicles:\n${assignedVehicles.join('\n') || 'None'}\n\nNotes: ${trip.notes || 'No notes'}`;
      alert(logMessage);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-500';
      case 'IN_PROGRESS': return 'bg-amber-500 animate-pulse-slow';
      case 'PENDING': return 'bg-primary';
      case 'CANCELLED': return 'bg-rose-500';
      default: return 'bg-slate-400';
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role="CEO" />
        <main className="flex-1 md:ml-60 p-4 md:p-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
            <p className="text-muted-foreground mb-4">Please sign in to access the Trips page.</p>
            <p className="text-sm text-muted-foreground">User status: {user ? 'Authenticated' : 'Not authenticated'}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
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
                  <Label>Assigned Truck</Label>
                  <Select name="truckId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select available truck" />
                    </SelectTrigger>
                    <SelectContent>
                      {fleet?.filter(v => v.type === 'TRUCK' && v.status === 'available').map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.plate_number})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Trailer (Optional)</Label>
                  <Select name="trailerId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select trailer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No trailer</SelectItem>
                      {fleet?.filter(v => v.type === 'TRAILER' && v.status === 'available').map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.plate_number})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Escort Car (Optional)</Label>
                  <Select name="escortCarId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select escort car" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No escort car</SelectItem>
                      {fleet?.filter(v => v.type === 'ESCORT_CAR' && v.status === 'available').map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.plate_number})</SelectItem>
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
                <TableHead className="text-right px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading trips...</TableCell></TableRow>
              ) : trips?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">No trips dispatched yet.</TableCell></TableRow>
              ) : trips?.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/30">
                  <TableCell className="px-6 py-4 font-mono text-xs text-primary">{t.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{t.origin}</span>
                      <span className="text-[10px] text-muted-foreground">to</span>
                      <span className="text-sm font-medium">{t.destination}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1 text-xs">
                        <User className="size-3 text-muted-foreground" />
                        {drivers?.find(d => d.id === t.driver_id)?.name || 'Unknown'}
                      </div>
                      
                      {/* Truck */}
                      {t.truck_id && (() => {
                        const truck = fleet?.find(v => v.id === t.truck_id);
                        return truck ? (
                          <div className="flex items-center gap-1 text-xs bg-blue-50 p-1 rounded">
                            <TruckIcon className="size-3 text-blue-600" />
                            <span className="font-medium text-blue-800">{truck.make} {truck.model} ({truck.plate_number})</span>
                            <span className="text-blue-600">{truck.mileage.toLocaleString()} km</span>
                          </div>
                        ) : null;
                      })()}
                      
                      {/* Trailer */}
                      {t.trailer_id && (() => {
                        const trailer = fleet?.find(v => v.id === t.trailer_id);
                        return trailer ? (
                          <div className="flex items-center gap-1 text-xs bg-green-50 p-1 rounded">
                            <TruckIcon className="size-3 text-green-600" />
                            <span className="font-medium text-green-800">Trailer: {trailer.make} {trailer.model} ({trailer.plate_number})</span>
                          </div>
                        ) : null;
                      })()}
                      
                      {/* Escort Car */}
                      {t.escort_car_id && (() => {
                        const escortCar = fleet?.find(v => v.id === t.escort_car_id);
                        return escortCar ? (
                          <div className="flex items-center gap-1 text-xs bg-amber-50 p-1 rounded">
                            <TruckIcon className="size-3 text-amber-600" />
                            <span className="font-medium text-amber-800">Escort: {escortCar.make} {escortCar.model} ({escortCar.plate_number})</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px] font-bold", getStatusColor(t.status))}>
                      {t.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <TripEvidenceDialog tripId={t.id} status={t.status} />
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex gap-1 justify-end">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[10px] h-6 px-2"
                        onClick={() => handleViewLogs(t.id)}
                      >
                        Logs
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="text-[10px] h-6 px-2"
                        onClick={() => handleCancelTrip(t.id)}
                        disabled={t.status === 'CANCELLED'}
                      >
                        {t.status === 'CANCELLED' ? 'Cancelled' : 'Cancel'}
                      </Button>
                    </div>
                  </TableCell>
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
                      <span className="font-headline text-base">{t.origin}</span>
                      <Route className="size-4 text-primary" />
                      <span className="font-headline text-base">{t.destination}</span>
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
                      <span className="text-xs font-bold">{drivers?.find(d => d.id === t.driver_id)?.name || 'Unknown'}</span>
                      
                      {/* Truck */}
                      {t.truck_id && (() => {
                        const truck = fleet?.find(v => v.id === t.truck_id);
                        return truck ? (
                          <span className="text-[10px] text-blue-600 font-medium">{truck.make} {truck.model} ({truck.plate_number})</span>
                        ) : null;
                      })()}
                      
                      {/* Additional Vehicles */}
                      {(t.trailer_id || t.escort_car_id) && (
                        <span className="text-[10px] text-muted-foreground">
                          + {t.trailer_id ? 'Trailer' : ''}{t.trailer_id && t.escort_car_id ? ' + ' : ''}{t.escort_car_id ? 'Escort' : ''}
                        </span>
                      )}
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
                      <a href={`tel:${t.agent_contact_number}`} className="text-xs text-primary font-bold flex items-center gap-2">
                        <Phone className="size-3" /> {t.agent_contact_number}
                      </a>
                    </div>
                    
                    {/* Detailed Vehicle Information */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Assigned Vehicles</p>
                      
                      {/* Truck Details */}
                      {t.truck_id && (() => {
                        const truck = fleet?.find(v => v.id === t.truck_id);
                        return truck ? (
                          <div className="bg-blue-50 p-2 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <TruckIcon className="size-4 text-blue-600" />
                              <span className="font-bold text-blue-800 text-xs">Truck</span>
                            </div>
                            <div className="text-xs text-blue-700 space-y-1">
                              <p><strong>{truck.make} {truck.model}</strong> ({truck.plate_number})</p>
                              <p>Year: {truck.year} | Type: {truck.type}</p>
                              <p>Mileage: {truck.mileage.toLocaleString()} km</p>
                              <p>Fuel Capacity: {truck.fuel_capacity}L</p>
                            </div>
                          </div>
                        ) : null;
                      })()}
                      
                      {/* Trailer Details */}
                      {t.trailer_id && (() => {
                        const trailer = fleet?.find(v => v.id === t.trailer_id);
                        return trailer ? (
                          <div className="bg-green-50 p-2 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <TruckIcon className="size-4 text-green-600" />
                              <span className="font-bold text-green-800 text-xs">Trailer</span>
                            </div>
                            <div className="text-xs text-green-700">
                              <p><strong>{trailer.make} {trailer.model}</strong> ({trailer.plate_number})</p>
                              <p>Year: {trailer.year} | Type: {trailer.type}</p>
                            </div>
                          </div>
                        ) : null;
                      })()}
                      
                      {/* Escort Car Details */}
                      {t.escort_car_id && (() => {
                        const escortCar = fleet?.find(v => v.id === t.escort_car_id);
                        return escortCar ? (
                          <div className="bg-amber-50 p-2 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <TruckIcon className="size-4 text-amber-600" />
                              <span className="font-bold text-amber-800 text-xs">Escort Car</span>
                            </div>
                            <div className="text-xs text-amber-700">
                              <p><strong>{escortCar.make} {escortCar.model}</strong> ({escortCar.plate_number})</p>
                              <p>Year: {escortCar.year} | Type: {escortCar.type}</p>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Dispatcher Notes</p>
                      <p className="text-xs">{t.notes || 'No specific notes provided.'}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[10px] h-8"
                        onClick={() => handleViewLogs(t.id)}
                      >
                        View Logs
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="text-[10px] h-8"
                        onClick={() => handleCancelTrip(t.id)}
                        disabled={t.status === 'CANCELLED'}
                      >
                        {t.status === 'CANCELLED' ? 'Cancelled' : 'Cancel Trip'}
                      </Button>
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
          <div className="py-12 text-center space-y-4">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <ImageIcon className="size-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No photos uploaded for this trip yet.</p>
          </div>
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
