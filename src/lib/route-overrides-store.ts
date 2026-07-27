import { useSyncExternalStore } from "react";
import type { UserRole } from "@/types/roles";

/**
 * Module-level store for DB-backed route role overrides (Settings → Role
 * Permissions). Kept outside React state so route-config.ts's existing
 * exported functions (useRouteGuard, getMenuByRole, roleHasTripsAccess) can
 * read the current overrides synchronously without changing their
 * signatures or threading a value through their ~66+ call sites — only
 * `route-overrides-provider.tsx` writes to this store, once, after fetching
 * from Supabase.
 */

export type RouteOverridesMap = Record<string, UserRole[]>;

let currentOverrides: RouteOverridesMap = {};
const listeners = new Set<() => void>();

export function setRouteOverrides(map: RouteOverridesMap) {
  currentOverrides = map;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentOverrides;
}

/** Live-updating hook for components that need to re-render on override changes (e.g. the sidebar). */
export function useRouteOverridesSnapshot(): RouteOverridesMap {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** The one function route-config.ts's role checks should funnel through. */
export function getEffectiveAllowedRoles(route: { path: string; allowedRoles: UserRole[] }): UserRole[] {
  return currentOverrides[route.path] ?? route.allowedRoles;
}
