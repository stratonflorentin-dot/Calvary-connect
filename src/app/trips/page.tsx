"use client";

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { useRole } from '@/hooks/use-role';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Route, Plus } from 'lucide-react';

export default function TripsPage() {
  const { role, isInitialized } = useRole();
  const { user, isLoading: isUserLoading } = useSupabase();
  const [trips, setTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Wait for auth and role to be initialized
    if (isUserLoading || !isInitialized) {
      console.log('[TripsPage] Waiting for auth/role initialization...');
      return;
    }

    const loadData = async () => {
      if (!user) {
        console.log('[TripsPage] No user found, skipping data load');
        setIsLoading(false);
        return;
      }
      
      console.log('[TripsPage] Loading data for user:', user.email, 'role:', role);
      setIsLoading(true);
      
      try {
        const { data: tripsData, error: tripsError } = await supabase
          .from('trips')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (tripsError) {
          console.error('[TripsPage] Error loading trips:', tripsError?.message);
        }
        
        console.log('[TripsPage] Data loaded:', { tripsData: tripsData?.length || 0 });
        
        setTrips(tripsData || []);
      } catch (error) {
        console.error('[TripsPage] Error in loadData:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [user, role, isUserLoading, isInitialized]);

  if (!user) {
    return (
      <div className="flex min-h-screen bg-background p-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to access Trips page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Trips Management</h1>
            <p className="text-muted-foreground">Manage and monitor all fleet trips</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Trip
          </Button>
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
              </div>
            ) : (
              <div className="space-y-4">
                {trips.map((trip) => (
                  <div key={trip.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{trip.origin} → {trip.destination}</h3>
                        <p className="text-sm text-muted-foreground">Status: {trip.status}</p>
                      </div>
                      <Badge variant={trip.status === 'COMPLETED' ? 'default' : 'secondary'}>
                        {trip.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
