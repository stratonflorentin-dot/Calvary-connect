"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { UserRole } from "@/types/roles";
import { isPrimaryOwnerEmail } from "@/lib/supabase";
import { isValidRole, normalizeRole } from "@/lib/user-role-utils";
import { DRIVER_ROUTE_CONFIG } from "@/lib/driver-routes";
import {
  Briefcase,
  BarChart2,
  Building2,
  Users,
  CalendarDays,
} from "lucide-react";

/** Every authenticated role can open the home dashboard and profile. */
const ALL_APP_ROLES: UserRole[] = [
  "CEO",
  "ADMIN",
  "OPERATOR",
  "DRIVER",
  "MECHANIC",
  "ACCOUNTANT",
  "HR",
  "SALESMAN",
  "WAREHOUSE_STAFF",
];

export interface RouteConfig {
  path: string;
  label: string;
  allowedRoles: UserRole[];
  defaultRedirect?: string;
  icon?: any;
  category?: "dashboard" | "logistics" | "fleet" | "finance" | "people" | "system";
}

// Central route configuration
export const ROUTE_CONFIG: RouteConfig[] = [
  {
    path: "/",
    label: "Dashboard",
    allowedRoles: [...ALL_APP_ROLES],
    category: "dashboard",
  },
  // --- Sales ---
  {
    path: "/sales",
    label: "Sales Pipelines",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "ACCOUNTANT", "SALESMAN"],
    icon: Briefcase,
    category: "sales",
  },
  {
    path: "/customers",
    label: "Customers",
    allowedRoles: ["CEO", "ADMIN", "SALESMAN", "ACCOUNTANT"],
    icon: Building2,
    category: "sales",
  },
  // --- Shipments ---
  {
    path: "/trips",
    label: "Shipments & Trips",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "SALESMAN"],
    category: "logistics",
  },
  {
    path: "/trip-history",
    label: "Trip History",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "ACCOUNTANT", "SALESMAN"],
    category: "logistics",
  },
  {
    path: "/bookings",
    label: "Bookings",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "SALESMAN", "ACCOUNTANT"],
    icon: CalendarDays,
    category: "logistics",
  },
  {
    path: "/map",
    label: "Live Fleet Map",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "HR"],
    category: "logistics",
  },
  // --- Fleet & Assets ---
  {
    path: "/fleet",
    label: "Vehicles",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "MECHANIC"],
    category: "fleet",
  },
  {
    path: "/service-requests",
    label: "Maintenance",
    allowedRoles: ["CEO", "ADMIN", "MECHANIC", "OPERATOR"],
    category: "fleet",
  },
  // --- Inventory ---
  {
    path: "/inventory",
    label: "Stock Items",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "MECHANIC", "WAREHOUSE_STAFF"],
    category: "inventory",
  },
  {
    path: "/parts-requests",
    label: "Parts Requests",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "MECHANIC", "WAREHOUSE_STAFF"],
    category: "inventory",
  },
  {
    path: "/fuel-approvals",
    label: "Fuel Management",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "MECHANIC"],
    category: "fleet",
  },

  // --- Accounting ---
  {
    path: "/finance",
    label: "Accounting Ledger",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
  },
  {
    path: "/expenses",
    label: "Expense Tracking",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT", "OPERATOR", "HR"],
    category: "finance",
  },
  {
    path: "/income",
    label: "Revenue Tracking",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT", "SALESMAN"],
    category: "finance",
  },
  // --- Reports ---
  {
    path: "/reports",
    label: "Financial Reports",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT", "HR"],
    icon: BarChart2,
    category: "reports",
  },

  // --- HR ---
  {
    path: "/users",
    label: "All Employees",
    allowedRoles: ["CEO", "ADMIN", "HR"],
    category: "people",
  },
  {
    path: "/drivers",
    label: "Driver Management",
    allowedRoles: ["CEO", "ADMIN", "HR", "OPERATOR"],
    category: "people",
  },
  {
    path: "/allowances",
    label: "Payroll",
    allowedRoles: ["CEO", "ADMIN", "HR", "ACCOUNTANT"],
    category: "people",
  },

  // --- Settings ---
  {
    path: "/audit",
    label: "Audit Trail",
    allowedRoles: ["CEO", "ADMIN"],
    category: "system",
  },
  {
    path: "/ai-insights",
    label: "Company Settings",
    allowedRoles: ["CEO", "ADMIN"],
    category: "system",
  },

  // --- Driver Specific (Hidden from Sidebar Main Menu) ---
  {
    path: "/driver/trips",
    label: "My Trips",
    allowedRoles: ["DRIVER"],
  },
  {
    path: "/driver/fuel",
    label: "Fuel Log",
    allowedRoles: ["DRIVER"],
  },
  {
    path: "/driver/expenses",
    label: "My Expenses",
    allowedRoles: ["DRIVER"],
  },
  {
    path: "/driver/profile",
    label: "Driver Profile",
    allowedRoles: ["DRIVER"],
  },
  {
    path: "/driver/maintenance",
    label: "Report Issue",
    allowedRoles: ["DRIVER"],
  },
  
  // --- Profile & Shared ---
  {
    path: "/notifications",
    label: "Notifications",
    allowedRoles: [...ALL_APP_ROLES],
  },
  {
    path: "/profile",
    label: "My Profile",
    allowedRoles: [...ALL_APP_ROLES],
  },
];

