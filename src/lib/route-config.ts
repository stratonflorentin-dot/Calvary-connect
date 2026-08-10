"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { UserRole } from "@/types/roles";
import { isValidRole, normalizeRole } from "@/lib/user-role-utils";
import { DRIVER_ROUTE_CONFIG } from "@/lib/driver-routes";
import { getEffectiveAllowedRoles } from "@/lib/route-overrides-store";
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
  category?: "dashboard" | "sales" | "logistics" | "fleet" | "inventory" | "finance" | "reports" | "people" | "system";
  showInNavigation?: boolean;
}

export const NAVIGATION_CATEGORY_ORDER: NonNullable<RouteConfig["category"]>[] = [
  "dashboard",
  "sales",
  "logistics",
  "fleet",
  "inventory",
  "finance",
  "reports",
  "people",
  "system",
];

export const NAVIGATION_CATEGORY_LABELS: Record<NonNullable<RouteConfig["category"]>, string> = {
  dashboard: "Command",
  sales: "Sales",
  logistics: "Dispatch",
  fleet: "Fleet",
  inventory: "Inventory",
  finance: "Finance",
  reports: "Reports",
  people: "People",
  system: "System",
};

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
  {
    path: "/customers/[id]",
    label: "Customer Details",
    allowedRoles: ["CEO", "ADMIN", "SALESMAN", "ACCOUNTANT"],
    showInNavigation: false,
  },
  // --- Shipments ---
  {
    path: "/trips",
    label: "Shipments & Trips",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "SALESMAN"],
    category: "logistics",
  },
  {
    path: "/dispatch",
    label: "Dispatch Board",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR"],
    category: "logistics",
  },
  {
    path: "/chat",
    label: "Internal Chat",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "DRIVER", "MECHANIC", "ACCOUNTANT", "HR"],
    category: "logistics",
  },
  {
    path: "/chat/instagram",
    label: "Instagram",
    allowedRoles: ["CEO", "ADMIN", "SALESMAN", "OPERATOR"],
    category: "logistics",
  },
  {
    path: "/route-optimizer",
    label: "Route Optimizer",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR"],
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
  {
    path: "/track",
    label: "Customer Tracking",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "SALESMAN", "ACCOUNTANT"],
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
    path: "/fleet/compliance",
    label: "Vehicle Compliance",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "MECHANIC"],
    category: "fleet",
  },
  {
    path: "/fleet/fuel-anomalies",
    label: "Fuel Fraud Alerts",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "ACCOUNTANT"],
    category: "fleet",
  },
  {
    path: "/fuel",
    label: "Fuel Management",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "ACCOUNTANT", "MECHANIC"],
    category: "fleet",
  },
  {
    path: "/service-requests",
    label: "Service Requests",
    allowedRoles: ["CEO", "ADMIN", "MECHANIC", "OPERATOR", "DRIVER"],
    category: "fleet",
  },
  {
    path: "/maintenance",
    label: "Maintenance Records",
    allowedRoles: ["CEO", "ADMIN", "MECHANIC", "OPERATOR", "DRIVER"],
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
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "MECHANIC", "WAREHOUSE_STAFF", "DRIVER"],
    category: "inventory",
  },
  {
    path: "/fuel-approvals",
    label: "Fuel Approvals",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "MECHANIC"],
    category: "fleet",
  },
  {
    path: "/approvals",
    label: "Approvals Inbox",
    allowedRoles: ["CEO", "ADMIN", "OPERATOR", "ACCOUNTANT", "MECHANIC"],
    category: "dashboard",
  },

  // --- ERP Accounting & Finance ---
  {
    path: "/finance",
    label: "Finance Overview",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
  },
  // Accounting
  {
    path: "/finance/accounting/chart-of-accounts",
    label: "Chart of Accounts",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false, // Will be shown in finance submenu
  },
  {
    path: "/finance/accounting/journal-entries",
    label: "Journal Entries",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/accounting/general-ledger",
    label: "General Ledger",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/accounting/trial-balance",
    label: "Trial Balance",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/reports/trial-balance",
    label: "Trial Balance",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "reports",
  },
  {
    path: "/finance/reports/aging-report",
    label: "Aging Report",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "reports",
  },
  {
    path: "/finance/accounting/fx-rates",
    label: "FX Rates",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
  },
  {
    path: "/settings",
    label: "System Settings",
    allowedRoles: ["CEO", "ADMIN"],
    category: "system",
  },
  // Receivables
  {
    path: "/finance/invoicing/customer-invoices",
    label: "Customer Invoices",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/invoicing/credit-notes",
    label: "Credit Notes",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/transactions/payments",
    label: "Payments",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  // Payables
  {
    path: "/finance/invoicing/vendor-bills",
    label: "Vendor Bills",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/transactions/expenses",
    label: "Expense Transactions",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/transactions/bank-transactions",
    label: "Bank Transactions",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  // Treasury & Banking
  {
    path: "/finance/banking/bank-accounts",
    label: "Bank Accounts",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/banking/bank-statements",
    label: "Bank Statements",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/banking/bank-reconciliation",
    label: "Bank Reconciliation",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  // Financial Reports
  {
    path: "/finance/reports/profit-loss",
    label: "Profit & Loss",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/reports/balance-sheet",
    label: "Balance Sheet",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/reports/cash-flow",
    label: "Cash Flow",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/reports/revenue-analysis",
    label: "Revenue Analysis",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/reports/expense-analysis",
    label: "Expense Analysis",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/fleet-finance/vehicle-profitability",
    label: "Vehicle Profitability",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/fleet-finance/route-profitability",
    label: "Route Profitability",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/fleet-finance/fuel-costs",
    label: "Fuel Costs",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/fleet-finance/maintenance-costs",
    label: "Maintenance Costs",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/reports/reconciliation",
    label: "COA Reconciliation",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  // Expenses & Income (existing)
  {
    path: "/expenses",
    label: "Expense Tracking",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT", "OPERATOR", "HR"],
    category: "finance",
  },
  {
    path: "/accountant/expenses",
    label: "Expense Approval",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT"],
    category: "finance",
    showInNavigation: false,
  },
  {
    path: "/finance/transactions/revenue",
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
  {
    path: "/admin/reports/fleet/driver-performance",
    label: "Driver Performance",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT", "HR"],
    category: "reports",
  },
  {
    path: "/admin/reports/fleet/route-profitability",
    label: "Route Profitability",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT", "HR"],
    category: "reports",
  },
  {
    path: "/admin/reports/fleet/fuel",
    label: "Fuel Consumption",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT", "HR"],
    category: "reports",
  },
  {
    path: "/admin/reports/fleet/revenue-by-vehicle",
    label: "Vehicle Revenue",
    allowedRoles: ["CEO", "ADMIN", "ACCOUNTANT", "HR"],
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
  {
    path: "/admin/hr/payroll/statutory",
    label: "Statutory Reports",
    allowedRoles: ["CEO", "ADMIN", "HR", "ACCOUNTANT"],
    category: "people",
  },
  {
    path: "/admin/hr/payroll/loans",
    label: "Employee Loans",
    allowedRoles: ["CEO", "ADMIN", "HR", "ACCOUNTANT"],
    category: "people",
    showInNavigation: false,
  },
  {
    path: "/admin/hr/payroll/overtime",
    label: "Overtime",
    allowedRoles: ["CEO", "ADMIN", "HR", "ACCOUNTANT"],
    category: "people",
    showInNavigation: false,
  },
  {
    path: "/hr/leave",
    label: "Leave",
    allowedRoles: ["CEO", "ADMIN", "HR", "OPERATOR", "MECHANIC", "ACCOUNTANT", "DRIVER", "SALESMAN", "WAREHOUSE_STAFF"],
    category: "people",
  },
  {
    path: "/hr/meetings",
    label: "Meetings",
    allowedRoles: ["CEO", "ADMIN", "HR"],
    category: "people",
  },
  {
    path: "/hr/insurance",
    label: "Insurance",
    allowedRoles: ["CEO", "ADMIN", "HR", "OPERATOR", "ACCOUNTANT"],
    category: "people",
  },
  {
    path: "/admin/hr/driver-compliance",
    label: "Driver Compliance",
    allowedRoles: ["CEO", "ADMIN", "HR", "OPERATOR"],
    category: "people",
  },
  {
    path: "/hr/insurance/add",
    label: "New Insurance",
    allowedRoles: ["CEO", "ADMIN", "HR", "OPERATOR", "ACCOUNTANT"],
    showInNavigation: false,
  },
  {
    path: "/hr/insurance/bulk-import",
    label: "Bulk Insurance Import",
    allowedRoles: ["CEO", "ADMIN", "HR", "OPERATOR", "ACCOUNTANT"],
    showInNavigation: false,
  },
  {
    path: "/hr/insurance/[id]",
    label: "Insurance Details",
    allowedRoles: ["CEO", "ADMIN", "HR", "OPERATOR", "ACCOUNTANT"],
    showInNavigation: false,
  },

  // --- Settings ---
  {
    path: "https://logipro.milelepower.co.tz/",
    label: "LogiPRO (Legacy)",
    allowedRoles: [...ALL_APP_ROLES],
    category: "system",
    showInNavigation: false,
  },
  {
    path: "/audit",
    label: "Audit Trail",
    allowedRoles: ["CEO", "ADMIN"],
    category: "system",
  },
  {
    path: "/ai-insights",
    label: "AI Operations",
    allowedRoles: ["CEO", "ADMIN"],
    category: "system",
  },
  {
    path: "/company-ai",
    label: "Company AI",
    allowedRoles: ["CEO", "ADMIN"],
    category: "system",
  },

  // --- Driver Specific (Hidden from Sidebar Main Menu) ---
  {
    path: "/driver/trips",
    label: "My Trips",
    allowedRoles: ["DRIVER"],
    showInNavigation: false,
  },
  {
    path: "/proof",
    label: "Proof of Delivery",
    allowedRoles: ["DRIVER"],
    showInNavigation: false,
  },
  {
    path: "/driver/fuel",
    label: "Fuel Log",
    allowedRoles: ["DRIVER"],
    showInNavigation: false,
  },
  {
    path: "/driver/expenses",
    label: "My Expenses",
    allowedRoles: ["DRIVER"],
    showInNavigation: false,
  },
  {
    path: "/driver/profile",
    label: "Driver Profile",
    allowedRoles: ["DRIVER"],
    showInNavigation: false,
  },
  {
    path: "/driver/maintenance",
    label: "Report Issue",
    allowedRoles: ["DRIVER"],
    showInNavigation: false,
  },

  // --- Profile & Shared ---
  {
    path: "/notifications",
    label: "Notifications",
    allowedRoles: [...ALL_APP_ROLES],
    category: "system",
  },
  {
    path: "/profile",
    label: "My Profile",
    allowedRoles: [...ALL_APP_ROLES],
    category: "system",
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
  HR: "/users",
  WAREHOUSE_STAFF: "/inventory",
};

function routeDebug(level: "log" | "warn" | "error", ...args: unknown[]) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ROUTE_DEBUG === "true"
  ) {
    console[level](...args);
  }
}

// Route guard hook
export function useRouteGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: isUserLoading } = useSupabase();
  const { role, isInitialized } = useRole();

  useEffect(() => {
    routeDebug("log", "Navigated to:", pathname);
  }, [pathname]);

  const checkAccess = useCallback(
    (path: string): boolean => {
      try {
        // CEO/ADMIN role has full access to everything, even during role switching.
        // Do not move this below the overrides lookup — it's the lock-out safety net.
        const isOwnerOrAdmin =
          user?.role === 'ADMIN' ||
          user?.role === 'CEO';

        if (isOwnerOrAdmin) {
          routeDebug("log", `[RouteGuard] Owner/Admin access granted for ${path}`);
          return true;
        }

        if (!role) {
          routeDebug("warn", "[RouteGuard] No role provided for access check");
          return false;
        }

        const route = ROUTE_CONFIG.find((r) => routeMatches(path, r.path));
        if (!route) {
          routeDebug("warn", "Route not found:", path);
          return false;
        }

        const normalizedRole = normalizeRole(String(role));
        if (!normalizedRole) return false;
        const hasAccess = getEffectiveAllowedRoles(route).includes(normalizedRole);
        if (!hasAccess) {
          routeDebug("warn", "Access denied:", role, path);
        }

        return hasAccess;
      } catch (error) {
        routeDebug("error", "[RouteGuard] Error checking access:", error);
        return false;
      }
    },
    [role, user?.email, user?.role],
  );

  const redirectToDefault = useCallback(
    (userRole: UserRole) => {
      const defaultRoute = ROLE_DEFAULT_ROUTES[userRole];
      routeDebug("log", `[RouteGuard] Redirecting ${userRole} to ${defaultRoute}`);
      router.push(defaultRoute);
    },
    [router],
  );

  useEffect(() => {
    if (isUserLoading || !isInitialized) return;

    // Check if admin user - should always have access, no redirects.
    // Do not move this below the overrides lookup — it's the lock-out safety net.
    const isAdminUser =
      user?.role === 'ADMIN' ||
      user?.role === 'CEO';

    // Admin user should never be redirected, even when switching roles
    if (isAdminUser) {
      routeDebug("log", "[RouteGuard] Admin user detected, skipping all redirects");
      return;
    }

    if (!user) {
      routeDebug("log", "[RouteGuard] No user, waiting...");
      return;
    }

    if (!role) {
      routeDebug("log", "[RouteGuard] No role, waiting...");
      return;
    }

    const hasAccess = checkAccess(pathname);
    routeDebug("log", `[RouteGuard] ${pathname} access for ${role}: ${hasAccess}`);

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
  _isAdmin: boolean,
  t: Record<string, string>,
  userEmail?: string | null,
  respectRoleSwitch: boolean = false, // ✅ New flag
): RouteConfig[] {
  const normalizedRole =
    role != null ? normalizeRole(String(role)) : null;
  if (!normalizedRole) return [];

  // CEO and ADMIN see all routes.
  // Do not move this below the overrides lookup — it's the lock-out safety net.
  const isOwnerOrAdminEmail = normalizedRole === 'CEO' || normalizedRole === 'ADMIN';

  if (
    isOwnerOrAdminEmail &&
    !respectRoleSwitch
  ) {
    routeDebug("log", "[RouteConfig] Admin/CEO gets full menu access");
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
    getEffectiveAllowedRoles(route).includes(normalizedRole),
  );
}

export function getNavigationMenuByRole(
  role: UserRole | null,
  isAdmin: boolean,
  t: Record<string, string>,
  userEmail?: string | null,
  respectRoleSwitch: boolean = false,
): RouteConfig[] {
  return getMenuByRole(role, isAdmin, t, userEmail, respectRoleSwitch).filter(
    (route) => route.showInNavigation !== false && !!route.category,
  );
}

function routeMatches(pathname: string, routePath: string) {
  if (pathname === routePath) return true;
  const pathnameSegments = pathname.split('/').filter(Boolean);
  const routeSegments = routePath.split('/').filter(Boolean);
  if (pathnameSegments.length !== routeSegments.length) return false;
  return routeSegments.every((segment, index) =>
    segment.startsWith('[') ? true : segment === pathnameSegments[index],
  );
}

/** Used by the sidebar to hide trip shortcuts for roles without /trips access. */
export function roleHasTripsAccess(role: UserRole | null): boolean {
  const normalized = role != null ? normalizeRole(String(role)) : null;
  if (!normalized) return false;
  if (normalized === "DRIVER") return false;
  const tripRoute = ROUTE_CONFIG.find((r) => r.path === "/trips");
  return !!tripRoute && getEffectiveAllowedRoles(tripRoute).includes(normalized);
}

export { isValidRole, normalizeRole };
