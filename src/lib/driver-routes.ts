import type { UserRole } from "@/types/roles";
import type { RouteConfig } from "@/lib/route-config";

/** Sidebar and access for DRIVER role only - no fleet-wide admin features.
 *  Every entry MUST have a `category`: the sidebar and mobile bottom nav
 *  filter on it, so an uncategorized route is invisible (this is what made
 *  the driver sidebar render completely empty). */
export const DRIVER_ROUTE_CONFIG: RouteConfig[] = [
  { path: "/", label: "Dashboard", allowedRoles: ["DRIVER"], category: "dashboard" },
  { path: "/driver/trips", label: "My Trips", allowedRoles: ["DRIVER"], category: "logistics" },
  { path: "/proof", label: "Proof of Delivery", allowedRoles: ["DRIVER"], category: "logistics" },
  { path: "/chat", label: "Internal Chat", allowedRoles: ["DRIVER"], category: "logistics" },
  { path: "/driver/fuel", label: "Fuel", allowedRoles: ["DRIVER"], category: "fleet" },
  { path: "/driver/maintenance", label: "Maintenance", allowedRoles: ["DRIVER"], category: "fleet" },
  { path: "/driver/expenses", label: "My Expenses", allowedRoles: ["DRIVER"], category: "finance" },
  { path: "/driver/profile", label: "Driver Profile", allowedRoles: ["DRIVER"], category: "system" },
  { path: "/notifications", label: "Notifications", allowedRoles: ["DRIVER"], category: "system" },
];

export function isDriverRole(role: UserRole | null): boolean {
  return role === "DRIVER";
}
