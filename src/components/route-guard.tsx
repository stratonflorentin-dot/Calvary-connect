"use client";

import { useRouteGuard } from "@/lib/route-config";

/**
 * Mounts the client-side role guard. `useRouteGuard` watches the current
 * pathname and the authenticated user's role, and redirects to the role's
 * default route when the user lacks access to the page they're on.
 *
 * It no-ops while the session is still loading and for signed-out visitors
 * (public pages like the login screen, /track and /q/[token] stay reachable),
 * and never redirects CEO/ADMIN — see the safety-net checks in useRouteGuard.
 *
 * Renders nothing; mounted once in the root layout inside the auth + route
 * override providers.
 */
export function RouteGuard() {
  useRouteGuard();
  return null;
}
