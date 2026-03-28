"use client";

import { useSupabase } from '@/components/supabase-provider';
import { useMemo, useState, useEffect } from 'react';
import { StatCards } from './stat-cards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Trash2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

export function CeoView() {
  const { user } = useSupabase();
  const { t } = useLanguage();

  // Real data from Supabase
  const [fleetData, setFleetData] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        // Fetch real vehicles
        const { data: vehiclesData } = await supabase
          .from('vehicles')
          .select('*');
        
        // Fetch real trips
        const { data: tripsData } = await supabase
          .from('trips')
          .select('*')
          .order('created_at', { ascending: false });

        if (!vehiclesData || !tripsData) {
          setVehicles([]);
          setTrips([]);
          return;
        }

        setVehicles(vehiclesData);
        setTrips(tripsData);
        
      } catch (error) {
        console.error('Error fetching real data:', error);
        setVehicles([]);
        setTrips([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRealData();
  }, [user]);

  const deleteVehicle = async (vehicleId: string) => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId);
      
      if (error) throw error;
      
      // Refresh data
      const { data: updatedVehicles } = await supabase
        .from('vehicles')
        .select('*');
      setVehicles(updatedVehicles || []);
      
    } catch (error: any) {
      console.error('Error deleting vehicle:', error);
      alert('Error deleting vehicle: ' + error.message);
    }
  };

  const deleteTrip = async (tripId: string) => {
    try {
      const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', tripId);
      
      if (error) throw error;
      
      // Refresh data
      const { data: updatedTrips } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false });
      setTrips(updatedTrips || []);
      
    } catch (error: any) {
      console.error('Error deleting trip:', error);
      alert('Error deleting trip: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading real data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CEO Dashboard</h1>
          <p className="text-muted-foreground">Fleet overview and operations management</p>
        </div>
      </div>

      <StatCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicle Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5" />
              Fleet Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold">Quick Actions</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const origin = prompt('Trip Origin:', 'Nairobi');
                      const destination = prompt('Trip Destination:', 'Mombasa');
                      if (origin && destination) {
                        // Add trip logic here
                        console.log('Adding trip:', { origin, destination });
                      }
                    }}
                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Add Trip
                  </button>
                  <button
                    onClick={() => {
                      const plate = prompt('Vehicle Plate Number:', 'ABC-123');
                      const make = prompt('Vehicle Make:', 'Toyota');
                      const model = prompt('Vehicle Model:', 'Hilux');
                      const year = prompt('Vehicle Year:', '2022');
                      const type = prompt('Vehicle Type (TRUCK, TRAILER, ESCORT_CAR, HOSE):', 'TRUCK');
                      
                      if (plate && make && model && year && type) {
                        // Add vehicle logic here
                        console.log('Adding vehicle:', { plate, make, model, year, type });
                      }
                    }}
                    className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Add Vehicle
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-bold mb-4">Vehicles ({vehicles.length})</h4>
                {vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <div>
                        <p className="font-medium">{vehicle.make} {vehicle.model}</p>
                        <p className="text-sm text-muted-foreground">
                          Plate: {vehicle.plate_number} | Year: {vehicle.year} | Type: {vehicle.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={vehicle.status === 'available' ? 'secondary' : 'default'}>
                        {vehicle.status}
                      </Badge>
                      <button
                        onClick={() => deleteVehicle(vehicle.id)}
                        className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trip Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5" />
              Trip Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold">Quick Actions</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const origin = prompt('Trip Origin:', 'Nairobi');
                      const destination = prompt('Trip Destination:', 'Mombasa');
                      if (origin && destination) {
                        // Add trip logic here
                        console.log('Adding trip:', { origin, destination });
                      }
                    }}
                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Add Trip
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-bold mb-4">Trips ({trips.length})</h4>
                {trips.map((trip) => (
                  <div key={trip.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <div>
                        <p className="font-medium">{trip.origin} → {trip.destination}</p>
                        <p className="text-sm text-muted-foreground">
                          Status: {trip.status} | Created: {new Date(trip.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={trip.status === 'PENDING' ? 'secondary' : 'default'}>
                        {trip.status}
                      </Badge>
                      <button
                        onClick={() => deleteTrip(trip.id)}
                        className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
