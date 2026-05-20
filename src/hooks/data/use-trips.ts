"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Trip } from "@/types/roles";
import { useSupabase } from "@/components/supabase-provider";

interface UseTripsOptions {
  enabled?: boolean;
  status?: string;
  driverId?: string;
}

export function useTrips(options: UseTripsOptions = {}) {
  const { enabled = true, status, driverId } = options;
  const { user } = useSupabase();
  const resolvedDriverId =
    driverId === "current" ? user?.id : driverId;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("trips").select("*");
      if (status) query = query.eq("status", status);
      if (resolvedDriverId) query = query.eq("driver_id", resolvedDriverId);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      setTrips(data || []);
    } catch (err: any) {
      console.error("Error fetching trips:", err);
      setError(err.message || "Failed to fetch trips");
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, status, resolvedDriverId]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const refresh = () => fetchTrips();

  return { trips, loading, error, refresh };
}
