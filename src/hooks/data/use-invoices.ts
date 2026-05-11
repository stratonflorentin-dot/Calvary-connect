"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface UseInvoicesOptions {
  enabled?: boolean;
  status?: string;
}

export function useInvoices(options: UseInvoicesOptions = {}) {
  const { enabled = true, status } = options;
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("invoices").select("*");
      if (status) query = query.eq("status", status);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (err: any) {
      console.error("Error fetching invoices:", err);
      setError(err.message || "Failed to fetch invoices");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, status]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const refresh = () => fetchInvoices();

  return { invoices, loading, error, refresh };
}