// Role-specific default landing pages
export const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
  CEO: "/",
  ADMIN: "/",
  OPERATOR: "/trips",
  DRIVER: "/",
  MECHANIC: "/service-requests",
  SALESMAN: "/sales",
  ACCOUNTANT: "/finance",
  HR: "/finance",
  WAREHOUSE_STAFF: "/inventory",
};

// Route guard hook
export function useRouteGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: isUserLoading } = useSupabase();
  const { role, isAdmin, isInitialized } = useRole();

  // Enhanced console logging for navigation tracking
  useEffect(() => {
    console.log("Navigated to:", pathname);
  }, [pathname]);

  const checkAccess = useCallback(
    (path: string): boolean => {
      try {
        // Owner (admin email) or CEO/ADMIN role has full access to everything, even during role switching
        const isOwnerOrAdmin =
          isPrimaryOwnerEmail(user?.email) ||
          user?.role === 'ADMIN' ||
          user?.role === 'CEO';

        if (isOwnerOrAdmin) {
          console.log(`[RouteGuard] Owner/Admin access granted for ${path}`);
          return true;
        }

        if (!role) {
          console.warn("[RouteGuard] No role provided for access check");
          return false;
        }

        const route = ROUTE_CONFIG.find((r) => r.path === path);
        if (!route) {
          console.error("Route not found:", path);
          return false;
        }

        const normalizedRole = normalizeRole(String(role));
        if (!normalizedRole) return false;
        const hasAccess = route.allowedRoles.includes(normalizedRole);
        if (!hasAccess) {
          console.warn("Access denied:", role, path);
        }

        return hasAccess;
      } catch (error) {
        console.error("[RouteGuard] Error checking access:", error);
        return false;
      }
    },
    [role, user?.email, user?.role],
  );

  const redirectToDefault = useCallback(
    (userRole: UserRole) => {
      const defaultRoute = ROLE_DEFAULT_ROUTES[userRole];
      console.log(`[RouteGuard] Redirecting ${userRole} to ${defaultRoute}`);
      router.push(defaultRoute);
    },
    [router],
  );

  useEffect(() => {
    if (isUserLoading || !isInitialized) return;

    // Check if admin user (owner) - should always have access, no redirects
    const isAdminUser =
      isPrimaryOwnerEmail(user?.email) ||
      user?.role === 'ADMIN' ||
      user?.role === 'CEO';

    // Admin user should never be redirected, even when switching roles
    if (isAdminUser) {
      console.log("[RouteGuard] Admin user detected, skipping all redirects");
      return;
    }

    if (!user) {
      console.log("[RouteGuard] No user, waiting...");
      return;
    }

    if (!role) {
      console.log("[RouteGuard] No role, waiting...");
      return;
    }

    const hasAccess = checkAccess(pathname);
    console.log(`[RouteGuard] ${pathname} access for ${role}: ${hasAccess}`);

    if (!hasAccess) {
      redirectToDefault(role);
    }
  }, [
    user,
    role,
    pathname,
    isUserLoading,
    isInitialized,
    checkAccess,
    redirectToDefault,
  ]);

  return { hasAccess: checkAccess, redirectToDefault };
}

// Get menu items for role
export function getMenuByRole(
  role: UserRole | null,
  isAdmin: boolean,
  t: Record<string, string>,
  userEmail?: string | null,
  respectRoleSwitch: boolean = false, // ✅ New flag
): RouteConfig[] {
  const normalizedRole =
    role != null ? normalizeRole(String(role)) : null;
  if (!normalizedRole) return [];

  // Owner (admin email) gets full access UNLESS they are previewing another role
  const isOwnerOrAdminEmail = isPrimaryOwnerEmail(userEmail);

  if (
    isOwnerOrAdminEmail &&
    !respectRoleSwitch
  ) {
    console.log("[RouteConfig] Owner gets full menu access");
    return ROUTE_CONFIG;
  }

  // CEO and ADMIN see all routes
  if (normalizedRole === "CEO" || normalizedRole === "ADMIN") {
    return ROUTE_CONFIG;
  }

  if (normalizedRole === "DRIVER") {
    return DRIVER_ROUTE_CONFIG;
  }

  // Others see only their allowed routes
  return ROUTE_CONFIG.filter((route) =>
    route.allowedRoles.includes(normalizedRole),
  );
}

/** Used by the sidebar to hide trip shortcuts for roles without /trips access. */
export function roleHasTripsAccess(role: UserRole | null): boolean {
  const normalized = role != null ? normalizeRole(String(role)) : null;
  if (!normalized) return false;
  if (normalized === "DRIVER") return false;
  const tripRoute = ROUTE_CONFIG.find((r) => r.path === "/trips");
  return !!tripRoute?.allowedRoles.includes(normalized);
}

export { isValidRole, normalizeRole };
