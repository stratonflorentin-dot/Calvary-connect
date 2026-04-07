"use client";

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { useRole } from '@/hooks/use-role';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { RoleSelector } from '@/components/dashboard/role-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Plus, Trash2, Pencil, UserX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

export default function TripsPage() {
  const { role, isAdmin, isInitialized } = useRole();
  const { user, isLoading: isUserLoading } = useSupabase();
  const [trips, setTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTripDialog, setShowTripDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showManageAccessDialog, setShowManageAccessDialog] = useState(false);
  const [editingTrip, setEditingTrip] = useState<any>(null);
  const [managingTrip, setManagingTrip] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  
  const [tripForm, setTripForm] = useState({
    origin: '',
    destination: '',
    driver_id: '',
    vehicle_id: '',
    cargo: '',
    client: '',
    distance: '',
    estimated_time: ''
  });

  if (isUserLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const loadData = async () => {
      if (!user && !isAdmin) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
      try {
        const [{ data: tripsData }, { data: vehiclesData }, { data: driversData }] = await Promise.all([
          supabase.from('trips').select('*').order('created_at', { ascending: false }),
          supabase.from('vehicles').select('*'),
          supabase.from('user_profiles').select('*').eq('role', 'DRIVER')
        ]);
        
        setTrips(tripsData || []);
        setVehicles(vehiclesData || []);
        setDrivers(driversData || []);
      } catch (error) {
        console.error('[TripsPage] Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [user, isAdmin]);

  const handleAddTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!tripForm.driver_id) {
        toast({ title: 'Error', description: 'Please select a driver', variant: 'destructive' });
        return;
      }
      if (!tripForm.vehicle_id) {
        toast({ title: 'Error', description: 'Please select a vehicle', variant: 'destructive' });
        return;
      }
      
      const tripData = {
        origin: tripForm.origin,
        destination: tripForm.destination,
        driver_id: tripForm.driver_id,
        vehicle_id: tripForm.vehicle_id,
        cargo: tripForm.cargo,
        client: tripForm.client,
        distance: tripForm.distance ? parseInt(tripForm.distance, 10) : null,
        estimated_time: tripForm.estimated_time,
        status: 'PENDING',
        created_at: new Date().toISOString()
      };
      
      const { error } = await supabase.from('trips').insert([tripData]);
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Trip created successfully!' });
      setShowTripDialog(false);
      setTripForm({ 
        origin: '', 
        destination: '', 
        driver_id: '', 
        vehicle_id: '',
        cargo: '',
        client: '',
        distance: '',
        estimated_time: ''
      });
      
      // Refresh trips
      const { data } = await supabase.from('trips').select('*').order('created_at', { ascending: false });
      setTrips(data || []);
    } catch (error: any) {
      console.error('Add trip error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to create trip', variant: 'destructive' });
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!confirm('Are you sure you want to delete this trip?')) return;
    
    try {
      const { error } = await supabase.from('trips').delete().eq('id', tripId);
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Trip deleted successfully!' });
      setTrips(trips.filter(t => t.id !== tripId));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrip) return;
    
    try {
      const updateData = {
        origin: editingTrip.origin,
        destination: editingTrip.destination,
        cargo: editingTrip.cargo,
        client: editingTrip.client,
        status: editingTrip.status,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', editingTrip.id);
        
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Trip updated successfully!' });
      setShowEditDialog(false);
      setEditingTrip(null);
      
      // Refresh trips
      const { data } = await supabase.from('trips').select('*').order('created_at', { ascending: false });
      setTrips(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRemoveDriverAccess = async () => {
    if (!managingTrip) return;
    
    try {
      const { error } = await supabase
        .from('trips')
        .update({ driver_id: null, updated_at: new Date().toISOString() })
        .eq('id', managingTrip.id);
        
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Driver access removed successfully!' });
      setShowManageAccessDialog(false);
      setManagingTrip(null);
      
      // Refresh trips
      const { data } = await supabase.from('trips').select('*').order('created_at', { ascending: false });
      setTrips(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const openEditDialog = (trip: any) => {
    setEditingTrip({ ...trip });
    setShowEditDialog(true);
  };

  const openManageAccessDialog = (trip: any) => {
    setManagingTrip(trip);
    setShowManageAccessDialog(true);
  };

  // Role-based permissions
  const canEditTrip = role === 'DRIVER' || role === 'CEO' || role === 'ADMIN' || role === 'OPERATOR';
  const canManageAccess = role === 'CEO' || role === 'ADMIN' || role === 'OPERATOR';
  const canDeleteTrip = role === 'CEO' || role === 'ADMIN' || role === 'OPERATOR';

  if (!user && !isAdmin) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role="CEO" />
        <main className="flex-1 md:ml-60 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
            <p className="text-muted-foreground mb-4">Please sign in to access Trips page.</p>
            <p className="text-xs text-muted-foreground">User status: Not authenticated</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Trips Management</h1>
              <p className="text-muted-foreground">Manage and monitor all fleet trips</p>
            </div>
            
            <Dialog open={showTripDialog} onOpenChange={setShowTripDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Trip
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Trip</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddTrip} className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="origin">Origin *</Label>
                      <Input
                        id="origin"
                        value={tripForm.origin}
                        onChange={(e) => setTripForm({ ...tripForm, origin: e.target.value })}
                        placeholder="Nairobi"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="destination">Destination *</Label>
                      <Input
                        id="destination"
                        value={tripForm.destination}
                        onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
                        placeholder="Mombasa"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="driver">Driver *</Label>
                      <Select 
                        value={tripForm.driver_id} 
                        onValueChange={(value) => setTripForm({ ...tripForm, driver_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicle">Vehicle *</Label>
                      <Select 
                        value={tripForm.vehicle_id} 
                        onValueChange={(value) => setTripForm({ ...tripForm, vehicle_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {vehicle.plate_number} - {vehicle.make} {vehicle.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cargo">Cargo Type</Label>
                      <Input
                        id="cargo"
                        value={tripForm.cargo}
                        onChange={(e) => setTripForm({ ...tripForm, cargo: e.target.value })}
                        placeholder="General Cargo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client">Client Name</Label>
                      <Input
                        id="client"
                        value={tripForm.client}
                        onChange={(e) => setTripForm({ ...tripForm, client: e.target.value })}
                        placeholder="Client name"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="distance">Distance (km)</Label>
                      <Input
                        id="distance"
                        type="number"
                        value={tripForm.distance}
                        onChange={(e) => setTripForm({ ...tripForm, distance: e.target.value })}
                        placeholder="500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="estimated_time">Estimated Time (hours)</Label>
                      <Input
                        id="estimated_time"
                        value={tripForm.estimated_time}
                        onChange={(e) => setTripForm({ ...tripForm, estimated_time: e.target.value })}
                        placeholder="8 hours"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowTripDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      Create Trip
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Edit Trip Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Trip</DialogTitle>
                </DialogHeader>
                {editingTrip && (
                  <form onSubmit={handleEditTrip} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-origin">Origin</Label>
                        <Input
                          id="edit-origin"
                          value={editingTrip.origin}
                          onChange={(e) => setEditingTrip({ ...editingTrip, origin: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-destination">Destination</Label>
                        <Input
                          id="edit-destination"
                          value={editingTrip.destination}
                          onChange={(e) => setEditingTrip({ ...editingTrip, destination: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-cargo">Cargo Type</Label>
                        <Input
                          id="edit-cargo"
                          value={editingTrip.cargo || ''}
                          onChange={(e) => setEditingTrip({ ...editingTrip, cargo: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-client">Client Name</Label>
                        <Input
                          id="edit-client"
                          value={editingTrip.client || ''}
                          onChange={(e) => setEditingTrip({ ...editingTrip, client: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-status">Status</Label>
                      <Select 
                        value={editingTrip.status} 
                        onValueChange={(value) => setEditingTrip({ ...editingTrip, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                          <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        Save Changes
                      </Button>
                    </div>
                  </form>
                )}
              </DialogContent>
            </Dialog>

            {/* Manage Access Dialog */}
            <Dialog open={showManageAccessDialog} onOpenChange={setShowManageAccessDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Manage Driver Access</DialogTitle>
                </DialogHeader>
                {managingTrip && (
                  <div className="space-y-4 pt-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="font-medium">{managingTrip.origin} → {managingTrip.destination}</p>
                      <p className="text-sm text-muted-foreground">
                        Current Driver: {drivers.find(d => d.id === managingTrip.driver_id)?.name || 'Unassigned'}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm">Remove driver access from this trip?</p>
                      <p className="text-xs text-muted-foreground">
                        This will unassign the current driver. The trip will remain but without a driver.
                      </p>
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setShowManageAccessDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        type="button" 
                        variant="destructive"
                        onClick={handleRemoveDriverAccess}
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Remove Access
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Trips</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading trips...</div>
              ) : trips.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No trips found</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setShowTripDialog(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first trip
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {trips.map((trip) => (
                    <div key={trip.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Route className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold">{trip.origin} → {trip.destination}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Status: {trip.status} | Cargo: {trip.cargo || 'N/A'}
                          </p>
                          {trip.client && (
                            <p className="text-sm text-muted-foreground">Client: {trip.client}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={trip.status === 'COMPLETED' ? 'default' : 'secondary'}>
                            {trip.status}
                          </Badge>
                          {canEditTrip && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => openEditDialog(trip)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canManageAccess && trip.driver_id && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-orange-500 hover:text-orange-700"
                              onClick={() => openManageAccessDialog(trip)}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteTrip && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteTrip(trip.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <BottomTabs role={role!} />
      <RoleSelector />
    </div>
  );
}

