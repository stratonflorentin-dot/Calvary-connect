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
import { Route, Plus, Trash2, Pencil, UserX, MapPin, Search, CalendarDays, FileText, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { africanCities, City, getCityByName, calculateDistance, getEstimatedTime } from '@/lib/african-cities';
import { getUsersAction } from '@/app/users/actions';
import { WaybillDialog } from '@/components/trip/waybill-dialog';
import { TRAInvoiceDialog } from '@/components/financial/tra-invoice-dialog';
import { cn } from '@/lib/utils';

import { WorkflowService } from '@/services/workflow-service';
import { 
  notifyAccountantsTripRevenue, 
  fetchAccountantUserIds,
  fetchSalesmanUserIds 
} from '@/services/notification-service';

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
  const [bookings, setBookings] = useState<any[]>([]);
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

  const [selectedWaybillTrip, setSelectedWaybillTrip] = useState<any>(null);
  const [selectedInvoiceTrip, setSelectedInvoiceTrip] = useState<any>(null);

  const [tripForm, setTripForm] = useState({
    origin: '',
    destination: '',
    driver_id: '',
    vehicle_id: '',
    trailer_id: '',
    cargo: '',
    cargoWeight: '',
    client: '',
    distance: '',
    estimated_time: '',
    tripType: 'local',
    tripCategory: 'town',
    salesAmount: '',
    payment_status: 'PENDING',
    booking_id: '',
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

  useEffect(() => {
    if (role === "DRIVER") {
      window.location.replace("/driver/trips");
      return;
    }
    const loadData = async () => {
      if (!user && !isAdmin) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const [
          { data: tripsData }, 
          { data: vehiclesData }, 
          { data: trailersData }, 
          { data: bookingsData },
          allUsers
        ] = await Promise.all([
          supabase.from('trips').select('*').order('created_at', { ascending: false }),
          supabase.from('vehicles').select('*'),
          supabase.from('vehicles').select('*').eq('type', 'TRAILER'),
          supabase.from('bookings').select('*, customers(company_name)').eq('status', 'confirmed').order('created_at', { ascending: false }),
          getUsersAction()
        ]);

        const driversData = allUsers?.filter((u: any) => u.role === 'DRIVER') || [];
        
        // Filter vehicles for truck selection (exclude trailers)
        const trucksData = (vehiclesData || []).filter(v => v.type !== 'TRAILER');

        setTrips(tripsData || []);
        setVehicles(trucksData);
        setTrailers(trailersData || []);
        setDrivers(driversData);
        setBookings(bookingsData || []);
      } catch (error) {
        console.error('[TripsPage] Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, isAdmin, role]);

  if (isUserLoading || !isInitialized || role === "DRIVER") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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

      const salesAmount = tripForm.salesAmount ? parseFloat(tripForm.salesAmount) : 0;
      const vatRate = tripForm.tripType === 'transit' ? 0 : 18;
      const vatAmount = salesAmount ? salesAmount * (vatRate / 100) : 0;
      const totalAmount = salesAmount ? salesAmount + vatAmount : 0;

      const tripData = {
        origin: tripForm.origin,
        destination: tripForm.destination,
        driver_id: tripForm.driver_id,
        vehicle_id: tripForm.vehicle_id,
        trailer_id: tripForm.trailer_id || null,
        cargo: tripForm.cargo,
        cargoWeight: tripForm.cargoWeight ? parseFloat(tripForm.cargoWeight) : null,
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
        // Link to booking
        booking_id: tripForm.booking_id || null,
        trip_number: `TR-${Date.now().toString().slice(-8)}`,
      };

      const { data: newTrip, error } = await supabase.from('trips').insert([tripData]).select().single();
      if (error) throw error;

      // Update booking status if trip was created from a booking
      if (tripForm.booking_id) {
        await supabase.from('bookings').update({
          status: 'in_progress',
          updated_at: new Date().toISOString()
        }).eq('id', tripForm.booking_id);
      }

      // Create accounting journal entry for trip revenue
      if (newTrip && salesAmount > 0) {
        // Get vehicle information for accounting reference
        const vehicle = vehicles.find(v => v.id === tripForm.vehicle_id);
        const trailer = trailers.find(t => t.id === tripForm.trailer_id);
        const vehicleInfo = vehicle ? `${vehicle.plate_number} (${vehicle.make} ${vehicle.model})` : 'Unknown';
        const trailerInfo = trailer ? `+ Trailer ${trailer.plate_number}` : '';
        
        // Create journal entry for trip revenue
        const { error: journalError, data: journalEntry } = await supabase.from('journal_entries').insert({
          entry_number: `JE-${Date.now()}`,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Trip Revenue: ${tripForm.origin} → ${tripForm.destination} | Vehicle: ${vehicleInfo}${trailerInfo}`,
          reference: newTrip.id,
          created_by: user?.id,
        }).select().single();
        
        if (!journalError && journalEntry) {
          // Debit: Accounts Receivable (or Cash if paid)
          await supabase.from('journal_entry_lines').insert([
            {
              journal_entry_id: journalEntry.id,
              account_code: '1102', // Bank Account or Accounts Receivable
              debit: totalAmount,
              credit: 0,
              description: `Trip revenue receivable - ${vehicleInfo}${trailerInfo}`,
            },
            {
              journal_entry_id: journalEntry.id,
              account_code: '4001', // Revenue - Transportation Services
              debit: 0,
              credit: salesAmount,
              description: `Transportation service revenue - ${vehicleInfo}${trailerInfo}`,
            },
            {
              journal_entry_id: journalEntry.id,
              account_code: '2201', // VAT Payable
              debit: 0,
              credit: vatAmount,
              description: `VAT on transportation services - ${vehicleInfo}${trailerInfo}`,
            },
          ]);

          // Notify accountants about new revenue with vehicle info
          const accountantIds = await fetchAccountantUserIds();
          await notifyAccountantsTripRevenue(
            newTrip.id,
            tripForm.origin,
            tripForm.destination,
            totalAmount,
            accountantIds
          );
        }
      }

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
        cargoWeight: '',
        client: '',
        distance: '',
        estimated_time: '',
        tripType: 'local',
        tripCategory: 'town',
        salesAmount: '',
        payment_status: 'PENDING',
        booking_id: '',
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
        cargoWeight: editingTrip.cargoWeight,
        client: editingTrip.client,
        status: editingTrip.status,
        payment_status: editingTrip.payment_status || 'PENDING',
        cost_fuel: editingTrip.cost_fuel ? parseFloat(editingTrip.cost_fuel) : 0,
        cost_tolls: editingTrip.cost_tolls ? parseFloat(editingTrip.cost_tolls) : 0,
        cost_border: editingTrip.cost_border ? parseFloat(editingTrip.cost_border) : 0,
        cost_customs: editingTrip.cost_customs ? parseFloat(editingTrip.cost_customs) : 0,
        waybill_number: editingTrip.waybill_number,
        updated_at: new Date().toISOString()
      };

      if (editingTrip.status === 'COMPLETED') {
        await WorkflowService.completeTrip(editingTrip.id, updateData);
      } else {
        const { error } = await supabase
          .from('trips')
          .update(updateData)
          .eq('id', editingTrip.id);
        if (error) throw error;
      }

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
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground"> Trips Management</h1>
              <p className="text-base text-muted-foreground mt-2">Manage and monitor all fleet trips</p>
            </div>

            {canCreateTrip && (
              <Dialog open={showTripDialog} onOpenChange={setShowTripDialog}>
                <DialogTrigger asChild>
                  <Button className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow">
                    <Plus className="mr-2 h-4 w-4" />
                    New Trip
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">Create New Trip</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddTrip} className="space-y-6 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="booking">Select Booking (Optional)</Label>
                      <Select 
                        value={tripForm.booking_id}
                        onValueChange={(value) => {
                          const selectedBooking = bookings.find(b => b.id === value);
                          if (selectedBooking) {
                            setTripForm({ 
                              ...tripForm, 
                              booking_id: value,
                              origin: selectedBooking.pickup_location || tripForm.origin,
                              destination: selectedBooking.delivery_location || tripForm.destination,
                              client: selectedBooking.customers?.company_name || tripForm.client,
                              salesAmount: selectedBooking.amount?.toString() || tripForm.salesAmount
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a confirmed booking (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {bookings.length === 0 ? (
                            <SelectItem value="" disabled>No confirmed bookings available</SelectItem>
                          ) : (
                            bookings.map(booking => (
                              <SelectItem key={booking.id} value={booking.id}>
                                {booking.booking_number} - {booking.customers?.company_name} ({booking.pickup_location} → {booking.delivery_location})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
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
                            <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-60 overflow-auto">
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
                                    className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-2 transition-colors"
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
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
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
                            <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-60 overflow-auto">
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
                                    className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-2 transition-colors"
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
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <div className="font-medium text-foreground">{city.name}</div>
                                      <div className="text-xs text-muted-foreground">{city.country} {city.isMajorHub && '• Major Hub'}</div>
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
                          <SelectTrigger className="h-11">
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
                          disabled={vehicles.length === 0}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={vehicles.length === 0 ? "No vehicles available" : "Select truck"} />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicles.length === 0 ? (
                              <div className="px-4 py-3 text-sm text-muted-foreground">
                                No vehicles available. Please add vehicles first.
                              </div>
                            ) : (
                              vehicles.map((vehicle) => (
                                <SelectItem key={vehicle.id} value={vehicle.id}>
                                  {vehicle.plate_number} - {vehicle.make} {vehicle.model} ({vehicle.type === 'DUMP_TRUCK' ? 'Dump Truck' : vehicle.type === 'TRUCK_HEAD' ? 'Truck Head' : vehicle.type === 'ESCORT_CAR' ? 'Escort Car' : vehicle.type})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {vehicles.length === 0 && (
                          <p className="text-xs text-destructive mt-2">Please add vehicles to the system before creating trips.</p>
                        )}
                      </div>
                      {/* Show trailer selection only for Truck Head */}
                      {selectedVehicleType === 'TRUCK_HEAD' && (
                        <div className="space-y-2">
                          <Label htmlFor="trailer">Trailer *</Label>
                          <Select
                            value={tripForm.trailer_id}
                            onValueChange={(value) => setTripForm({ ...tripForm, trailer_id: value })}
                            disabled={trailers.length === 0}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder={trailers.length === 0 ? "No trailers available" : "Select trailer"} />
                            </SelectTrigger>
                            <SelectContent>
                              {trailers.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-muted-foreground">
                                  No trailers available. Please add trailers first.
                                </div>
                              ) : (
                                trailers.map((trailer) => (
                                  <SelectItem key={trailer.id} value={trailer.id}>
                                    {trailer.plate_number} - {trailer.make} {trailer.model} {trailer.trailer_sub_type && `(${trailer.trailer_sub_type})`}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          {trailers.length === 0 && (
                            <p className="text-xs text-destructive mt-2">Please add trailers to the system.</p>
                          )}
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
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cargoWeight">Cargo Weight (tons)</Label>
                        <Input
                          id="cargoWeight"
                          type="number"
                          step="0.1"
                          value={tripForm.cargoWeight}
                          onChange={(e) => setTripForm({ ...tripForm, cargoWeight: e.target.value })}
                          placeholder="25.5"
                          className="h-11"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="client">Client Name</Label>
                        <Input
                          id="client"
                          value={tripForm.client}
                          onChange={(e) => setTripForm({ ...tripForm, client: e.target.value })}
                          placeholder="Client name"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="distance">Distance (km)</Label>
                        <Input
                          id="distance"
                          type="number"
                          value={tripForm.distance}
                          onChange={(e) => setTripForm({ ...tripForm, distance: e.target.value })}
                          placeholder="500"
                          className="h-11"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="estimated_time">Estimated Time (hours)</Label>
                      <Input
                        id="estimated_time"
                        value={tripForm.estimated_time}
                        onChange={(e) => setTripForm({ ...tripForm, estimated_time: e.target.value })}
                        placeholder="8 hours"
                        className="h-11"
                      />
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
                          <SelectTrigger className="h-11">
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
                            <SelectTrigger className="h-11">
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
                          className="h-11"
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
                          <SelectTrigger id="payment_status" className="h-11">
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

                    <div className="flex justify-end gap-3 pt-6">
                      <Button type="button" variant="outline" onClick={() => setShowTripDialog(false)} className="h-11 px-6">
                        Cancel
                      </Button>
                      <Button type="submit" className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow">
                        Create Trip
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}

            {/* Edit Trip Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">Edit Trip</DialogTitle>
                </DialogHeader>
                {editingTrip && (
                  <form onSubmit={handleEditTrip} className="space-y-6 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-origin">Origin</Label>
                        <Input
                          id="edit-origin"
                          value={editingTrip.origin}
                          onChange={(e) => setEditingTrip({ ...editingTrip, origin: e.target.value })}
                          required
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-destination">Destination</Label>
                        <Input
                          id="edit-destination"
                          value={editingTrip.destination}
                          onChange={(e) => setEditingTrip({ ...editingTrip, destination: e.target.value })}
                          required
                          className="h-11"
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
                        <Label htmlFor="edit-cargoWeight">Cargo Weight (tons)</Label>
                        <Input
                          id="edit-cargoWeight"
                          type="number"
                          step="0.1"
                          value={editingTrip.cargoWeight || ''}
                          onChange={(e) => setEditingTrip({ ...editingTrip, cargoWeight: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-client">Client Name</Label>
                        <Input
                          id="edit-client"
                          value={editingTrip.client || ''}
                          onChange={(e) => setEditingTrip({ ...editingTrip, client: e.target.value })}
                        />
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
                    </div>

                    {/* Operational Costs Section */}
                    <div className="pt-6 border-t border-border">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-foreground">Operational & Route Costs</h4>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Calvary Connect Tracker</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-waybill">Waybill Number</Label>
                          <Input
                            id="edit-waybill"
                            value={editingTrip.waybill_number || ''}
                            onChange={(e) => setEditingTrip({ ...editingTrip, waybill_number: e.target.value })}
                            placeholder="WB-..."
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-fuel">Fuel Cost</Label>
                          <Input
                            id="edit-fuel"
                            type="number"
                            step="0.01"
                            value={editingTrip.cost_fuel || ''}
                            onChange={(e) => setEditingTrip({ ...editingTrip, cost_fuel: e.target.value })}
                            className="h-11"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-tolls">Road Tolls</Label>
                          <Input
                            id="edit-tolls"
                            type="number"
                            step="0.01"
                            value={editingTrip.cost_tolls || ''}
                            onChange={(e) => setEditingTrip({ ...editingTrip, cost_tolls: e.target.value })}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-border">Border Permits</Label>
                          <Input
                            id="edit-border"
                            type="number"
                            step="0.01"
                            value={editingTrip.cost_border || ''}
                            onChange={(e) => setEditingTrip({ ...editingTrip, cost_border: e.target.value })}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-customs">Customs Fees</Label>
                          <Input
                            id="edit-customs"
                            type="number"
                            step="0.01"
                            value={editingTrip.cost_customs || ''}
                            onChange={(e) => setEditingTrip({ ...editingTrip, cost_customs: e.target.value })}
                            className="h-11"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-payment-status">Payment Status</Label>
                      <Select
                        value={editingTrip.payment_status || 'PENDING'}
                        onValueChange={(value) => setEditingTrip({ ...editingTrip, payment_status: value })}
                      >
                        <SelectTrigger id="edit-payment-status" className="h-11">
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

                    <div className="flex justify-end gap-3 pt-6">
                      <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)} className="h-11 px-6">
                        Cancel
                      </Button>
                      <Button type="submit" className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow">
                        Save Changes
                      </Button>
                    </div>
                  </form>
                )}
              </DialogContent>
            </Dialog>

            {/* Manage Access Dialog */}
            <Dialog open={showManageAccessDialog} onOpenChange={setShowManageAccessDialog}>
              <DialogContent className="max-w-md shadow-xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">Manage Driver Access</DialogTitle>
                </DialogHeader>
                {managingTrip && (
                  <div className="space-y-6 pt-4">
                    <div className="p-4 bg-muted/50 rounded-xl border border-border">
                      <p className="font-medium text-foreground">{managingTrip.origin} → {managingTrip.destination}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Current Driver: {drivers.find(d => d.id === managingTrip.driver_id)?.name || 'Unassigned'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-foreground">Remove driver access from this trip?</p>
                      <p className="text-xs text-muted-foreground">
                        This will unassign the current driver. The trip will remain but without a driver.
                      </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setShowManageAccessDialog(false)} className="h-11 px-6">
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleRemoveDriverAccess}
                        className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow"
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

          <Card className="shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-foreground">Recent Trips</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading trips...</div>
              ) : trips.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No trips found</p>
                  <Button
                    variant="outline"
                    className="mt-4 h-11 px-6"
                    onClick={() => setShowTripDialog(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first trip
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {trips.map((trip) => (
                    <div key={trip.id} className="border border-border rounded-xl p-5 hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Route className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold text-foreground">{trip.origin} → {trip.destination}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Status: {trip.status} | Cargo: {trip.cargo || 'N/A'}
                          </p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {trip.tripType && (
                              <Badge 
                                variant="outline" 
                                className={trip.tripType === 'transit' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-success/10 text-success border-success/20'}
                              >
                                {trip.tripType === 'transit' ? '🌐 Transit' : '🏠 Local'}
                                {trip.tripType === 'local' && trip.tripCategory && ` (${trip.tripCategory})`}
                              </Badge>
                            )}
                            {trip.vatRate !== undefined && (
                              <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border">
                                VAT: {trip.vatRate}%
                              </Badge>
                            )}
                            {/* Payment Status Badge with Glow */}
                            {trip.payment_status && (
                              <Badge 
                                variant="outline" 
                                className={
                                  trip.payment_status === 'PENDING' 
                                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                                    : trip.payment_status === 'ADVANCE'
                                    ? 'bg-warning/10 text-warning border-warning/20'
                                    : 'bg-success/10 text-success border-success/20'
                                }
                              >
                                <span className="flex items-center gap-1 font-bold">
                                  {trip.payment_status === 'PENDING' && '💳 PENDING'}
                                  {trip.payment_status === 'ADVANCE' && '💰 ADVANCE'}
                                  {trip.payment_status === 'PAID' && '✅ PAID'}
                                </span>
                              </Badge>
                            )}
                          </div>
                          
                          {/* Milestone Stepper */}
                          <div className="mt-4 mb-2 max-w-lg">
                            <div className="flex items-center justify-between relative">
                              <div className="absolute left-0 top-1/2 w-full h-1 bg-muted -translate-y-1/2 z-0 rounded-full"></div>
                              {(() => {
                                const statuses = ["PENDING", "IN_PROGRESS", "COMPLETED"];
                                const currentIndex = statuses.indexOf(trip.status);
                                return statuses.map((status, idx) => {
                                  const isCompleted = currentIndex >= idx;
                                  const isActive = currentIndex === idx;
                                  return (
                                    <div key={status} className="relative z-10 flex flex-col items-center gap-1 bg-card px-2">
                                      <div className={cn("w-4 h-4 rounded-full border-2 transition-all", 
                                        isCompleted ? "bg-primary border-primary" : "bg-card border-border",
                                        isActive && "ring-4 ring-primary/20 scale-125"
                                      )}>
                                        {isCompleted && <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full mx-auto mt-0.5"></div>}
                                      </div>
                                      <span className={cn("text-[10px] font-bold tracking-widest", isCompleted ? "text-primary" : "text-muted-foreground")}>{status}</span>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                          {trip.client && (
                            <p className="text-sm text-muted-foreground mt-2">Client: {trip.client}</p>
                          )}
                          {trip.salesAmount && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Sales: {parseFloat(trip.salesAmount).toFixed(2)} | VAT: {trip.vatAmount?.toFixed(2) || (parseFloat(trip.salesAmount) * (trip.vatRate || 0) / 100).toFixed(2)} | Total: {trip.totalAmount?.toFixed(2) || (parseFloat(trip.salesAmount) * (1 + (trip.vatRate || 0) / 100)).toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={trip.status === 'COMPLETED' ? 'default' : 'secondary'} className="font-medium">
                            {trip.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.location.href = `/bookings?trip=${trip.id}&client=${encodeURIComponent(trip.client || '')}&origin=${encodeURIComponent(trip.origin || '')}&destination=${encodeURIComponent(trip.destination || '')}&amount=${trip.salesAmount || trip.fare || 0}`}
                            title="Create Booking from Trip"
                            className="hover:bg-primary/10 hover:text-primary"
                          >
                            <CalendarDays className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="hover:bg-primary/10 hover:text-primary"
                            onClick={() => setSelectedWaybillTrip(trip)}
                            title="Generate Waybill"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="hover:bg-success/10 hover:text-success"
                            onClick={() => setSelectedInvoiceTrip(trip)}
                            title="TRA Tax Invoice"
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                          {canEditTrip && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(trip)}
                              className="hover:bg-warning/10 hover:text-warning"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canManageAccess && trip.driver_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => openManageAccessDialog(trip)}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteTrip && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="hover:bg-destructive/10 hover:text-destructive"
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

        {selectedWaybillTrip && (
          <WaybillDialog
            trip={selectedWaybillTrip}
            client={{ company_name: selectedWaybillTrip.client }}
            open={!!selectedWaybillTrip}
            onClose={() => setSelectedWaybillTrip(null)}
          />
        )}

        {selectedInvoiceTrip && (
          <TRAInvoiceDialog
            invoice={{
              id: selectedInvoiceTrip.id,
              invoice_number: selectedInvoiceTrip.waybill_number || `INV-${selectedInvoiceTrip.id.slice(0, 8).toUpperCase()}`,
              customer_name: selectedInvoiceTrip.client || "General Client",
              status: selectedInvoiceTrip.payment_status === "PAID" ? "paid" : "unpaid",
              amount: selectedInvoiceTrip.salesAmount || 0,
              created_at: selectedInvoiceTrip.created_at,
              due_date: selectedInvoiceTrip.created_at,
              trip_number: selectedInvoiceTrip.id.slice(0, 8).toUpperCase(),
              origin: selectedInvoiceTrip.origin,
              destination: selectedInvoiceTrip.destination,
              vat_applicable: selectedInvoiceTrip.tripType !== 'transit',
              wht_applicable: true
            }}
            client={{
              company_name: selectedInvoiceTrip.client || "General Client"
            }}
            open={!!selectedInvoiceTrip}
            onClose={() => setSelectedInvoiceTrip(null)}
          />
        )}
      </main>
      <BottomTabs role={role!} />
      <RoleSelector />
    </div>
  );
}

