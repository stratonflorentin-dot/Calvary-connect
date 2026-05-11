"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { FleetVehicle } from "@/types/roles";

interface UseFleetVehiclesOptions {
  enabled?: boolean;
  status?: string;
}

export function useFleetVehicles(options: UseFleetVehiclesOptions = {}) {
  const { enabled = true, status } = options;
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("vehicles").select("*");
      if (status) {
        query = query.eq("status", status);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      setVehicles(data || []);
    } catch (err: any) {
      console.error("Error fetching vehicles:", err);
      setError(err.message || "Failed to fetch vehicles");
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, status]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const refresh = () => fetchVehicles();

  return { vehicles, loading, error, refresh };
}
