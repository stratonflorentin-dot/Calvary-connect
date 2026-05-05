"use client";

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, MapPin, Navigation, Plus, FileText, Trash2, AlertTriangle, Thermometer, Anchor, Globe, Clock, TrendingUp, DollarSign, Users, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import { useLanguage } from '@/hooks/use-language';

export function CeoView() {
  const { user } = useSupabase();
  const { t } = useLanguage();
  const { format } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [showTripDialog, setShowTripDialog] = useState(false);
  const [showReportsDialog, setShowReportsDialog] = useState(false);

  // Vehicle form state
  const [vehicleForm, setVehicleForm] = useState({
    plate_number: '',
    make: '',
    model: '',
    year: '',
    type: 'TRUCK',
    capacity: '',
    mileage: '0',
    has_reefer: false,
    is_lowbed: false
  });

  // Trip form state
  const [tripForm, setTripForm] = useState({
    origin: '',
    destination: '',
    driver_id: '',
    vehicle_id: '',
    cargo: '',
    cargo_type: 'GENERAL',
    client: '',
    distance: '',
    estimated_time: '',
    has_reefer: false,
    is_cross_border: false,
    border_point: ''
  });

  const clearMockVehicles = async () => {
    const mockPlates = ['KAB 123A', 'KCD 456B', 'KEF 789C'];
    for (const plate of mockPlates) {
      await supabase.from('vehicles').delete().eq('plate_number', plate);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await clearMockVehicles();

        const { data: vehiclesData } = await supabase.from('vehicles').select('*');
        const { data: tripsData } = await supabase.from('trips').select('*').order('created_at', { ascending: false });
        const { data: driversData } = await supabase.from('user_profiles').select('*').eq('role', 'DRIVER');

        setVehicles(vehiclesData || []);
        setTrips(tripsData || []);
        setDrivers(driversData || []);

      } catch (error) {
        console.error('Error fetching data:', error);
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

      toast({ title: 'Success', description: 'Vehicle added to fleet!' });
      setShowVehicleDialog(false);
      setVehicleForm({ plate_number: '', make: '', model: '', year: '', type: 'TRUCK', capacity: '', mileage: '0', has_reefer: false, is_lowbed: false });

      const { data } = await supabase.from('vehicles').select('*');
      setVehicles(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddTrip = async () => {
    try {
      if (!tripForm.driver_id || !tripForm.vehicle_id) {
        toast({ title: 'Error', description: 'Please select driver and vehicle', variant: 'destructive' });
        return;
      }

      const tripData = {
        origin: tripForm.origin,
        destination: tripForm.destination,
        driver_id: tripForm.driver_id,
        vehicle_id: tripForm.vehicle_id,
        cargo: tripForm.cargo,
        cargo_type: tripForm.cargo_type,
        client: tripForm.client,
        distance: tripForm.distance ? parseInt(tripForm.distance, 10) : null,
        estimated_time: tripForm.estimated_time,
        has_reefer: tripForm.has_reefer,
        is_cross_border: tripForm.is_cross_border,
        border_point: tripForm.border_point,
        status: 'PENDING',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('trips').insert([tripData]);
      if (error) throw error;

      toast({ title: 'Success', description: 'Trip dispatched!' });
      setShowTripDialog(false);
      setTripForm({ origin: '', destination: '', driver_id: '', vehicle_id: '', cargo: '', cargo_type: 'GENERAL', client: '', distance: '', estimated_time: '', has_reefer: false, is_cross_border: false, border_point: '' });

      const { data } = await supabase.from('trips').select('*').order('created_at', { ascending: false });
      setTrips(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to dispatch trip', variant: 'destructive' });
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    try {
      await supabase.from('vehicles').delete().eq('id', vehicleId);
      toast({ title: 'Success', description: 'Vehicle removed from fleet' });
      setVehicles(vehicles.filter(v => v.id !== vehicleId));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getCargoTypeBadge = (cargoType: string) => {
    switch (cargoType) {
      case 'REEFER':
      case 'cold_chain':
        return <Badge className="bg-cyan-500/20 text-cyan-700 border-cyan-200"><Thermometer className="size-3 mr-1" /> Cold Chain</Badge>;
      case 'LOWBED':
      case 'heavy_equipment':
        return <Badge className="bg-amber-500/20 text-amber-700 border-amber-200"><Package className="size-3 mr-1" /> Heavy Cargo</Badge>;
      case 'CROSS_BORDER':
        return <Badge className="bg-purple-500/20 text-purple-700 border-purple-200"><Globe className="size-3 mr-1" /> Cross-Border</Badge>;
      default:
        return <Badge variant="outline">General</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_transit':
        return <Badge className="bg-green-500/20 text-green-700">In Transit</Badge>;
      case 'loading':
        return <Badge className="bg-amber-500/20 text-amber-700">Loading</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Truck className="size-12 mx-auto mb-4 text-primary animate-bounce" />
          <p className="text-muted-foreground">Loading Fleet Operations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Calvary Fleet Command</h1>
          <p className="text-muted-foreground text-sm">East Africa Logistics Operations Center</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            {vehicles.length} Vehicles Online
          </Badge>
        </div>
      </div>

      {/* Operations Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Trips</p>
                <p className="text-3xl font-bold">{trips.filter(t => ['in_transit', 'loading', 'pending'].includes(t.status)).length}</p>
              </div>
              <Navigation className="size-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Cross-Border</p>
                <p className="text-3xl font-bold">{trips.filter(t => t.is_cross_border).length}</p>
              </div>
              <Globe className="size-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-cyan-500 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Cold Chain</p>
                <p className="text-3xl font-bold">{trips.filter(t => t.has_reefer || t.cargo_type === 'REEFER').length}</p>
              </div>
              <Thermometer className="size-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Heavy Cargo</p>
                <p className="text-3xl font-bold">{vehicles.filter(v => v.is_lowbed || v.type === 'LOWBED').length}</p>
              </div>
              <Anchor className="size-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Trips */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-5 text-primary" />
              Active Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trips.filter(t => ['in_transit', 'loading', 'pending'].includes(t.status)).length === 0 ? (
              <div className="text-center py-8">
                <Truck className="size-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No active trips</p>
                <p className="text-xs text-muted-foreground mt-2">Dispatch a new trip to see routes here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {trips.filter(t => ['in_transit', 'loading', 'pending'].includes(t.status)).slice(0, 5).map((trip) => (
                  <div key={trip.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{trip.origin} → {trip.destination}</p>
                        {getCargoTypeBadge(trip.cargo_type)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {trip.cargo && `${trip.cargo} • `}
                        {trip.client && `${trip.client} • `}
                        {trip.distance && `${trip.distance}km`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(trip.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Dialog open={showVehicleDialog} onOpenChange={setShowVehicleDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vehicle
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Register New Vehicle</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Plate Number</Label>
                      <Input value={vehicleForm.plate_number} onChange={(e) => setVehicleForm({...vehicleForm, plate_number: e.target.value})} placeholder="KAB 123A" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Make</Label>
                        <Select value={vehicleForm.make} onValueChange={(value) => setVehicleForm({...vehicleForm, make: value})}>
                          <SelectTrigger><SelectValue placeholder="Select make" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Isuzu">Isuzu</SelectItem>
                            <SelectItem value="Hino">Hino</SelectItem>
                            <SelectItem value="Mercedes-Benz">Mercedes-Benz</SelectItem>
                            <SelectItem value="MAN">MAN</SelectItem>
                            <SelectItem value="Scania">Scania</SelectItem>
                            <SelectItem value="Volvo">Volvo</SelectItem>
                            <SelectItem value="FAW">FAW</SelectItem>
                            <SelectItem value="Sinotruk">Sinotruk</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Model</Label>
                        <Input value={vehicleForm.model} onChange={(e) => setVehicleForm({...vehicleForm, model: e.target.value})} placeholder="NPR 75" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Type</Label>
                        <Select value={vehicleForm.type} onValueChange={(value) => setVehicleForm({...vehicleForm, type: value})}>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TRUCK">Standard Truck</SelectItem>
                            <SelectItem value="LOWBED">Lowbed Trailer</SelectItem>
                            <SelectItem value="DUMP_TRUCK">Dump Truck</SelectItem>
                            <SelectItem value="TRUCK_HEAD">Truck Head</SelectItem>
                            <SelectItem value="REEFER">Reefer Container</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Year</Label>
                        <Select value={vehicleForm.year} onValueChange={(value) => setVehicleForm({...vehicleForm, year: value})}>
                          <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                          <SelectContent>
                            {[2024,2023,2022,2021,2020,2019,2018].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={vehicleForm.has_reefer} onChange={(e) => setVehicleForm({...vehicleForm, has_reefer: e.target.checked})} className="rounded" />
                        Reefer Container
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={vehicleForm.is_lowbed} onChange={(e) => setVehicleForm({...vehicleForm, is_lowbed: e.target.checked})} className="rounded" />
                        Lowbed Capable
                      </label>
                    </div>
                    <div>
                      <Label>Capacity (tons)</Label>
                      <Input value={vehicleForm.capacity} onChange={(e) => setVehicleForm({...vehicleForm, capacity: e.target.value})} placeholder="30" />
                    </div>
                    <Button onClick={handleAddVehicle} className="w-full">Add Vehicle</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showTripDialog} onOpenChange={setShowTripDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-amber-600 hover:bg-amber-700">
                    <Navigation className="w-4 h-4 mr-2" />
                    Dispatch Trip
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>New Trip Dispatch</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Origin</Label>
                        <Input value={tripForm.origin} onChange={(e) => setTripForm({...tripForm, origin: e.target.value})} placeholder="Dar es Salaam" />
                      </div>
                      <div>
                        <Label>Destination</Label>
                        <Input value={tripForm.destination} onChange={(e) => setTripForm({...tripForm, destination: e.target.value})} placeholder="Kasumbalesa, DRC" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Cargo Type</Label>
                        <Select value={tripForm.cargo_type} onValueChange={(value) => setTripForm({...tripForm, cargo_type: value})}>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GENERAL">General Freight</SelectItem>
                            <SelectItem value="REEFER">Cold Chain / Reefer</SelectItem>
                            <SelectItem value="LOWBED">Heavy Equipment</SelectItem>
                            <SelectItem value="CROSS_BORDER">Cross-Border Transit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Cargo Description</Label>
                        <Input value={tripForm.cargo} onChange={(e) => setTripForm({...tripForm, cargo: e.target.value})} placeholder="Mining equipment" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Driver</Label>
                        <Select value={tripForm.driver_id} onValueChange={(value) => setTripForm({...tripForm, driver_id: value})}>
                          <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                          <SelectContent>
                            {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name || 'Driver'}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Vehicle</Label>
                        <Select value={tripForm.vehicle_id} onValueChange={(value) => setTripForm({...tripForm, vehicle_id: value})}>
                          <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                          <SelectContent>
                            {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate_number} - {v.make}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Client</Label>
                        <Input value={tripForm.client} onChange={(e) => setTripForm({...tripForm, client: e.target.value})} placeholder="Mining Co." />
                      </div>
                      <div>
                        <Label>Distance (km)</Label>
                        <Input value={tripForm.distance} onChange={(e) => setTripForm({...tripForm, distance: e.target.value})} placeholder="1200" />
                      </div>
                    </div>
                    <div className="flex gap-4 flex-wrap">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={tripForm.has_reefer} onChange={(e) => setTripForm({...tripForm, has_reefer: e.target.checked})} className="rounded" />
                        Cold Chain Required
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={tripForm.is_cross_border} onChange={(e) => setTripForm({...tripForm, is_cross_border: e.target.checked})} className="rounded" />
                        Cross-Border Transit
                      </label>
                    </div>
                    {tripForm.is_cross_border && (
                      <div>
                        <Label>Border Crossing Point</Label>
                        <Select value={tripForm.border_point} onValueChange={(value) => setTripForm({...tripForm, border_point: value})}>
                          <SelectTrigger><SelectValue placeholder="Select border point" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Kasumbalesa">Kasumbalesa (DRC Border)</SelectItem>
                            <SelectItem value="Tunduma">Tunduma (Zambia Border)</SelectItem>
                            <SelectItem value="Rusumo">Rusumo (Rwanda Border)</SelectItem>
                            <SelectItem value="Sirari">Sirari (Kenya Border)</SelectItem>
                            <SelectItem value="Mutukula">Mutukula (Uganda Border)</SelectItem>
                            <SelectItem value="Kabanga">Kabanga (Burundi Border)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button onClick={handleAddTrip} className="w-full bg-primary hover:bg-primary/90">Dispatch Trip</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showReportsDialog} onOpenChange={setShowReportsDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    Fleet Reports
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Fleet Operations Report</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-4 flex items-center gap-2"><Users className="size-4" /> Drivers ({drivers.length})</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {drivers.map(d => (
                          <div key={d.id} className="p-2 border rounded text-sm">
                            <p className="font-medium">{d.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{d.phone || 'No phone'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-4 flex items-center gap-2"><Truck className="size-4" /> Vehicles ({vehicles.length})</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {vehicles.map(v => (
                          <div key={v.id} className="p-2 border rounded text-sm flex justify-between">
                            <div>
                              <p className="font-medium">{v.plate_number}</p>
                              <p className="text-xs text-muted-foreground">{v.make} {v.model}</p>
                            </div>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteVehicle(v.id)}>
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-4 flex items-center gap-2"><Navigation className="size-4" /> Trips ({trips.length})</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {trips.slice(0, 10).map(t => (
                          <div key={t.id} className="p-2 border rounded text-sm">
                            <p className="font-medium">{t.origin} → {t.destination}</p>
                            <p className="text-xs text-muted-foreground">{getStatusBadge(t.status)} • {t.cargo}</p>
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

      {/* Regional Coverage Map Placeholder */}
      <Card className="bg-gradient-to-br from-primary/5 to-amber-500/5 border-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">East Africa Coverage</h3>
              <p className="text-sm text-muted-foreground">Operating across Tanzania, DRC, Zambia, Kenya, Rwanda, Uganda, Burundi</p>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-green-500/20 text-green-700">DRC Transit</Badge>
              <Badge className="bg-blue-500/20 text-blue-700">Zambia Route</Badge>
              <Badge className="bg-amber-500/20 text-amber-700">Regional Hub</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}