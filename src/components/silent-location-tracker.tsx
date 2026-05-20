"use client";

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { upsertDriverLocationAction } from "@/app/tracking/actions";

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const savingRef = useRef(false);

  const saveLocation = useCallback(
    async (pos: GeoPosition, force = false) => {
      if (!user?.id || savingRef.current) return;

      const now = Date.now();
      if (!force && now - lastUpdateRef.current < 15000) return;
      lastUpdateRef.current = now;
      savingRef.current = true;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const authId = sessionData.session?.user?.id;

        if (token) {
          await upsertDriverLocationAction(token, {
            latitude: pos.latitude,
            longitude: pos.longitude,
            accuracy: pos.accuracy,
            speed: pos.speed,
            heading: pos.heading,
            is_active: true,
          });
          return;
        }

        if (authId) {
          await supabase.from("driver_locations").upsert(
            {
              driver_id: authId,
              latitude: pos.latitude,
              longitude: pos.longitude,
              accuracy: pos.accuracy,
              speed: pos.speed,
              heading: pos.heading,
              is_active: true,
              last_updated: new Date().toISOString(),
            },
            { onConflict: "driver_id" },
          );
        }
      } finally {
        savingRef.current = false;
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;

    const geo = navigator.geolocation;
    if (!geo) return;

    geo.getCurrentPosition(
      (pos) =>
        saveLocation(
          {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          },
          true,
        ),
      () => {},
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 120000 },
    );

    watchIdRef.current = geo.watchPosition(
      (pos) =>
        saveLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
        }),
      () => {},
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 15000 },
    );

    intervalRef.current = setInterval(() => {
      geo.getCurrentPosition(
        (pos) =>
          saveLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          }),
        () => {},
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
      );
    }, 30000);

    return () => {
      if (watchIdRef.current !== null) geo.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      supabase
        .from("driver_locations")
        .update({ is_active: false, last_updated: new Date().toISOString() })
        .eq("driver_id", user.id)
        .then(() => {});
    };
  }, [user, saveLocation]);

  return null;
}
