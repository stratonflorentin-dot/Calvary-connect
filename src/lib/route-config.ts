"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { UserRole } from "@/types/roles";
import { ADMIN_EMAIL } from "@/lib/supabase";

export interface RouteConfig {
  path: string;
  label: string;
  allowedRoles: UserRole[];
  defaultRedirect?: string;
}

// Central route configuration
export const ROUTE_CONFIG: RouteConfig[] = [
  { path: "/", label: "Dashboard", allowedRoles: ["CEO", "ADMIN", "OPERATOR", "DRIVER", "MECHANIC", "ACCOUNTANT", "HR"] },
  { path: "/fleet", label: "Fleet", allowedRoles: ["CEO", "ADMIN", "OPERATOR", "DRIVER", "MECHANIC"] },
  { path: "/trips", label: "Trips", allowedRoles: ["CEO", "ADMIN", "OPERATOR", "DRIVER"] },
  { path: "/expenses", label: "Expenses", allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"] },
  { path: "/income", label: "Income", allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"] },
  { path: "/fuel-approvals", label: "Fuel Approvals", allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT", "OPERATOR"] },
  { path: "/allowances", label: "Allowances", allowedRoles: ["CEO", "ADMIN", "HR", "ACCOUNTANT"] },
  { path: "/reports", label: "Monthly Report", allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT", "HR"] },
  { path: "/monthly-report", label: "Monthly Report", allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT", "HR"] },
  { path: "/users", label: "Users", allowedRoles: ["CEO", "ADMIN", "HR"] },
  { path: "/inventory", label: "Inventory", allowedRoles: ["CEO", "ADMIN", "OPERATOR", "MECHANIC"] },
  { path: "/parts-requests", label: "Parts Requests", allowedRoles: ["CEO", "ADMIN", "OPERATOR", "MECHANIC"] },
  { path: "/spare-parts", label: "Spare Parts", allowedRoles: ["CEO", "ADMIN", "MECHANIC"] },
  { path: "/service-requests", label: "Service Requests", allowedRoles: ["CEO", "ADMIN", "MECHANIC", "DRIVER"] },
  { path: "/truck-history", label: "Truck History", allowedRoles: ["CEO", "ADMIN", "MECHANIC", "DRIVER", "OPERATOR"] },
  { path: "/map", label: "Fleet Map", allowedRoles: ["CEO", "ADMIN", "OPERATOR", "DRIVER"] },
  { path: "/proof", label: "Proof of Delivery", allowedRoles: ["CEO", "ADMIN", "DRIVER"] },
  { path: "/report", label: "Report Maintenance", allowedRoles: ["CEO", "ADMIN", "DRIVER", "MECHANIC"] },
  { path: "/finance", label: "Finance", allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"] },
  { path: "/ai-insights", label: "AI Insights", allowedRoles: ["CEO", "ADMIN"] },
  { path: "/audit", label: "Audit Log", allowedRoles: ["CEO", "ADMIN"] },
  { path: "/notifications", label: "Notifications", allowedRoles: ["CEO", "ADMIN", "OPERATOR", "DRIVER", "MECHANIC", "ACCOUNTANT", "HR"] },
];

// Role-specific default landing pages
export const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
  CEO: "/",
  ADMIN: "/",
  OPERATOR: "/trips",
  DRIVER: "/trips",
  MECHANIC: "/service-requests",
  ACCOUNTANT: "/finance",
  HR: "/users",
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
        // Owner (admin email) has full access to everything, even during role switching
        if (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          console.log(`[RouteGuard] Owner access granted for ${path}`);
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

        const hasAccess = route.allowedRoles.includes(role);
        if (!hasAccess) {
          console.warn("Access denied:", role, path);
        }
        
        return hasAccess;
      } catch (error) {
        console.error("[RouteGuard] Error checking access:", error);
        return false;
      }
    },
    [role, user?.email]
  );

  const redirectToDefault = useCallback(
    (userRole: UserRole) => {
      const defaultRoute = ROLE_DEFAULT_ROUTES[userRole];
      console.log(`[RouteGuard] Redirecting ${userRole} to ${defaultRoute}`);
      router.push(defaultRoute);
    },
    [router]
  );

  useEffect(() => {
    if (isUserLoading || !isInitialized) return;

    // Check if admin user (owner) - should always have access, no redirects
    const isAdminUser = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    
    if (!user && !isAdminUser) {
      console.log("[RouteGuard] No user, redirecting to /login");
      // router.push("/login");
      return;
    }

    // Admin user should never be redirected, even without role
    if (isAdminUser) {
      console.log("[RouteGuard] Admin user detected, skipping all redirects");
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
  }, [user, role, pathname, isUserLoading, isInitialized, checkAccess, redirectToDefault]);

  return { hasAccess: checkAccess, redirectToDefault };
}

// Get menu items for role
export function getMenuByRole(
  role: UserRole | null,
  isAdmin: boolean,
  t: Record<string, string>,
  userEmail?: string | null,
  respectRoleSwitch: boolean = false  // ✅ New flag 
): RouteConfig[] {
  if (!role) return []

  // Owner (admin email) gets full access UNLESS they are previewing another role
  if (
    userEmail?.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    !respectRoleSwitch
  ) {
    console.log("[RouteConfig] Owner gets full menu access");
    return ROUTE_CONFIG;
  }

  // CEO and ADMIN see all routes
  if (role === "CEO" || role === "ADMIN") {
    return ROUTE_CONFIG;
  }

  // Others see only their allowed routes
  return ROUTE_CONFIG.filter((route) => route.allowedRoles.includes(role));
}

// Validate role
export function isValidRole(role: string): role is UserRole {
  return ["CEO", "ADMIN", "OPERATOR", "DRIVER", "MECHANIC", "ACCOUNTANT", "HR"].includes(role);
}

// Normalize role to uppercase
export function normalizeRole(role: string): UserRole | null {
  const upperRole = role.toUpperCase();
  if (isValidRole(upperRole)) {
    return upperRole as UserRole;
  }
  return null;
}
