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
        return 'text-primary bg-primary/10';
      case 'ESCORT_CAR':
        return 'text-accent bg-accent/10';
      case 'TRAILER':
        return 'text-warning bg-warning/10';
      case 'REEFER':
      case 'COLD_CHAIN':
        return 'text-info bg-info/10';
      case 'LOWBED':
      case 'HEAVY_CARGO':
        return 'text-warning bg-warning/10';
      default: return 'text-muted-foreground bg-muted/50';
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'assigned':
        return { label: 'Active', bg: 'bg-success/10', text: 'text-success', dot: 'bg-success', icon: <CheckCircle className="size-4" /> };
      case 'maintenance':
        return { label: 'Maintenance', bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive', icon: <Wrench className="size-4" /> };
      case 'idle':
        return { label: 'Idle', bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning', icon: <Clock className="size-4" /> };
      case 'sold':
        return { label: 'Sold', bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive', icon: <AlertTriangle className="size-4" /> };
      case 'decommissioned':
        return { label: 'Offline', bg: 'bg-muted/50', text: 'text-muted-foreground', dot: 'bg-muted', icon: <Clock className="size-4" /> };
      default: 
        return { label: status || 'Unknown', bg: 'bg-muted/50', text: 'text-muted-foreground', dot: 'bg-muted', icon: <Clock className="size-4" /> };
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
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Fleet Overview</h2>
            <p className="text-base text-muted-foreground mt-2">Manage your vehicles and equipment</p>
          </div>
          <AddVehicleDialog onVehicleAdded={loadFleetData} />
        </div>
        
        <Card className="border-destructive/50 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="size-5" />
              <h3 className="font-semibold text-lg">Error Loading Fleet Data</h3>
            </div>
            <p className="text-sm text-destructive mt-3">{error}</p>
            
            {debugInfo && (
              <details className="mt-4">
                <summary className="text-sm cursor-pointer text-destructive hover:text-destructive/80">
                  Debug Information
                </summary>
                <pre className="text-xs bg-destructive/10 p-3 rounded-xl mt-2 overflow-auto">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            )}
            
            <div className="flex gap-3 mt-6">
              <Button onClick={loadFleetData} variant="outline" size="sm" className="h-11 px-6">
                Try Again
              </Button>
              <Button onClick={() => {
                setError(null);
                setDebugInfo(null);
              }} variant="outline" size="sm" className="h-11 px-6">
                Clear Error
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg">
          <CardContent className="p-6 text-center">
            <Database className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">Database Setup Required</h3>
            <p className="text-base text-muted-foreground mb-4">
              It looks like the vehicles table hasn't been set up yet. Please run the database setup script first.
            </p>
            <div className="text-left bg-muted/50 p-4 rounded-xl text-sm">
              <p className="font-semibold mb-3 text-foreground">To fix this issue:</p>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
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
    <div className="space-y-8">
      {/* Header with Add Vehicle Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Fleet Overview</h2>
          <p className="text-base text-muted-foreground mt-2">Manage your vehicles and equipment</p>
        </div>
        <AddVehicleDialog onVehicleAdded={loadFleetData} />
      </div>

      {/* Fleet Statistics - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Total Fleet</span>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                <Truck className="size-5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{fleetStats.total}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Active Now</span>
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shadow-sm">
                <Activity className="size-5 text-success" />
              </div>
            </div>
            <p className="text-2xl font-bold text-success">{fleetStats.active}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Idle</span>
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shadow-sm">
                <Clock className="size-5 text-warning" />
              </div>
            </div>
            <p className="text-2xl font-bold text-warning">{fleetStats.idle}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Maintenance</span>
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shadow-sm">
                <Wrench className="size-5 text-destructive" />
              </div>
            </div>
            <p className="text-2xl font-bold text-destructive">{fleetStats.maintenance}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Utilization</span>
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shadow-sm">
                <Gauge className="size-5 text-accent" />
              </div>
            </div>
            <p className="text-2xl font-bold text-accent">{fleetStats.utilization}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Type Distribution - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Trucks</p>
                <p className="text-xl font-bold text-foreground">{fleetStats.trucks}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                <Truck className="size-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Escort Cars</p>
                <p className="text-xl font-bold text-foreground">{fleetStats.escortCars}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shadow-sm">
                <Car className="size-5 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Trailers</p>
                <p className="text-xl font-bold text-foreground">{fleetStats.trailers}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shadow-sm">
                <Package className="size-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Reefers</p>
                <p className="text-xl font-bold text-foreground">{fleetStats.reefers}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center shadow-sm">
                <Snowflake className="size-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Lowbeds</p>
                <p className="text-xl font-bold text-foreground">{fleetStats.lowbeds}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shadow-sm">
                <Anchor className="size-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Actions - Responsive Layout */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {['all', 'active', 'idle', 'maintenance'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-colors capitalize h-11 ${
                  filter === tab
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:bg-muted/50'
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
              className={filter === 'truck' ? 'bg-primary h-11 px-4 shadow-md' : 'h-11 px-4'}
            >
              <Truck className="size-4 mr-2" />
              Trucks
            </Button>
            <Button
              variant={filter === 'reefer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('reefer')}
              className={filter === 'reefer' ? 'bg-info h-11 px-4 shadow-md' : 'h-11 px-4'}
            >
              <Snowflake className="size-4 mr-2" />
              Cold Chain
            </Button>
            <Button
              variant={filter === 'lowbed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('lowbed')}
              className={filter === 'lowbed' ? 'bg-warning h-11 px-4 shadow-md' : 'h-11 px-4'}
            >
              <Anchor className="size-4 mr-2" />
              Heavy Cargo
            </Button>
            <Button
              variant={filter === 'car' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('car')}
              className={filter === 'car' ? 'bg-accent h-11 px-4 shadow-md' : 'h-11 px-4'}
            >
              <Car className="size-4 mr-2" />
              Escort Cars
            </Button>
            <Button
              variant={filter === 'trailer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('trailer')}
              className={filter === 'trailer' ? 'bg-warning h-11 px-4 shadow-md' : 'h-11 px-4'}
            >
              <Package className="size-4 mr-2" />
              Trailers
            </Button>
          </div>
        </div>
      </div>

      {/* Fleet List - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.id} className="shadow-lg hover:shadow-xl transition-shadow border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${getFleetColor(vehicle.type)} flex items-center justify-center shadow-sm`}>
                    {getFleetIcon(vehicle.type)}
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground">{vehicle.plate_number}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.make} {vehicle.model}
                    </p>
                  </div>
                </div>
                <Badge className={getStatusColor(vehicle.status)} variant="outline">
                  <span className="flex items-center gap-1 font-medium">
                    {getStatusIcon(vehicle.status)}
                    {vehicle.status}
                  </span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Year:</span>
                  <p className="font-semibold text-foreground">{vehicle.year}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Mileage:</span>
                  <p className="font-semibold text-foreground">{vehicle.mileage?.toLocaleString() || 'N/A'} km</p>
                </div>
              </div>
              
              {vehicle.fuel_type && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Fuel Type:</span>
                  <p className="font-semibold text-foreground capitalize">{vehicle.fuel_type}</p>
                </div>
              )}

              {vehicle.insurance_expiry && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Insurance Expires:</span>
                  <p className="font-semibold text-foreground">{new Date(vehicle.insurance_expiry).toLocaleDateString()}</p>
                </div>
              )}

              {/* Document Compliance */}
              <div className="pt-3 border-t border-border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Calvary Compliance</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Road License</span>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[9px] py-0.5 px-2 font-medium">Valid</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Insurance</span>
                    {vehicle.insurance_expiry ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[9px] py-0.5 px-2 font-medium">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[9px] py-0.5 px-2 font-medium flex items-center gap-1">
                        <AlertTriangle className="size-2.5" /> Due Soon
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 h-11"
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
                  className="flex-1 h-11 shadow-md hover:shadow-lg transition-shadow"
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
        <Card className="shadow-lg">
          <CardContent className="p-12 text-center">
            <Truck className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">No vehicles found</h3>
            <p className="text-base text-muted-foreground mb-4">
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
        <DialogContent className="sm:max-w-[425px] shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <User className="size-5" />
              Assign Vehicle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Vehicle</Label>
              <div className="p-4 bg-muted/50 rounded-xl border border-border">
                <p className="font-semibold text-foreground">{selectedVehicle?.plate_number}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedVehicle?.make} {selectedVehicle?.model}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Select Driver</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger className="h-11">
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
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => {
                  setAssignOpen(false);
                  setSelectedDriver('');
                }}
                disabled={assigning}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 shadow-md hover:shadow-lg transition-shadow"
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
