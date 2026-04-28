"use client";

import { useState, useEffect } from 'react';
import { getSafeRoute, getDistance } from '@/lib/grok';
import { useSupabase } from '@/components/supabase-provider';
import { useRole } from '@/hooks/use-role';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { RoleSelector } from '@/components/dashboard/role-selector';
import { RouteMapDialog } from '@/components/route-map-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Plus, Trash2, Pencil, UserX, MapPin, Search, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { africanCities, City, getCityByName, calculateDistance, getEstimatedTime } from '@/lib/african-cities';

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
  const [trailers, setTrailers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('');
  
  // Route map dialog state
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [isSafeRoute, setIsSafeRoute] = useState(false);
  const [selectedOrigin, setSelectedOrigin] = useState<City | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<City | null>(null);
  
  // City search state
  const [originSearch, setOriginSearch] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);

  const [tripForm, setTripForm] = useState({
    origin: '',
    destination: '',
    driver_id: '',
    vehicle_id: '',
    trailer_id: '',
    cargo: '',
    client: '',
    distance: '',
    estimated_time: '',
    tripType: 'local',
    tripCategory: 'town',
    salesAmount: '',
    payment_status: 'PENDING',
  });

  // Calculate driver allowance based on trip details
  const calculateAllowance = (trip: any) => {
    let baseAmount = 500; // Base amount for any trip
    
    // Distance-based allowance (0.5 per km)
    if (trip.distance) {
      const distance = parseInt(trip.distance.toString().replace(/[^0-9]/g, ''));
      baseAmount += Math.floor(distance * 0.5);
    }
    
    // Time-based allowance (100 per hour)
    if (trip.estimated_time) {
      const hours = parseInt(trip.estimated_time.toString().replace(/[^0-9]/g, ''));
      baseAmount += hours * 100;
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
        const [{ data: tripsData }, { data: vehiclesData }, { data: trailersData }, { data: driversData }] = await Promise.all([
          supabase.from('trips').select('*').order('created_at', { ascending: false }),
          supabase.from('vehicles').select('*').in('type', ['DUMP_TRUCK', 'TRUCK_HEAD', 'ESCORT_CAR']),
          supabase.from('vehicles').select('*').eq('type', 'TRAILER'),
          supabase.from('user_profiles').select('*').eq('role', 'DRIVER')
        ]);

        setTrips(tripsData || []);
        setVehicles(vehiclesData || []);
        setTrailers(trailersData || []);
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
        toast({ title: 'Error', description: 'Please select a truck', variant: 'destructive' });
        return;
      }
      // Validate trailer selection for Truck Head
      const selectedVehicle = vehicles.find(v => v.id === tripForm.vehicle_id);
      if (selectedVehicle?.type === 'TRUCK_HEAD' && !tripForm.trailer_id) {
        toast({ title: 'Error', description: 'Please select a trailer for Truck Head', variant: 'destructive' });
        return;
      }

      const salesAmount = tripForm.salesAmount ? parseFloat(tripForm.salesAmount) : null;
      const vatRate = tripForm.tripType === 'transit' ? 0 : 18;
      const vatAmount = salesAmount ? salesAmount * (vatRate / 100) : null;
      const totalAmount = salesAmount ? salesAmount + vatAmount : null;

      const tripData = {
        origin: tripForm.origin,
        destination: tripForm.destination,
        driver_id: tripForm.driver_id,
        vehicle_id: tripForm.vehicle_id,
        trailer_id: tripForm.trailer_id || null,
        cargo: tripForm.cargo,
        client: tripForm.client,
        distance: tripForm.distance ? parseInt(tripForm.distance, 10) : null,
        estimated_time: tripForm.estimated_time,
        status: 'PENDING',
        created_at: new Date().toISOString(),
        // Trip type & VAT
        tripType: tripForm.tripType,
        tripCategory: tripForm.tripType === 'local' ? tripForm.tripCategory : null,
        salesAmount: salesAmount,
        vatRate: vatRate,
        vatAmount: vatAmount,
        totalAmount: totalAmount,
        payment_status: tripForm.payment_status || 'PENDING',
      };

      const { data: newTrip, error } = await supabase.from('trips').insert([tripData]).select().single();
      if (error) throw error;

      // Create driver allowance for the trip
      if (newTrip && tripForm.driver_id) {
        const allowanceAmount = calculateAllowance(newTrip);
        await supabase.from('driver_allowances').insert({
          driver_id: tripForm.driver_id,
          trip_id: newTrip.id,
          amount: allowanceAmount,
          status: 'approved',
          created_at: new Date().toISOString(),
          reason: `Trip allowance: ${tripForm.origin} → ${tripForm.destination}`
        });
      }

      toast({ title: 'Success', description: 'Trip and driver allowance created successfully!' });
      setShowTripDialog(false);
      setSelectedVehicleType('');
      setTripForm({
        origin: '',
        destination: '',
        driver_id: '',
        vehicle_id: '',
        trailer_id: '',
        cargo: '',
        client: '',
        distance: '',
        estimated_time: '',
        tripType: 'local',
        tripCategory: 'town',
        salesAmount: '',
        payment_status: 'PENDING',
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
        payment_status: editingTrip.payment_status || 'PENDING',
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

  // Role-based permissions - only CEO/ADMIN/OPERATOR can create/edit/manage trips
  const canCreateTrip = role === 'CEO' || role === 'ADMIN' || role === 'OPERATOR';
  const canEditTrip = role === 'CEO' || role === 'ADMIN' || role === 'OPERATOR';
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

            {canCreateTrip && (
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
                      {/* Origin City Dropdown */}
                      <div className="space-y-2 relative">
                        <Label htmlFor="origin">Origin *</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="origin"
                            value={originSearch || tripForm.origin}
                            onChange={(e) => {
                              setOriginSearch(e.target.value);
                              setShowOriginDropdown(true);
                              if (selectedOrigin && selectedOrigin.name !== e.target.value) {
                                setSelectedOrigin(null);
                              }
                            }}
                            onFocus={() => setShowOriginDropdown(true)}
                            placeholder="Search city (e.g., Dar es Salaam)"
                            required
                            className="pl-10"
                          />
                          {showOriginDropdown && originSearch && (
                            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                              {africanCities
                                .filter(city => 
                                  city.name.toLowerCase().includes(originSearch.toLowerCase()) ||
                                  city.country.toLowerCase().includes(originSearch.toLowerCase())
                                )
                                .slice(0, 10)
                                .map((city) => (
                                  <button
                                    key={`${city.name}-${city.country}`}
                                    type="button"
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                                    onClick={() => {
                                      setTripForm({ ...tripForm, origin: city.name });
                                      setOriginSearch(city.name);
                                      setSelectedOrigin(city);
                                      setShowOriginDropdown(false);
                                      
                                      // Auto-fill distance and time if destination is also selected
                                      if (selectedDestination) {
                                        const dist = calculateDistance(city, selectedDestination);
                                        const time = getEstimatedTime(city, selectedDestination);
                                        setTripForm(prev => ({
                                          ...prev,
                                          origin: city.name,
                                          distance: dist.toString(),
                                          estimated_time: `${time} hours`
                                        }));
                                      }
                                    }}
                                  >
                                    <MapPin className="h-4 w-4 text-slate-400" />
                                    <div>
                                      <div className="font-medium">{city.name}</div>
                                      <div className="text-xs text-slate-500">{city.country} {city.isMajorHub && '• Major Hub'}</div>
                                    </div>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Destination City Dropdown */}
                      <div className="space-y-2 relative">
                        <Label htmlFor="destination">Destination *</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="destination"
                            value={destinationSearch || tripForm.destination}
                            onChange={(e) => {
                              setDestinationSearch(e.target.value);
                              setShowDestinationDropdown(true);
                              if (selectedDestination && selectedDestination.name !== e.target.value) {
                                setSelectedDestination(null);
                              }
                            }}
                            onFocus={() => setShowDestinationDropdown(true)}
                            placeholder="Search city (e.g., Arusha)"
                            required
                            className="pl-10"
                          />
                          {showDestinationDropdown && destinationSearch && (
                            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                              {africanCities
                                .filter(city => 
                                  city.name.toLowerCase().includes(destinationSearch.toLowerCase()) ||
                                  city.country.toLowerCase().includes(destinationSearch.toLowerCase())
                                )
                                .slice(0, 10)
                                .map((city) => (
                                  <button
                                    key={`${city.name}-${city.country}`}
                                    type="button"
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                                    onClick={() => {
                                      setTripForm({ ...tripForm, destination: city.name });
                                      setDestinationSearch(city.name);
                                      setSelectedDestination(city);
                                      setShowDestinationDropdown(false);
                                      
                                      // Auto-fill distance and time if origin is also selected
                                      if (selectedOrigin) {
                                        const dist = calculateDistance(selectedOrigin, city);
                                        const time = getEstimatedTime(selectedOrigin, city);
                                        setTripForm(prev => ({
                                          ...prev,
                                          destination: city.name,
                                          distance: dist.toString(),
                                          estimated_time: `${time} hours`
                                        }));
                                      }
                                    }}
                                  >
                                    <MapPin className="h-4 w-4 text-slate-400" />
                                    <div>
                                      <div className="font-medium">{city.name}</div>
                                      <div className="text-xs text-slate-500">{city.country} {city.isMajorHub && '• Major Hub'}</div>
                                    </div>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (!selectedOrigin || !selectedDestination) {
                            toast({ title: 'Error', description: 'Please select both origin and destination cities first', variant: 'destructive' });
                            return;
                          }
                          setIsSafeRoute(true);
                          setShowRouteMap(true);
                        }}
                      >
                        <Route className="h-4 w-4 mr-2" />
                        Get Safe Route (AI)
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          if (!selectedOrigin || !selectedDestination) {
                            toast({ title: 'Error', description: 'Please select both origin and destination cities first', variant: 'destructive' });
                            return;
                          }
                          
                          // Calculate distance automatically
                          const dist = calculateDistance(selectedOrigin, selectedDestination);
                          const time = getEstimatedTime(selectedOrigin, selectedDestination);
                          
                          setTripForm(prev => ({
                            ...prev,
                            distance: dist.toString(),
                            estimated_time: `${time} hours`
                          }));
                          
                          toast({ 
                            title: 'Distance Calculated', 
                            description: `${dist} km from ${selectedOrigin.name} to ${selectedDestination.name}. Estimated time: ${time} hours.`, 
                            variant: 'default' 
                          });
                          
                          // Also show the map
                          setIsSafeRoute(false);
                          setShowRouteMap(true);
                        }}
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Get Distance (AI)
                      </Button>
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
                        <Label htmlFor="vehicle">Truck Selection *</Label>
                        <Select
                          value={tripForm.vehicle_id}
                          onValueChange={(value) => {
                            const selectedVehicle = vehicles.find(v => v.id === value);
                            setSelectedVehicleType(selectedVehicle?.type || '');
                            setTripForm({ ...tripForm, vehicle_id: value, trailer_id: '' });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select truck" />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicles.map((vehicle) => (
                              <SelectItem key={vehicle.id} value={vehicle.id}>
                                {vehicle.plate_number} - {vehicle.make} {vehicle.model} ({vehicle.type === 'DUMP_TRUCK' ? 'Dump Truck' : vehicle.type === 'TRUCK_HEAD' ? 'Truck Head' : vehicle.type === 'ESCORT_CAR' ? 'Escort Car' : vehicle.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Show trailer selection only for Truck Head */}
                      {selectedVehicleType === 'TRUCK_HEAD' && (
                        <div className="space-y-2">
                          <Label htmlFor="trailer">Trailer *</Label>
                          <Select
                            value={tripForm.trailer_id}
                            onValueChange={(value) => setTripForm({ ...tripForm, trailer_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select trailer" />
                            </SelectTrigger>
                            <SelectContent>
                              {trailers.map((trailer) => (
                                <SelectItem key={trailer.id} value={trailer.id}>
                                  {trailer.plate_number} - {trailer.make} {trailer.model} {trailer.trailer_sub_type && `(${trailer.trailer_sub_type})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
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

                    {/* Trip Type & VAT */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tripType">Trip Type</Label>
                        <Select
                          value={tripForm.tripType}
                          onValueChange={(value) => setTripForm({ 
                            ...tripForm, 
                            tripType: value,
                            tripCategory: value === 'transit' ? '' : 'town'
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select trip type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transit">
                              <Badge variant="outline" className="bg-blue-50 mr-2">0% VAT</Badge>
                              Transit (International)
                            </SelectItem>
                            <SelectItem value="local">
                              <Badge variant="outline" className="bg-green-50 mr-2">18% VAT</Badge>
                              Local (Domestic)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {tripForm.tripType === 'local' && (
                        <div className="space-y-2">
                          <Label htmlFor="tripCategory">Category</Label>
                          <Select
                            value={tripForm.tripCategory}
                            onValueChange={(value) => setTripForm({ ...tripForm, tripCategory: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="town">Town Trip</SelectItem>
                              <SelectItem value="regional">Regional Trip</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="salesAmount">Sales Amount</Label>
                        <Input
                          id="salesAmount"
                          type="number"
                          step="0.01"
                          value={tripForm.salesAmount}
                          onChange={(e) => setTripForm({ ...tripForm, salesAmount: e.target.value })}
                          placeholder="1000.00"
                        />
                        {tripForm.salesAmount && (
                          <div className="text-sm text-muted-foreground">
                            VAT ({tripForm.tripType === 'transit' ? '0%' : '18%'}): {(parseFloat(tripForm.salesAmount) * (tripForm.tripType === 'transit' ? 0 : 0.18)).toFixed(2)} | 
                            Total: {(parseFloat(tripForm.salesAmount) * (tripForm.tripType === 'transit' ? 1 : 1.18)).toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment_status">Payment Status</Label>
                        <Select
                          value={tripForm.payment_status}
                          onValueChange={(value) => setTripForm({ ...tripForm, payment_status: value })}
                        >
                          <SelectTrigger id="payment_status">
                            <SelectValue placeholder="Select payment status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                                PENDING
                              </span>
                            </SelectItem>
                            <SelectItem value="ADVANCE">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"></span>
                                ADVANCE PAYMENT
                              </span>
                            </SelectItem>
                            <SelectItem value="PAID">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
                                PAID (Full)
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
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
            )}

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
                      <Label htmlFor="edit-status">Trip Status</Label>
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

                    <div className="space-y-2">
                      <Label htmlFor="edit-payment-status">Payment Status</Label>
                      <Select
                        value={editingTrip.payment_status || 'PENDING'}
                        onValueChange={(value) => setEditingTrip({ ...editingTrip, payment_status: value })}
                      >
                        <SelectTrigger id="edit-payment-status">
                          <SelectValue placeholder="Select payment status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                              💳 PENDING
                            </span>
                          </SelectItem>
                          <SelectItem value="ADVANCE">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"></span>
                              💰 ADVANCE PAYMENT
                            </span>
                          </SelectItem>
                          <SelectItem value="PAID">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
                              ✅ PAID (Full)
                            </span>
                          </SelectItem>
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
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {trip.tripType && (
                              <Badge 
                                variant="outline" 
                                className={trip.tripType === 'transit' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}
                              >
                                {trip.tripType === 'transit' ? '🌐 Transit' : '🏠 Local'}
                                {trip.tripType === 'local' && trip.tripCategory && ` (${trip.tripCategory})`}
                              </Badge>
                            )}
                            {trip.vatRate !== undefined && (
                              <Badge variant="outline" className="bg-gray-50">
                                VAT: {trip.vatRate}%
                              </Badge>
                            )}
                            {/* Payment Status Badge with Glow */}
                            {trip.payment_status && (
                              <Badge 
                                variant="outline" 
                                className={
                                  trip.payment_status === 'PENDING' 
                                    ? 'bg-red-50 text-red-700 border-red-200 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                                    : trip.payment_status === 'ADVANCE'
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200 shadow-[0_0_8px_rgba(234,179,8,0.4)]'
                                    : 'bg-green-50 text-green-700 border-green-200 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                                }
                              >
                                <span className="flex items-center gap-1">
                                  <span className={`w-2 h-2 rounded-full ${
                                    trip.payment_status === 'PENDING' 
                                      ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
                                      : trip.payment_status === 'ADVANCE'
                                      ? 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.8)]'
                                      : 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]'
                                  }`}></span>
                                  {trip.payment_status === 'PENDING' && '💳 PENDING'}
                                  {trip.payment_status === 'ADVANCE' && '💰 ADVANCE'}
                                  {trip.payment_status === 'PAID' && '✅ PAID'}
                                </span>
                              </Badge>
                            )}
                          </div>
                          {trip.client && (
                            <p className="text-sm text-muted-foreground">Client: {trip.client}</p>
                          )}
                          {trip.salesAmount && (
                            <p className="text-sm text-muted-foreground">
                              Sales: {parseFloat(trip.salesAmount).toFixed(2)} | VAT: {trip.vatAmount?.toFixed(2) || (parseFloat(trip.salesAmount) * (trip.vatRate || 0) / 100).toFixed(2)} | Total: {trip.totalAmount?.toFixed(2) || (parseFloat(trip.salesAmount) * (1 + (trip.vatRate || 0) / 100)).toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={trip.status === 'COMPLETED' ? 'default' : 'secondary'}>
                            {trip.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.location.href = `/bookings?trip=${trip.id}&client=${encodeURIComponent(trip.client || '')}&origin=${encodeURIComponent(trip.origin || '')}&destination=${encodeURIComponent(trip.destination || '')}&amount=${trip.salesAmount || trip.fare || 0}`}
                            title="Create Booking from Trip"
                          >
                            <CalendarDays className="h-4 w-4" />
                          </Button>
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

        {/* Route Map Dialog */}
        <RouteMapDialog
          isOpen={showRouteMap}
          onClose={() => setShowRouteMap(false)}
          origin={selectedOrigin}
          destination={selectedDestination}
          cargoType={tripForm.cargo}
          isSafeRoute={isSafeRoute}
        />
      </main>
      <BottomTabs role={role!} />
      <RoleSelector />
    </div>
  );
}

