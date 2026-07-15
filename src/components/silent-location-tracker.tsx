"use client";

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { upsertDriverLocationAction } from "@/app/tracking/actions";
import { isValidCoordinate } from "@/lib/geo-utils";

/** Maximum acceptable accuracy in metres. Readings above this are rejected on ALL paths. */
const MAX_ACCURACY_METERS = 100;

/** Minimum milliseconds between location updates under normal conditions. */
const MIN_UPDATE_INTERVAL_MS = 5000;

/** High-quality threshold — below this, we protect recent readings from being overwritten. */
const HIGH_QUALITY_ACCURACY_M = 30;

/** Heartbeat interval. watchPosition only fires on movement, so a stationary
 *  driver stops writing and goes "offline" on the map after 120s. Re-saving
 *  the last good fix keeps last_updated fresh while the app is open. */
const HEARTBEAT_INTERVAL_MS = 45000;

interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  heading: number | null;
}

export function SilentLocationTracker() {
  const { user } = useSupabase();
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastAccuracyRef = useRef<number>(9999);
  const savingRef = useRef(false);
  const lastGoodPositionRef = useRef<GeoPosition | null>(null);

  const saveLocation = useCallback(
    async (pos: GeoPosition, force = false) => {
      if (!user?.id || savingRef.current) return;

      // 1. Validate coordinate range and null island
      if (!isValidCoordinate(pos.latitude, pos.longitude)) {
        console.warn("[GPS] Invalid coordinates rejected:", pos.latitude, pos.longitude);
        return;
      }

      // 2. Reject ALL readings above the 100m accuracy threshold — on EVERY path.
      //    This prevents network/IP geolocation (50,000m+) from being stored as GPS.
      if (pos.accuracy > MAX_ACCURACY_METERS) {
        console.warn(
          `[GPS] Reading rejected: accuracy ${Math.round(pos.accuracy)}m exceeds ` +
          `${MAX_ACCURACY_METERS}m limit. ` +
          `This is likely a network/IP geolocation estimate, not real GPS. ` +
          `Waiting for real GPS fix...`
        );
        return;
      }

      // Passed coordinate + accuracy validation — remember it for the heartbeat.
      lastGoodPositionRef.current = pos;

      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;

      // 3. Protect recent high-quality readings from being overwritten by worse readings
      if (
        !force &&
        timeSinceLastUpdate < 30000 &&
        lastAccuracyRef.current <= HIGH_QUALITY_ACCURACY_M &&
        pos.accuracy > lastAccuracyRef.current * 2
      ) {
        console.warn(
          `[GPS] Reading skipped: new accuracy ${Math.round(pos.accuracy)}m is worse than ` +
          `last accuracy ${Math.round(lastAccuracyRef.current)}m (protected for 30s)`
        );
        return;
      }

      // 4. Rate-limit non-forced updates to once per 5 seconds
      if (!force && timeSinceLastUpdate < MIN_UPDATE_INTERVAL_MS) return;

      lastUpdateRef.current = now;
      lastAccuracyRef.current = pos.accuracy;
      savingRef.current = true;

      console.log(
        `[GPS] Saving position: lat=${pos.latitude.toFixed(6)}, lng=${pos.longitude.toFixed(6)}, ` +
        `accuracy=±${Math.round(pos.accuracy)}m, speed=${pos.speed ?? "—"} m/s, heading=${pos.heading ?? "—"}°`
      );

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const authId = sessionData.session?.user?.id;

        if (token) {
          // Primary path: server action with full server-side coordinate + FK validation
          await upsertDriverLocationAction(token, {
            latitude: pos.latitude,
            longitude: pos.longitude,
            accuracy: pos.accuracy,
            altitude: pos.altitude,
            altitude_accuracy: pos.altitudeAccuracy,
            speed: pos.speed,
            heading: pos.heading,
            is_active: true,
          });
          return;
        }

        // Fallback path: direct Supabase client — accuracy guard MUST run here too
        if (authId) {
          // Redundant guard — ensures the fallback path never writes poor-quality data
          if (pos.accuracy > MAX_ACCURACY_METERS) {
            console.warn("[GPS] Fallback path: accuracy check failed, write suppressed.");
            return;
          }

          await supabase.from("driver_locations").upsert(
            {
              driver_id: authId,
              latitude: pos.latitude,
              longitude: pos.longitude,
              accuracy: pos.accuracy,
              altitude: pos.altitude,
              altitude_accuracy: pos.altitudeAccuracy,
              speed: pos.speed,
              heading: pos.heading,
              is_active: true,
              last_updated: new Date().toISOString(),
            },
            { onConflict: "driver_id" },
          );
        }
      } catch (err) {
        console.error("[GPS] Failed to save driver location:", err);
      } finally {
        savingRef.current = false;
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;

    const geo = navigator.geolocation;
    if (!geo) {
      console.warn("[GPS] Geolocation is not supported by this browser.");
      return;
    }

    const handleError = (err: GeolocationPositionError) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          console.error(
            "[GPS] PERMISSION_DENIED — Driver must allow location access for fleet tracking. " +
            "No fallback coordinates will be used."
          );
          break;
        case err.POSITION_UNAVAILABLE:
          console.warn(
            "[GPS] POSITION_UNAVAILABLE — GPS signal is blocked or unavailable. " +
            "Waiting for a real GPS fix..."
          );
          break;
        case err.TIMEOUT:
          console.warn(
            "[GPS] TIMEOUT — GPS took too long. Will retry via watchPosition..."
          );
          break;
        default:
          console.error("[GPS] Unknown geolocation error:", err.message);
      }
    };

    // Capture initial position with high accuracy (maximumAge: 0 = no cache)
    geo.getCurrentPosition(
      (pos) =>
        saveLocation(
          {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            altitudeAccuracy: pos.coords.altitudeAccuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          },
          true, // force=true: bypass rate-limiting for the initial position
        ),
      handleError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    // Watch position continuously with strict high-accuracy configuration
    watchIdRef.current = geo.watchPosition(
      (pos) =>
        saveLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
        }),
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    // Heartbeat: re-save the last good fix when watchPosition has been quiet
    // (stationary vehicle) so the driver stays "online" on the fleet map.
    const heartbeat = setInterval(() => {
      const last = lastGoodPositionRef.current;
      if (!last) return;
      if (Date.now() - lastUpdateRef.current < HEARTBEAT_INTERVAL_MS) return;
      saveLocation(last, true);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeat);
      if (watchIdRef.current !== null) geo.clearWatch(watchIdRef.current);
      // Mark driver as inactive when component unmounts
      supabase
        .from("driver_locations")
        .update({ is_active: false, last_updated: new Date().toISOString() })
        .eq("driver_id", user.id)
        .then(() => {});
    };
  }, [user, saveLocation]);

  return null;
}
