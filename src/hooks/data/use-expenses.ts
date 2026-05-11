"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Expense } from "@/types/roles";

interface UseExpensesOptions {
  enabled?: boolean;
  category?: string;
  status?: string;
}

export function useExpenses(options: UseExpensesOptions = {}) {
  const { enabled = true, category, status } = options;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("expenses").select("*");
      if (category) query = query.eq("category", category);
      if (status) query = query.eq("status", status);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      setExpenses(data || []);
    } catch (err: any) {
      console.error("Error fetching expenses:", err);
      setError(err.message || "Failed to fetch expenses");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, category, status]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const refresh = () => fetchExpenses();

  return { expenses, loading, error, refresh };
}
