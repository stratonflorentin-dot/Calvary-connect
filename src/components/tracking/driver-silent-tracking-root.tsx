"use client";

import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { SilentLocationTracker } from "@/components/silent-location-tracker";

/** Invisible background GPS for drivers only — no UI. */
export function DriverSilentTrackingRoot() {
  const { user } = useSupabase();
  const { role, isLoading } = useRole();

  if (isLoading || !user || role !== "DRIVER") return null;
  return <SilentLocationTracker />;
}
