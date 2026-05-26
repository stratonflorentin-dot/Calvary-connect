"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/use-role';
import { getUsersAction } from '@/app/users/actions';
import { AddVehicleDialog } from '@/components/fleet/add-vehicle-dialog';
import { VehicleDetailsDialog } from '@/components/fleet/vehicle-details-dialog';
import { 
  Truck, Package, Car, Wrench, AlertTriangle, 
  CheckCircle, Clock, Database, AlertCircle, User,
  Snowflake, Anchor, MapPin, Fuel, Gauge, Droplet,
  Activity, Route, Users, FileText, Navigation
} from 'lucide-react';

interface Vehicle {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  type: string;
  status: string;
  mileage?: number;
  fuel_capacity?: number;
  fuel_type?: string;
  last_service_date?: string;
  next_service_date?: string;
  insurance_expiry?: string;
  created_at: string;
  updated_at: string;
}

export function FleetDashboard() {
  const { role } = useRole();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Assign dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadFleetData();
  }, [filter]);

  const loadFleetData = async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      
      console.log('Loading fleet data with filter:', filter);
      
      let query = supabase.from('vehicles').select('*');
      
      if (filter !== 'all') {
        if (filter === 'truck') {
          query = query.in('type', ['DUMP_TRUCK', 'TRUCK_HEAD']);
        } else if (filter === 'car') {
          query = query.eq('type', 'ESCORT_CAR');
        } else if (filter === 'trailer') {
          query = query.eq('type', 'TRAILER');
        } else {
          query = query.eq('type', filter);
        }
      }
      
      const { data, error, status } = await query.order('created_at', { ascending: false });
      
      console.log('Supabase response:', { data, error, status });
      
      // Skip Supabase calls to prevent errors
      if (error) {
        console.error('Supabase error:', error);
        setError('Failed to load fleet data. Please check your connection.');
        setDebugInfo({ error, status: 'Error' });
      }
      
      if (!data) {
        console.log('No data returned');
        setVehicles([]);
        return;
      }
      
      console.log('Vehicles loaded:', data.length);
      setVehicles(data);
      
    } catch (error) {
      console.error('Error loading fleet data:', error);
      
      // More detailed error handling
      if (error instanceof Error) {
        setError(`Error: ${error.message}`);
      } else if (typeof error === 'object' && error !== null) {
        setError(`Error: ${JSON.stringify(error)}`);
      } else {
        setError('Unknown error occurred while loading fleet data');
      }
      
      // Don&apos;t throw error, just set the error state
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  // Open assign dialog and load available drivers
  const openAssignDialog = async () => {
    try {
      // Load available drivers using server action to bypass RLS
      const allUsers = await getUsersAction();
      const driversData = allUsers?.filter((u: any) => u.role === 'DRIVER') || [];
      setDrivers(driversData);
      setAssignOpen(true);
    } catch (error) {
      console.error('Error opening assign dialog:', error);
      alert('Error loading drivers. Please try again.');
    }
  };

  // Handle vehicle assignment to driver
  const handleAssign = async () => {
    if (!selectedVehicle?.id || !selectedDriver) {
      alert('Please select a driver to assign');
      return;
    }
    
    try {
      setAssigning(true);
      
      // Update vehicle with assigned driver
      const { error } = await supabase
        .from('vehicles')
        .update({
          assigned_driver_id: selectedDriver,
          status: 'assigned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedVehicle.id);
      
      if (error) throw error;
      
      alert('✅ Vehicle assigned successfully!');
      setAssignOpen(false);
      setSelectedDriver('');
      loadFleetData(); // Refresh the list
    } catch (error: any) {
      console.error('Error assigning vehicle:', error);
      alert(`❌ Error assigning vehicle: ${error.message}`);
    } finally {
      setAssigning(false);
    }
  };

  const getFleetIcon = (type: string) => {
    const upperType = type?.toUpperCase();
    switch (upperType) {
      case 'DUMP_TRUCK':
      case 'TRUCK_HEAD':
        return <Truck className="size-5" />;
      case 'ESCORT_CAR':
        return <Car className="size-5" />;
      case 'TRAILER':
        return <Package className="size-5" />;
      case 'REEFER':
      case 'COLD_CHAIN':
        return <Snowflake className="size-5" />;
      case 'LOWBED':
      case 'HEAVY_CARGO':
        return <Anchor className="size-5" />;
      default: return <Truck className="size-5" />;
    }
  };

  const getFleetColor = (type: string) => {
    const upperType = type?.toUpperCase();
    switch (upperType) {
      case 'DUMP_TRUCK':
      case 'TRUCK_HEAD':
        return 'text-blue-600 bg-blue-50';
      case 'ESCORT_CAR':
        return 'text-purple-600 bg-purple-50';
      case 'TRAILER':
        return 'text-amber-600 bg-amber-50';
      case 'REEFER':
      case 'COLD_CHAIN':
        return 'text-cyan-600 bg-cyan-50';
      case 'LOWBED':
      case 'HEAVY_CARGO':
        return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'assigned':
        return { label: 'Active', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', icon: <CheckCircle className="size-4" /> };
      case 'maintenance':
        return { label: 'Maintenance', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', icon: <Wrench className="size-4" /> };
      case 'idle':
        return { label: 'Idle', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', icon: <Clock className="size-4" /> };
      case 'sold':
        return { label: 'Sold', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', icon: <AlertTriangle className="size-4" /> };
      case 'decommissioned':
        return { label: 'Offline', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-500', icon: <Clock className="size-4" /> };
      default: 
        return { label: status || 'Unknown', bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500', icon: <Clock className="size-4" /> };
    }
  };

  const getStatusColor = (status: string) => {
    const config = getStatusConfig(status);
    return `${config.bg} ${config.text}`;
  };

  const getStatusIcon = (status: string) => {
    return getStatusConfig(status).icon;
  };

  const fleetStats = {
    total: vehicles.length,
    active: vehicles.filter(v => v.status === 'active' || v.status === 'assigned').length,
    idle: vehicles.filter(v => v.status === 'idle').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length,
    sold: vehicles.filter(v => v.status === 'sold').length,
    decommissioned: vehicles.filter(v => v.status === 'decommissioned').length,
    trucks: vehicles.filter(v => v.type === 'DUMP_TRUCK' || v.type === 'TRUCK_HEAD').length,
    escortCars: vehicles.filter(v => v.type === 'ESCORT_CAR').length,
    trailers: vehicles.filter(v => v.type === 'TRAILER').length,
    reefers: vehicles.filter(v => v.type === 'REEFER' || v.type === 'COLD_CHAIN').length,
    lowbeds: vehicles.filter(v => v.type === 'LOWBED' || v.type === 'HEAVY_CARGO').length,
    utilization: vehicles.length > 0 ? Math.round((vehicles.filter(v => v.status === 'active' || v.status === 'assigned').length / vehicles.length) * 100) : 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading fleet data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Fleet Overview</h2>
            <p className="text-muted-foreground">Manage your vehicles and equipment</p>
          </div>
          <AddVehicleDialog onVehicleAdded={loadFleetData} />
        </div>
        
        <Card className="border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="size-5" />
              <h3 className="font-semibold">Error Loading Fleet Data</h3>
            </div>
            <p className="text-sm text-red-600 mt-2">{error}</p>
            
            {debugInfo && (
              <details className="mt-4">
                <summary className="text-sm cursor-pointer text-red-600 hover:text-red-800">
                  Debug Information
                </summary>
                <pre className="text-xs bg-red-50 p-2 rounded mt-2 overflow-auto">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            )}
            
            <div className="flex gap-2 mt-4">
              <Button onClick={loadFleetData} variant="outline" size="sm">
                Try Again
              </Button>
              <Button onClick={() => {
                setError(null);
                setDebugInfo(null);
              }} variant="outline" size="sm">
                Clear Error
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <Database className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Database Setup Required</h3>
            <p className="text-muted-foreground mb-4">
              It looks like the vehicles table hasn&apos;t been set up yet. Please run the database setup script first.
            </p>
            <div className="text-left bg-gray-50 p-4 rounded-lg text-sm">
              <p className="font-medium mb-2">To fix this issue:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                <li>Open Supabase SQL Editor</li>
                <li>Run the complete-supabase-setup-final-idempotent.sql script</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Vehicle Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Fleet Overview</h2>
          <p className="text-muted-foreground">Manage your vehicles and equipment</p>
        </div>
        <AddVehicleDialog onVehicleAdded={loadFleetData} />
      </div>

      {/* Fleet Statistics - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Total Fleet</span>
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Truck className="size-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{fleetStats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Active Now</span>
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <Activity className="size-4 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600">{fleetStats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Idle</span>
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="size-4 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-600">{fleetStats.idle}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Maintenance</span>
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <Wrench className="size-4 text-red-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">{fleetStats.maintenance}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Utilization</span>
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Gauge className="size-4 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-purple-600">{fleetStats.utilization}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Type Distribution - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trucks</p>
                <p className="text-xl font-bold">{fleetStats.trucks}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Truck className="size-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Escort Cars</p>
                <p className="text-xl font-bold">{fleetStats.escortCars}</p>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg">
                <Car className="size-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trailers</p>
                <p className="text-xl font-bold">{fleetStats.trailers}</p>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <Package className="size-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reefers</p>
                <p className="text-xl font-bold">{fleetStats.reefers}</p>
              </div>
              <div className="p-2 bg-cyan-50 rounded-lg">
                <Snowflake className="size-5 text-cyan-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lowbeds</p>
                <p className="text-xl font-bold">{fleetStats.lowbeds}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <Anchor className="size-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Actions - Responsive Layout */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {['all', 'active', 'idle', 'maintenance'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                  filter === tab
                    ? 'bg-amber-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={filter === 'truck' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('truck')}
              className={filter === 'truck' ? 'bg-blue-600' : ''}
            >
              <Truck className="size-4 mr-2" />
              Trucks
            </Button>
            <Button
              variant={filter === 'reefer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('reefer')}
              className={filter === 'reefer' ? 'bg-cyan-600' : ''}
            >
              <Snowflake className="size-4 mr-2" />
              Cold Chain
            </Button>
            <Button
              variant={filter === 'lowbed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('lowbed')}
              className={filter === 'lowbed' ? 'bg-orange-600' : ''}
            >
              <Anchor className="size-4 mr-2" />
              Heavy Cargo
            </Button>
            <Button
              variant={filter === 'car' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('car')}
              className={filter === 'car' ? 'bg-purple-600' : ''}
            >
              <Car className="size-4 mr-2" />
              Escort Cars
            </Button>
            <Button
              variant={filter === 'trailer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('trailer')}
              className={filter === 'trailer' ? 'bg-amber-600' : ''}
            >
              <Package className="size-4 mr-2" />
              Trailers
            </Button>
          </div>
        </div>
      </div>

      {/* Fleet List - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${getFleetColor(vehicle.type)}`}>
                    {getFleetIcon(vehicle.type)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{vehicle.plate_number}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.make} {vehicle.model}
                    </p>
                  </div>
                </div>
                <Badge className={getStatusColor(vehicle.status)}>
                  <span className="flex items-center gap-1">
                    {getStatusIcon(vehicle.status)}
                    {vehicle.status}
                  </span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Year:</span>
                  <p className="font-medium">{vehicle.year}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Mileage:</span>
                  <p className="font-medium">{vehicle.mileage?.toLocaleString() || 'N/A'} km</p>
                </div>
              </div>
              
              {vehicle.fuel_type && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Fuel Type:</span>
                  <p className="font-medium capitalize">{vehicle.fuel_type}</p>
                </div>
              )}

              {vehicle.insurance_expiry && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Insurance Expires:</span>
                  <p className="font-medium">{new Date(vehicle.insurance_expiry).toLocaleDateString()}</p>
                </div>
              )}

              {/* LogiPro Style Document Compliance */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">LogiPro Compliance</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Road License</span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] py-0">Valid</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Insurance</span>
                    {vehicle.insurance_expiry ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] py-0">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] py-0 flex items-center gap-1">
                        <AlertTriangle className="size-2.5" /> Due Soon
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedVehicle(vehicle);
                    setDetailsOpen(true);
                  }}
                >
                  View Details
                </Button>
                <VehicleDetailsDialog
                  vehicle={selectedVehicle}
                  open={detailsOpen}
                  onOpenChange={(open) => {
                    setDetailsOpen(open);
                    if (!open) {
                      loadFleetData();
                    }
                  }}
                  onVehicleUpdated={loadFleetData}
                  role={role || undefined}
                />
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedVehicle(vehicle);
                    openAssignDialog();
                  }}
                >
                  Assign
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {vehicles.length === 0 && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <Truck className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No vehicles found</h3>
            <p className="text-muted-foreground mb-4">
              {filter === 'all' 
                ? 'No vehicles in the fleet yet.' 
                : `No ${filter} vehicles found.`
              }
            </p>
            <AddVehicleDialog onVehicleAdded={loadFleetData} />
          </CardContent>
        </Card>
      )}

      {/* Assign Vehicle Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="size-5" />
              Assign Vehicle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vehicle</Label>
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="font-medium">{selectedVehicle?.plate_number}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedVehicle?.make} {selectedVehicle?.model}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Select Driver</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a driver..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No drivers available
                    </SelectItem>
                  ) : (
                    drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.full_name || driver.email || driver.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setAssignOpen(false);
                  setSelectedDriver('');
                }}
                disabled={assigning}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAssign}
                disabled={!selectedDriver || assigning}
              >
                {assigning ? 'Assigning...' : 'Assign Vehicle'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    );
  }
