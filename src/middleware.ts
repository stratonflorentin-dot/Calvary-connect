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
  response.headers.set('Permissions-Policy', 'geolocation=(self), camera=(self)');

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
    "font-src 'self' https://fonts.gstatic.com",
    // OSM tile hosts power the live map, trip mini map and route optimizer
    "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.mapbox.com https://firebasestorage.googleapis.com https://*.tile.openstreetmap.org https://tile.openstreetmap.de https://*.basemaps.cartocdn.com",
    // wss://*.supabase.co is required for realtime (chat, live dashboards);
    // nominatim/osrm serve geocoding and road routing
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://vercel.live",
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
