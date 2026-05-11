"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface UseMaintenanceRequestsOptions {
  enabled?: boolean;
  status?: string;
}

export function useMaintenanceRequests(options: UseMaintenanceRequestsOptions = {}) {
  const { enabled = true, status } = options;
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("maintenance_requests").select("*");
      if (status) query = query.eq("status", status);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (err: any) {
      console.error("Error fetching maintenance requests:", err);
      setError(err.message || "Failed to fetch maintenance requests");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, status]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const refresh = () => fetchRequests();

  return { requests, loading, error, refresh };
}
