'use client';

import { useState, useEffect } from 'react';
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
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No active drivers currently</p>
            <p className="text-sm">Drivers will appear here when they enable location tracking</p>
          </div>
        ) : (
          <div className="space-y-4">
            {locations.map((location) => (
              <div
                key={location.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {location.driver?.name || 'Unknown Driver'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {location.driver?.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(location.last_updated).toLocaleTimeString()}
                  </p>
                  {location.speed !== null && (
                    <p className="text-xs text-muted-foreground">
                      Speed: {(location.speed * 3.6).toFixed(1)} km/h
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Simple Map Placeholder - Replace with actual map integration */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            📍 Map integration coming soon. Contact support to enable Google Maps or Mapbox integration.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
