'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/components/supabase-provider';

interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
}

interface UseGeolocationOptions {
  enabled?: boolean;
  interval?: number; // milliseconds
  onError?: (error: GeolocationPositionError) => void;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const { enabled = true, interval = 30000, onError } = options;
  const { user } = useSupabase();
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('prompt');

  // Check permission status
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    
    navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
      setPermissionStatus(result.state);
      result.addEventListener('change', () => {
        setPermissionStatus(result.state);
      });
    });
  }, []);

  // Get current position
  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const position = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          };
          setPosition(position);
          resolve(position);
        },
        (err) => {
          setError(err);
          onError?.(err);
          reject(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, [onError]);

  // Start tracking
  const startTracking = useCallback(async () => {
    if (!user || !enabled) return;

    try {
      setIsTracking(true);
      const position = await getCurrentPosition();
      
      // Save to Supabase
      await saveLocationToDatabase(position);
    } catch (err) {
      setIsTracking(false);
      console.error('Error starting tracking:', err);
    }
  }, [user, enabled, getCurrentPosition]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    setIsTracking(false);
  }, []);

  // Save location to database
  const saveLocationToDatabase = async (pos: GeolocationPosition) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: user.id,
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          speed: pos.speed,
          heading: pos.heading,
          is_active: true,
          last_updated: new Date().toISOString(),
        }, {
          onConflict: 'driver_id'
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving location:', err);
    }
  };

  // Continuous tracking with interval
  useEffect(() => {
    if (!isTracking || !enabled) return;

    const track = async () => {
      try {
        const pos = await getCurrentPosition();
        await saveLocationToDatabase(pos);
      } catch (err) {
        console.error('Tracking error:', err);
      }
    };

    // Track immediately
    track();

    // Set up interval
    const intervalId = setInterval(track, interval);

    return () => clearInterval(intervalId);
  }, [isTracking, enabled, interval, getCurrentPosition, user]);

  // Set inactive when component unmounts
  useEffect(() => {
    return () => {
      if (user) {
        supabase
          .from('driver_locations')
          .update({ is_active: false })
          .eq('driver_id', user.id)
          .then(() => {});
      }
    };
  }, [user]);

  return {
    position,
    error,
    isTracking,
    permissionStatus,
    startTracking,
    stopTracking,
    getCurrentPosition,
  };
}
