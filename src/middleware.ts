import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Calvary Connect — Enterprise Security Middleware
 *
 * Handles:
 * - Request ID injection (for distributed tracing)
 * - Tenant routing header propagation
 * - Security headers (HSTS, CSP, X-Frame-Options)
 * - IP extraction and forwarding
 * - Basic rate limiting signal (enforced by API Gateway / Upstash)
 */

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/trips',
  '/fleet',
  '/finance',
  '/inventory',
  '/maintenance',
  '/drivers',
  '/reports',
  '/admin',
  '/hr',
  '/sales',
  '/contracts',
  '/operations',
  '/dispatch',
  '/accountant',
  '/map',
  '/ai-insights',
];

// Routes that are always public
const PUBLIC_ROUTES = [
  '/',
  '/track',
  '/tracking',
  '/api/health',
];

// NOTE: PROTECTED_ROUTES/PUBLIC_ROUTES and the two helpers below are
// currently unused by middleware() — this is deliberate, not an oversight.
// The Supabase client (src/lib/supabase.ts) uses the default supabase-js
// session storage, which persists the auth token in browser localStorage,
// not a cookie. Middleware runs on the Edge runtime with access to request
// cookies only, so there is no session state it can currently read to
// redirect unauthenticated requests before the page loads.
//
// This is not the actual security boundary: RLS policies (see
// supabase/migrations/033_fix_user_profiles_role_escalation.sql and
// 034_lock_down_finance_rls.sql) enforce who can read/write each table
// regardless of what the UI does, and src/lib/route-config.ts's
// useRouteGuard() redirects client-side once the session is known. The gap
// this leaves is UX only: an unauthenticated visitor can load a protected
// route's JS shell before being redirected, though every data call it makes
// is rejected by RLS. Closing that gap for real requires migrating session
// storage to cookies (e.g. @supabase/ssr) so middleware can check it — a
// separate, larger change, not done here.
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route));
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||     // Cloudflare real IP
    request.headers.get('x-real-ip') ||            // Nginx real IP
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = crypto.randomUUID();
  const clientIP = getClientIP(request);

  const response = NextResponse.next();

  // ── 1. Request ID for distributed tracing ──────────────────────────────
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-client-ip', clientIP);

  // ── 2. Security headers ────────────────────────────────────────────────
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=(self)');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // ── 3. Content Security Policy ─────────────────────────────────────────
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://vercel.live",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
    "font-src 'self' https://fonts.gstatic.com https://vercel.live",
    // OSM/CARTO tile hosts power the Leaflet 2D map; the CARTO apex domain
    // (basemaps.cartocdn.com, no subdomain) serves MapLibre sprites — a
    // *.basemaps wildcard does NOT match the apex, which is why tiles failed.
    // Supabase Storage serves vehicle photos, avatars, chat attachments, and
    // compliance docs — without it here, images upload fine but the browser
    // silently refuses to render them.
    "img-src 'self' data: blob: https://*.supabase.co https://*.googleapis.com https://*.gstatic.com https://*.mapbox.com https://firebasestorage.googleapis.com https://*.tile.openstreetmap.org https://tile.openstreetmap.de https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://demotiles.maplibre.org https://api.maptiler.com https://placehold.co https://images.unsplash.com https://picsum.photos",
    // wss://*.supabase.co is required for realtime (chat, live dashboards);
    // nominatim/osrm serve geocoding and road routing.
    // MapLibre fetches its style.json, vector tiles, glyphs and sprites via
    // fetch() — all governed by connect-src. basemaps.cartocdn.com (apex)
    // hosts the Voyager GL style; demotiles.maplibre.org is the fallback style.
    // stun: entries are WebRTC ICE candidate gathering for voice/video calls.
    // wss://ws-*.pusher.com / sockjs-mt*.pusher.com: nothing in this app's
    // own code calls Pusher — it's the Vercel Live toolbar's own realtime
    // comments connection (vercel.live is already allowed above/below for
    // that same toolbar), blocked here without this.
    "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.firebaseio.com wss://*.firebaseio.com https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://vercel.live https://v6.exchangerate-api.com https://api.exchangerate-api.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://demotiles.maplibre.org https://api.maptiler.com wss://*.pusher.com https://*.pusher.com stun: turn:",
    // MapLibre GL spawns its tile workers from blob: URLs; without worker-src
    // the default-src 'self' fallback blocks them and the canvas stays blank.
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    // WebRTC audio/video call streams
    "media-src 'self' blob:",
    // Vercel Live preview toolbar + the route-map-dialog Google Maps embed
    "frame-src 'self' https://vercel.live https://www.google.com",

    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // ── 4. Tenant ID propagation ───────────────────────────────────────────
  const tenantId =
    request.headers.get('x-tenant-id') ||
    request.cookies.get('tenantId')?.value ||
    'default';
  response.headers.set('x-tenant-id', tenantId);

  // ── 5. Log API request metadata (for OpenTelemetry pickup) ────────────
  if (pathname.startsWith('/api/')) {
    response.headers.set('x-api-start-time', Date.now().toString());
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
