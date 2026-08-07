"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface AgentActivityItem {
  kind: "run" | "chat";
  id: string;
  agentId: string;
  status: "ok" | "error";
  text: string;
  createdAt: string;
}

export function useAiAgentActivity() {
  const [items, setItems] = useState<AgentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch("/api/ai-agents/activity", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch activity");
      setItems(json.items || []);
    } catch (err: any) {
      console.error("Error fetching AI agent activity:", err);
      setError(err.message || "Failed to fetch activity");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return { items, loading, error, refresh: fetchActivity };
}
