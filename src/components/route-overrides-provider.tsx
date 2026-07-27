"use client";

import { createContext, useCallback, useContext, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { setRouteOverrides, type RouteOverridesMap } from "@/lib/route-overrides-store";

interface RouteOverridesContextValue {
  refetchRouteOverrides: () => Promise<void>;
}

const RouteOverridesContext = createContext<RouteOverridesContextValue>({
  refetchRouteOverrides: async () => {},
});

export function useRouteOverridesContext() {
  return useContext(RouteOverridesContext);
}

async function fetchOverrides(): Promise<RouteOverridesMap> {
  const { data } = await supabase.from("route_role_overrides").select("route_path, allowed_roles");
  const map: RouteOverridesMap = {};
  for (const row of data ?? []) {
    map[row.route_path] = row.allowed_roles;
  }
  return map;
}

/** Fetches DB-backed route role overrides once authenticated, and keeps route-overrides-store.ts in sync. */
export function RouteOverridesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabase();

  const refetchRouteOverrides = useCallback(async () => {
    setRouteOverrides(await fetchOverrides());
  }, []);

  useEffect(() => {
    if (!user) return;
    refetchRouteOverrides();
  }, [user, refetchRouteOverrides]);

  return (
    <RouteOverridesContext.Provider value={{ refetchRouteOverrides }}>
      {children}
    </RouteOverridesContext.Provider>
  );
}
