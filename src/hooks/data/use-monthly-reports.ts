"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface UseMonthlyReportsOptions {
  enabled?: boolean;
}

export function useMonthlyReports(options: UseMonthlyReportsOptions = {}) {
  const { enabled = true } = options;
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("monthly_reports")
        .select("*")
        .order("month", { ascending: false });
      if (error) throw error;
      setReports(data || []);
    } catch (err: any) {
      console.error("Error fetching monthly reports:", err);
      setError(err.message || "Failed to fetch reports");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const refresh = () => fetchReports();

  return { reports, loading, error, refresh };
}
