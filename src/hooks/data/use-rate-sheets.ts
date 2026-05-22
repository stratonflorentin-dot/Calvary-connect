"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export function useRateSheets() {
  const [rateSheets, setRateSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRateSheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("rate_sheets")
        .select("*")
        .order("route_name");
      if (error) throw error;
      setRateSheets(data || []);
    } catch (err: any) {
      console.error("Error fetching rate sheets:", err);
      setError(err.message || "Failed to fetch rate sheets");
      setRateSheets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRateSheets();
  }, [fetchRateSheets]);

  return { rateSheets, loading, error, refresh: fetchRateSheets };
}
