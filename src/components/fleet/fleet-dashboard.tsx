"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { AddVehicleDialog } from '@/components/fleet/add-vehicle-dialog';
import { VehicleDetailsDialog } from '@/components/fleet/vehicle-details-dialog';
import { 
  Truck, Package, Car, Wrench, AlertTriangle, 
  CheckCircle, Clock, Database, AlertCircle
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
        query = query.eq('type', filter);
      }
      
      const { data, error, status } = await query.order('created_at', { ascending: false });
      
      console.log('Supabase response:', { data, error, status });
      
      // Skip Supabase calls to prevent errors
      if (error) {
        console.log('Supabase error - skipping:', error);
        setError('Demo mode - database disabled');
        setDebugInfo({ error: null, status: 'Demo mode' });
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

  const getFleetIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'truck': return <Truck className="size-5" />;
      case 'car': return <Car className="size-5" />;
      case 'trailer': return <Package className="size-5" />;
      default: return <Truck className="size-5" />;
    }
  };

  const getFleetColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'truck': return 'text-blue-600 bg-blue-50';
      case 'car': return 'text-purple-600 bg-purple-50';
      case 'trailer': return 'text-amber-600 bg-amber-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'sold': return 'bg-red-100 text-red-800';
      case 'decommissioned': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return <CheckCircle className="size-4" />;
      case 'maintenance': return <Wrench className="size-4" />;
      case 'sold': return <AlertTriangle className="size-4" />;
      case 'decommissioned': return <Clock className="size-4" />;
      default: return <Clock className="size-4" />;
    }
  };

  const fleetStats = {
    total: vehicles.length,
    active: vehicles.filter(v => v.status === 'active').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length,
    sold: vehicles.filter(v => v.status === 'sold').length,
    decommissioned: vehicles.filter(v => v.status === 'decommissioned').length,
    trucks: vehicles.filter(v => v.type === 'truck').length,
    escortCars: vehicles.filter(v => v.type === 'car').length,
    trailers: vehicles.filter(v => v.type === 'trailer').length,
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

      {/* Fleet Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Fleet</p>
                <p className="text-2xl font-bold">{fleetStats.total}</p>
              </div>
              <Truck className="size-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{fleetStats.active}</p>
              </div>
              <CheckCircle className="size-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Maintenance</p>
                <p className="text-2xl font-bold text-yellow-600">{fleetStats.maintenance}</p>
              </div>
              <Wrench className="size-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sold</p>
                <p className="text-2xl font-bold text-red-600">{fleetStats.sold}</p>
              </div>
              <AlertTriangle className="size-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Type Distribution */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
              <div className="p-2 bg-yellow-50 rounded-lg">
                <Car className="size-5 text-yellow-600" />
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
              <div className="p-2 bg-purple-50 rounded-lg">
                <Package className="size-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'truck' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('truck')}
          >
            Trucks
          </Button>
          <Button
            variant={filter === 'car' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('car')}
          >
            Escort Cars
          </Button>
          <Button
            variant={filter === 'trailer' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('trailer')}
          >
            Trailers
          </Button>
        </div>
      </div>

      {/* Fleet List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div className="grid grid-cols-2 gap-2 text-sm">
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
                <Button size="sm" className="flex-1">
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
    </div>
    );
  }
