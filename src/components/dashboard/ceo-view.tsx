"use client";

import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { useMemo, useState, useEffect } from 'react';
import { StatCards } from './stat-cards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Plus, FileText, Trash2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { DriverLocationMap } from '@/components/driver-location-map';

export function CeoView() {
  const { user } = useSupabase();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [showTripDialog, setShowTripDialog] = useState(false);
  const [showReportsDialog, setShowReportsDialog] = useState(false);
  const [showDriverDialog, setShowDriverDialog] = useState(false);
  
  // Vehicle form state
  const [vehicleForm, setVehicleForm] = useState({
    plate_number: '',
    make: '',
    model: '',
    year: '',
    type: 'TRUCK',
    capacity: '',
    mileage: '0'
  });
  
  // Driver options state
  const [driverOptions, setDriverOptions] = useState<{id: string, name: string}[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<{id: string, plate: string, make: string, model: string}[]>([]);
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

  // Function to identify and delete mock vehicles
  const clearMockVehicles = async () => {
    const mockPlates = ['KAB 123A', 'KCD 456B', 'KEF 789C', 'KGH 012D', 'KIJ 345E', 'KLM 678F', 'KNO 901G', 'KPQ 234H'];
    
    for (const plate of mockPlates) {
      await supabase.from('vehicles').delete().eq('plate_number', plate);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First, clear any mock vehicles
        await clearMockVehicles();
        
        const { data: vehiclesData } = await supabase.from('vehicles').select('*');
        const { data: tripsData } = await supabase.from('trips').select('*');
        const { data: driversData } = await supabase.from('user_profiles').select('*').eq('role', 'DRIVER');
        
        // Use only real data from database - no mock data
        setVehicles(vehiclesData || []);
        setTrips(tripsData || []);
        setDrivers(driversData || []);
        
        // Set driver options from real data
        if (driversData) {
          setDriverOptions(driversData.map(d => ({ id: d.id, name: d.name || 'Unknown' })));
        }
        
        // Set vehicle options from real data
        if (vehiclesData) {
          setVehicleOptions(vehiclesData.map(v => ({ 
            id: v.id, 
            plate: v.plate_number, 
            make: v.make, 
            model: v.model 
          })));
        }
        
      } catch (error) {
        console.error('Error fetching data:', error);
        setVehicles([]);
        setTrips([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleAddVehicle = async () => {
    try {
      const { error } = await supabase.from('vehicles').insert([vehicleForm]);
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Vehicle added successfully!' });
      setShowVehicleDialog(false);
      setVehicleForm({ 
        plate_number: '', 
        make: '', 
        model: '', 
        year: '', 
        type: 'TRUCK', 
        capacity: '', 
        mileage: '0' 
      });
      
      // Refresh vehicles
      const { data } = await supabase.from('vehicles').select('*');
      setVehicles(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddTrip = async () => {
    try {
      // Validate that driver and vehicle are entered
      if (!tripForm.driver_id || tripForm.driver_id.trim() === '') {
        toast({ title: 'Error', description: 'Please enter a driver ID', variant: 'destructive' });
        return;
      }
      if (!tripForm.vehicle_id || tripForm.vehicle_id.trim() === '') {
        toast({ title: 'Error', description: 'Please enter a vehicle ID', variant: 'destructive' });
        return;
      }
      
      // Prepare trip data with proper types
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
      
      toast({ title: 'Success', description: 'Trip added successfully!' });
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
      const { data } = await supabase.from('trips').select('*');
      setTrips(data || []);
    } catch (error: any) {
      console.error('Add trip error:', error);
      toast({ title: 'Error', description: error.message || 'Network error occurred', variant: 'destructive' });
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Vehicle deleted successfully!' });
      setVehicles(vehicles.filter(v => v.id !== vehicleId));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      const { error } = await supabase.from('trips').delete().eq('id', tripId);
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Trip deleted successfully!' });
      setTrips(trips.filter(t => t.id !== tripId));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">CEO Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Fleet overview and operations management</p>
        </div>
      </div>

      <StatCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <Card className="col-span-1 lg:col-span-2 xl:col-span-2">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium">Database Connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm font-medium">Real Mode Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm font-medium">{vehicles.length} Vehicles Ready</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                  <span className="text-sm font-medium">{drivers.length} Drivers</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-sm font-medium">{trips.length} Active Trips</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-sm font-medium">Fleet Operational</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                  <span className="text-sm font-medium">GPS Tracking Active</span>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-lg font-bold mb-2">🚛 Fleet Management System Ready</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Your Fleet Management System is ready for your data. Add your vehicles and trips to get started.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>• Click "Add Vehicle" to register your fleet</div>
                  <div>• Click "Add Trip" to create routes</div>
                  <div>• Use "View Reports" to manage data</div>
                  <div>• All data is stored in your database</div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Start by adding your first vehicle to begin building your fleet database.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Dialog open={showVehicleDialog} onOpenChange={setShowVehicleDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full" variant="default">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vehicle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Vehicle</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="plate_number">Plate Number</Label>
                      <Input
                        id="plate_number"
                        value={vehicleForm.plate_number}
                        onChange={(e) => setVehicleForm({...vehicleForm, plate_number: e.target.value})}
                        placeholder="KAB 123A"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="make">Make</Label>
                        <Select value={vehicleForm.make} onValueChange={(value) => setVehicleForm({...vehicleForm, make: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select make" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Isuzu">Isuzu</SelectItem>
                            <SelectItem value="Hino">Hino</SelectItem>
                            <SelectItem value="Volvo">Volvo</SelectItem>
                            <SelectItem value="Kenworth">Kenworth</SelectItem>
                            <SelectItem value="Mercedes-Benz">Mercedes-Benz</SelectItem>
                            <SelectItem value="Scania">Scania</SelectItem>
                            <SelectItem value="Great Dane">Great Dane</SelectItem>
                            <SelectItem value="Manac">Manac</SelectItem>
                            <SelectItem value="Wabash">Wabash</SelectItem>
                            <SelectItem value="Toyota">Toyota</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="model">Model</Label>
                        <Input
                          id="model"
                          value={vehicleForm.model}
                          onChange={(e) => setVehicleForm({...vehicleForm, model: e.target.value})}
                          placeholder="NPR 75 / 500 Series"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="year">Year</Label>
                        <Select value={vehicleForm.year} onValueChange={(value) => setVehicleForm({...vehicleForm, year: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2023">2023</SelectItem>
                            <SelectItem value="2022">2022</SelectItem>
                            <SelectItem value="2021">2021</SelectItem>
                            <SelectItem value="2020">2020</SelectItem>
                            <SelectItem value="2019">2019</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="type">Type</Label>
                        <Select value={vehicleForm.type} onValueChange={(value) => setVehicleForm({...vehicleForm, type: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DUMP_TRUCK">Dump Truck</SelectItem>
                            <SelectItem value="TRUCK_HEAD">Truck Head (Hose)</SelectItem>
                            <SelectItem value="TRAILER">Trailer</SelectItem>
                            <SelectItem value="ESCORT_CAR">Escort Car</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="capacity">Capacity</Label>
                        <Input
                          id="capacity"
                          value={vehicleForm.capacity}
                          onChange={(e) => setVehicleForm({...vehicleForm, capacity: e.target.value})}
                          placeholder="10000kg / 40000lbs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="mileage">Mileage (km)</Label>
                        <Input
                          id="mileage"
                          value={vehicleForm.mileage}
                          onChange={(e) => setVehicleForm({...vehicleForm, mileage: e.target.value})}
                          placeholder="45000"
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddVehicle} className="w-full">Add Vehicle</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showTripDialog} onOpenChange={setShowTripDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full" variant="default">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Trip
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Trip</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="origin">Origin</Label>
                        <Input
                          id="origin"
                          value={tripForm.origin}
                          onChange={(e) => setTripForm({...tripForm, origin: e.target.value})}
                          placeholder="Enter origin location"
                        />
                      </div>
                      <div>
                        <Label htmlFor="destination">Destination</Label>
                        <Input
                          id="destination"
                          value={tripForm.destination}
                          onChange={(e) => setTripForm({...tripForm, destination: e.target.value})}
                          placeholder="Enter destination location"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="cargo">Cargo Type</Label>
                        <Input
                          id="cargo"
                          value={tripForm.cargo}
                          onChange={(e) => setTripForm({...tripForm, cargo: e.target.value})}
                          placeholder="Enter cargo type"
                        />
                      </div>
                      <div>
                        <Label htmlFor="client">Client</Label>
                        <Input
                          id="client"
                          value={tripForm.client}
                          onChange={(e) => setTripForm({...tripForm, client: e.target.value})}
                          placeholder="Enter client name"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="driver_id">Driver ID</Label>
                        <Input
                          id="driver_id"
                          value={tripForm.driver_id}
                          onChange={(e) => setTripForm({...tripForm, driver_id: e.target.value})}
                          placeholder="Enter driver ID"
                        />
                      </div>
                      <div>
                        <Label htmlFor="vehicle_id">Vehicle ID</Label>
                        <Input
                          id="vehicle_id"
                          value={tripForm.vehicle_id}
                          onChange={(e) => setTripForm({...tripForm, vehicle_id: e.target.value})}
                          placeholder="Enter vehicle ID"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="distance">Distance (km)</Label>
                        <Input
                          id="distance"
                          value={tripForm.distance}
                          onChange={(e) => setTripForm({...tripForm, distance: e.target.value})}
                          placeholder="485"
                        />
                      </div>
                      <div>
                        <Label htmlFor="estimated_time">Est. Time</Label>
                        <Input
                          id="estimated_time"
                          value={tripForm.estimated_time}
                          onChange={(e) => setTripForm({...tripForm, estimated_time: e.target.value})}
                          placeholder="8-10 hours"
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddTrip} className="w-full">Add Trip</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showReportsDialog} onOpenChange={setShowReportsDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full" variant="default">
                    <FileText className="w-4 h-4 mr-2" />
                    View Reports
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Fleet Reports</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Drivers ({drivers.length})</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {drivers.map((driver) => (
                          <div key={driver.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{driver.name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">
                                {driver.email} • {driver.phone || 'No phone'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ID: {driver.id?.slice(0, 8)}... • Status: {driver.status || 'active'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={driver.is_online ? 'default' : 'secondary'}>
                                {driver.is_online ? 'Online' : 'Offline'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4">Vehicles ({vehicles.length})</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {vehicles.map((vehicle) => (
                          <div key={vehicle.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{vehicle.make} {vehicle.model}</p>
                              <p className="text-sm text-muted-foreground">
                                {vehicle.plate_number} • {vehicle.type} • {vehicle.year}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {vehicle.capacity && `Capacity: ${vehicle.capacity} • `}
                                {vehicle.mileage && `Mileage: ${vehicle.mileage}km`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={vehicle.status === 'available' ? 'secondary' : vehicle.status === 'in_transit' ? 'default' : 'destructive'}>
                                {vehicle.status}
                              </Badge>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteVehicle(vehicle.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Trips ({trips.length})</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {trips.map((trip) => (
                          <div key={trip.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{trip.origin} → {trip.destination}</p>
                              <p className="text-sm text-muted-foreground">
                                {trip.cargo && `Cargo: ${trip.cargo} • `}
                                {trip.client && `Client: ${trip.client}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {trip.distance && `Distance: ${trip.distance} • `}
                                {trip.estimated_time && `Est: ${trip.estimated_time} • `}
                                {trip.created_at && `Created: ${new Date(trip.created_at).toLocaleDateString()}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={trip.status === 'completed' ? 'secondary' : trip.status === 'in_transit' ? 'default' : 'destructive'}>
                                {trip.status}
                              </Badge>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteTrip(trip.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
