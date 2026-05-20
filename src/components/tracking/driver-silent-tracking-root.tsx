"use client";

import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { SilentLocationTracker } from "@/components/silent-location-tracker";

/** Invisible background GPS for drivers only — no UI. */
export function DriverSilentTrackingRoot() {
  const { user } = useSupabase();
  const { role, isLoading } = useRole();

  const isDriver =
    role === "DRIVER" || String(user?.role || "").toUpperCase() === "DRIVER";

  if (isLoading || !user || !isDriver) return null;
  return <SilentLocationTracker />;
}
