'use client';

import { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/use-role';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Navigation, Loader2 } from 'lucide-react';

interface DriverLocation {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  is_active: boolean;
  last_updated: string;
  driver?: {
    name: string;
    email: string;
    avatar_url?: string;
  };
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export function DriverLocationMap() {
  const { role } = useRole();
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDrivers, setActiveDrivers] = useState(0);

  useEffect(() => {
    // Only CEO, Admin, HR, and Operators can view
    if (!['CEO', 'ADMIN', 'HR', 'OPERATOR'].includes(role || '')) return;

    fetchDriverLocations();

    // Subscribe to real-time location updates
    const subscription = supabase
      .channel('driver_locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
        },
        () => {
          fetchDriverLocations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [role]);

  const fetchDriverLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_locations')
        .select(`
          *,
          driver:user_profiles(name, email, avatar_url)
        `)
        .eq('is_active', true)
        .order('last_updated', { ascending: false });

      if (error) throw error;

      setLocations(data || []);
      setActiveDrivers(data?.length || 0);
    } catch (error) {
      console.error('Error fetching driver locations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Live Driver Locations
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time tracking of active drivers
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Users className="h-3 w-3" />
          {activeDrivers} Active
        </Badge>
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground h-[400px] flex flex-col items-center justify-center">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No active drivers currently</p>
            <p className="text-sm">Drivers will appear here when they enable location tracking</p>
          </div>
        ) : (
          <>
            {/* Google Map */}
            <div className="h-[400px] w-full rounded-lg overflow-hidden border">
              <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                <Map
                  defaultCenter={{
                    lat: locations[0]?.latitude || -6.7924,
                    lng: locations[0]?.longitude || 39.2083,
                  }}
                  defaultZoom={12}
                  gestureHandling={'greedy'}
                  disableDefaultUI={false}
                >
                  {locations.map((location) => (
                    <AdvancedMarker
                      key={location.id}
                      position={{
                        lat: location.latitude,
                        lng: location.longitude,
                      }}
                      title={location.driver?.name || 'Unknown Driver'}
                    >
                      <Pin
                        background={'#10B981'}
                        borderColor={'#059669'}
                        glyphColor={'#FFFFFF'}
                        glyph={location.driver?.name?.charAt(0).toUpperCase() || 'D'}
                      />
                    </AdvancedMarker>
                  ))}
                </Map>
              </APIProvider>
            </div>

            {/* Driver list below map */}
            <div className="mt-6 space-y-4">
              <h3 className="font-medium">Active Drivers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 border-2 border-background" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {location.driver?.name || 'Unknown Driver'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{new Date(location.last_updated).toLocaleTimeString()}</p>
                      {location.speed !== null && (
                        <p>{(location.speed * 3.6).toFixed(0)} km/h</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
