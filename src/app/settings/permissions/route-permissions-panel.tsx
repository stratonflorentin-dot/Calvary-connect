"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/hooks/use-role";
import { useRouteOverridesContext } from "@/components/route-overrides-provider";
import {
  ROUTE_CONFIG,
  NAVIGATION_CATEGORY_ORDER,
  NAVIGATION_CATEGORY_LABELS,
  type RouteConfig,
} from "@/lib/route-config";
import type { UserRole } from "@/types/roles";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, RotateCcw, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// CEO/ADMIN always have full access (hardcoded in route-config.ts, checked
// before any override) — not shown here since there's nothing to toggle.
const TOGGLEABLE_ROLES: UserRole[] = ["OPERATOR", "DRIVER", "MECHANIC", "ACCOUNTANT", "HR", "SALESMAN", "WAREHOUSE_STAFF"];

// Only routes that actually appear in the sidebar — matches
// getNavigationMenuByRole's own filter, so toggles here map 1:1 to what an
// admin sees change in a test account's nav.
const VISIBLE_ROUTES = ROUTE_CONFIG.filter((r) => r.category && r.showInNavigation !== false);

interface OverrideRow {
  route_path: string;
  allowed_roles: UserRole[];
}

export function RoutePermissionsPanel() {
  const { isAdmin } = useRole();
  const { refetchRouteOverrides } = useRouteOverridesContext();
  const [overrides, setOverrides] = useState<Record<string, UserRole[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingPath, setSavingPath] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Record<string, UserRole[]>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("route_role_overrides").select("route_path, allowed_roles");
    const map: Record<string, UserRole[]> = {};
    for (const row of (data ?? []) as OverrideRow[]) {
      map[row.route_path] = row.allowed_roles;
    }
    setOverrides(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const routesByCategory = useMemo(() => {
    const grouped: Record<string, RouteConfig[]> = {};
    for (const route of VISIBLE_ROUTES) {
      const cat = route.category!;
      (grouped[cat] ??= []).push(route);
    }
    return grouped;
  }, []);

  const effectiveRoles = (route: RouteConfig): UserRole[] =>
    draft[route.path] ?? overrides[route.path] ?? route.allowedRoles;

  const isCustomized = (route: RouteConfig) => overrides[route.path] !== undefined;

  const toggleRole = (route: RouteConfig, role: UserRole) => {
    const current = effectiveRoles(route);
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    setDraft((prev) => ({ ...prev, [route.path]: next }));
  };

  const save = async (route: RouteConfig) => {
    setSavingPath(route.path);
    try {
      const roles = effectiveRoles(route);
      const { error } = await supabase
        .from("route_role_overrides")
        .upsert({ route_path: route.path, allowed_roles: roles, updated_at: new Date().toISOString() }, { onConflict: "route_path" });
      if (error) throw error;
      setOverrides((prev) => ({ ...prev, [route.path]: roles }));
      setDraft((prev) => {
        const { [route.path]: _, ...rest } = prev;
        return rest;
      });
      await refetchRouteOverrides();
    } finally {
      setSavingPath(null);
    }
  };

  const reset = async (route: RouteConfig) => {
    setSavingPath(route.path);
    try {
      await supabase.from("route_role_overrides").delete().eq("route_path", route.path);
      setOverrides((prev) => {
        const { [route.path]: _, ...rest } = prev;
        return rest;
      });
      setDraft((prev) => {
        const { [route.path]: _, ...rest } = prev;
        return rest;
      });
      await refetchRouteOverrides();
    } finally {
      setSavingPath(null);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg p-3">
        Controls sidebar visibility. Direct-URL access isn't blocked by this setting — a few pages
        (e.g. the live fleet map, driver compliance) still enforce their own separate rules.
        CEO and Admin always have full access and aren't shown below.
      </p>
      {NAVIGATION_CATEGORY_ORDER.filter((cat) => routesByCategory[cat]?.length).map((cat) => {
        const routes = routesByCategory[cat];
        const customizedCount = routes.filter(isCustomized).length;
        const isOpen = expanded.has(cat);
        return (
          <div key={cat} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {NAVIGATION_CATEGORY_LABELS[cat]}
              </span>
              <span className="text-xs text-muted-foreground">
                {routes.length} route{routes.length === 1 ? "" : "s"}
                {customizedCount > 0 && ` · ${customizedCount} customized`}
              </span>
            </button>
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-t border-border bg-background">
                      <th className="text-left px-4 py-2 font-bold text-muted-foreground">Route</th>
                      {TOGGLEABLE_ROLES.map((role) => (
                        <th key={role} className="px-2 py-2 font-bold text-muted-foreground text-center">{role}</th>
                      ))}
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((route) => {
                      const roles = effectiveRoles(route);
                      const hasDraft = draft[route.path] !== undefined;
                      return (
                        <tr key={route.path} className="border-t border-border">
                          <td className="px-4 py-2">
                            <p className="font-semibold text-foreground">{route.label}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{route.path}</p>
                          </td>
                          {TOGGLEABLE_ROLES.map((role) => (
                            <td key={role} className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={roles.includes(role)}
                                disabled={!isAdmin}
                                onChange={() => toggleRole(route, role)}
                                className="rounded"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1 justify-end">
                              {isCustomized(route) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  disabled={!isAdmin || savingPath === route.path}
                                  onClick={() => reset(route)}
                                  title="Reset to default"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                className={cn("h-7 px-2", !hasDraft && "opacity-40")}
                                disabled={!isAdmin || !hasDraft || savingPath === route.path}
                                onClick={() => save(route)}
                              >
                                {savingPath === route.path ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
