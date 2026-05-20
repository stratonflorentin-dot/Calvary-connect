import type { UserRole } from "@/types/roles";
import type { RouteConfig } from "@/lib/route-config";

/** Sidebar and access for DRIVER role only — no fleet-wide admin features. */
export const DRIVER_ROUTE_CONFIG: RouteConfig[] = [
  { path: "/", label: "Dashboard", allowedRoles: ["DRIVER"] },
  { path: "/driver/trips", label: "My Trips", allowedRoles: ["DRIVER"] },
  { path: "/proof", label: "Proof of Delivery", allowedRoles: ["DRIVER"] },
  { path: "/driver/fuel", label: "Fuel", allowedRoles: ["DRIVER"] },
  { path: "/driver/expenses", label: "My Expenses", allowedRoles: ["DRIVER"] },
  { path: "/driver/maintenance", label: "Maintenance", allowedRoles: ["DRIVER"] },
  { path: "/driver/profile", label: "Driver Profile", allowedRoles: ["DRIVER"] },
  { path: "/notifications", label: "Notifications", allowedRoles: ["DRIVER"] },
];

export function isDriverRole(role: UserRole | null): boolean {
  return role === "DRIVER";
}
