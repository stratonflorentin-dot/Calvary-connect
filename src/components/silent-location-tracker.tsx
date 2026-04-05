'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/components/supabase-provider';

interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
}

export function SilentLocationTracker() {
  const { user } = useSupabase();
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const [debug, setDebug] = useState<string>('');

  const saveLocation = useCallback(async (pos: GeoPosition) => {
    if (!user?.id) return;

    // Rate limit: don't save more than once every 10 seconds
    const now = Date.now();
    if (now - lastUpdateRef.current < 10000) return;
    lastUpdateRef.current = now;

    console.log('[SilentLocationTracker] Saving location for', user.id, ':', pos.latitude, pos.longitude);

    try {
      const { data, error } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: user.id,
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          speed: pos.speed,
          heading: pos.heading,
          is_online: true,
          last_updated: new Date().toISOString(),
        }, {
          onConflict: 'driver_id'
        })
        .select();

      if (error) {
        console.error('[SilentLocationTracker] Supabase error:', error);
        setDebug(`DB Error: ${error.message}`);
      } else {
        console.log('[SilentLocationTracker] Location saved successfully:', data);
        setDebug(`Saved: ${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)} at ${new Date().toLocaleTimeString()}`);
      }
    } catch (err: any) {
      console.error('[SilentLocationTracker] Save error:', err);
      setDebug(`Error: ${err?.message || 'Unknown'}`);
    }
  }, [user]);

  // Mark driver online when component mounts
  useEffect(() => {
    if (!user?.id) return;
    
    // Mark as online immediately
    supabase
      .from('driver_locations')
      .upsert({
        driver_id: user.id,
        is_online: true,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'driver_id' })
      .then(({ error }) => {
        if (error) console.error('[SilentLocationTracker] Failed to mark online:', error);
        else console.log('[SilentLocationTracker] Marked online on mount');
      });

    return () => {
      if (user?.id) {
        supabase
          .from('driver_locations')
          .update({ is_online: false })
          .eq('driver_id', user.id)
          .then(() => console.log('[SilentLocationTracker] Marked offline'));
      }
    };
  }, [user]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;

    const geo = navigator.geolocation;
    if (!geo) {
      console.error('[SilentLocationTracker] Geolocation not supported');
      setDebug('Geolocation not supported');
      return;
    }

    console.log('[SilentLocationTracker] Starting for user:', user.id);
    setDebug('Starting...');

    // Try to get initial position
    geo.getCurrentPosition(
      (pos) => {
        console.log('[SilentLocationTracker] Initial position obtained');
        saveLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
        });
      },
      (err) => {
        console.warn('[SilentLocationTracker] Initial position failed:', err.message);
        setDebug(`Permission denied or error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
    );

    // Set up watch for continuous updates
    watchIdRef.current = geo.watchPosition(
      (pos) => {
        saveLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
        });
      },
      (err) => {
        console.warn('[SilentLocationTracker] Watch error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );

    // Fallback interval update every 20 seconds
    intervalRef.current = setInterval(() => {
      geo.getCurrentPosition(
        (pos) => saveLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
        }),
        () => {}, // Silent fail
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
      );
    }, 20000);

    return () => {
      if (watchIdRef.current !== null) {
        geo.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, saveLocation]);

  // Invisible component - no UI rendered
  return null;
}
