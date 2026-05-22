"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export function useQuotations() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("route_quotations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setQuotations(data || []);
    } catch (err: any) {
      console.error("Error fetching quotations:", err);
      setError(err.message || "Failed to fetch quotations");
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  return { quotations, loading, error, refresh: fetchQuotations };
}
