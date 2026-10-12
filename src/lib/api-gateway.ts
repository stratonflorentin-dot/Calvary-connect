import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/loads': { windowMs: 60000, maxRequests: 100, keyPrefix: 'loads' },
  '/api/dispatch': { windowMs: 60000, maxRequests: 50, keyPrefix: 'dispatch' },
  '/api/fleet': { windowMs: 60000, maxRequests: 200, keyPrefix: 'fleet' },
  '/api/warehouse': { windowMs: 60000, maxRequests: 100, keyPrefix: 'warehouse' },
  '/api/analytics': { windowMs: 60000, maxRequests: 30, keyPrefix: 'analytics' },
  '/api/ai': { windowMs: 60000, maxRequests: 20, keyPrefix: 'ai' },
  'default': { windowMs: 60000, maxRequests: 60, keyPrefix: 'api' },
};

export function getRateLimitConfig(pathname: string): RateLimitConfig {
  for (const [pattern, config] of Object.entries(DEFAULT_RATE_LIMITS)) {
    if (pathname.startsWith(pattern)) return config;
  }
  return DEFAULT_RATE_LIMITS.default;
}

export function checkRateLimit(identifier: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = `${config.keyPrefix}:${identifier}`;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  if (record.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: config.maxRequests - record.count, resetAt: record.resetAt };
}

export async function verifyAuth(request: NextRequest): Promise<{ user: any; error?: string }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  // Get user profile with role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, name, email, role, department, employee_id, avatar_url, phone')
    .eq('id', user.id)
    .single();

  return { user: { ...user, profile }, error: undefined };
}

export async function logExternalAdminAction(
  request: NextRequest,
  user: { id: string; profile?: { name?: string; role?: string } },
  action: "cache.invalidate" | "endpoints.check",
  details: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_name: user.profile?.name ?? "Administrator",
      user_role: user.profile?.role ?? "ADMIN",
      action: "UPDATE",
      table_name: "external_api_health",
      change_summary: action === "cache.invalidate" ? "Invalidated external API cache" : "Tested external API endpoints",
      details: { action, ...details },
      ip_address: request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: request.headers.get("user-agent"),
    });
    if (error) console.error("External API admin audit insert failed:", error.message);
    await publishExternalHealthEvent(action === "cache.invalidate" ? "cache_invalidations" : "api_health_events", {
      action,
      actor: user.profile?.name ?? "Administrator",
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("External API admin audit failed:", error);
  }
}

export async function publishExternalHealthEvent(eventType: "api_health_events" | "cache_invalidations" | "rate_limit_events", payload: Record<string, unknown>) {
  try {
    const { error } = await supabase.from("api_health_events").insert({ event_type: eventType, payload });
    if (error) console.error("External API health event insert failed:", error.message);
  } catch (error) {
    console.error("External API health event failed:", error);
  }
}

export async function getRecentExternalAdminActions() {
  try {
    const { data, error } = await supabase.from("audit_logs")
      .select("action, table_name, change_summary, details, created_at")
      .eq("table_name", "external_api_health").order("created_at", { ascending: false }).limit(20);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function logScheduledExternalHealth(details: Record<string, unknown>) {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      user_name: "Supabase scheduled health check", user_role: "SYSTEM", action: "UPDATE",
      table_name: "external_api_health", change_summary: "Scheduled external API health check", details,
    });
    if (error) console.error("Scheduled external health audit insert failed:", error.message);
  } catch (error) { console.error("Scheduled external health audit failed:", error); }
}

export function requireRole(allowedRoles: string[]) {
  return async (request: NextRequest) => {
    const { user, error } = await verifyAuth(request);
    if (error || !user) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }
    if (!allowedRoles.includes(user.profile?.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return { user, response: null };
  };
}

type StaticRouteContext = { params: Promise<Record<string, never>> };

export function withRateLimit<Context = StaticRouteContext>(handler: (request: NextRequest, context: Context) => Promise<NextResponse>) {
  return async (request: NextRequest, context: Context) => {
    const config = getRateLimitConfig(request.nextUrl.pathname);
    const identifier = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous';
    const { allowed, remaining, resetAt } = checkRateLimit(identifier, config);

    if (!allowed) {
      if (request.nextUrl.pathname.startsWith("/api/external/")) {
        await publishExternalHealthEvent("rate_limit_events", {
          pathname: request.nextUrl.pathname,
          at: new Date().toISOString(),
        });
      }
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: Math.ceil((resetAt - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) } }
      );
    }

    const response = await handler(request, context);
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
    return response;
  };
}

export function withAuth<Context = StaticRouteContext>(handler: (request: NextRequest, user: any, context: Context) => Promise<NextResponse>, allowedRoles?: string[]) {
  return async (request: NextRequest, context: Context) => {
    const { user, error } = await verifyAuth(request);
    if (error || !user) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }
    if (allowedRoles && !allowedRoles.includes(user.profile?.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return handler(request, user, context);
  };
}

export function withAuthAndRateLimit<Context = StaticRouteContext>(
  handler: (request: NextRequest, user: any, context: Context) => Promise<NextResponse>,
  allowedRoles?: string[]
) {
  return withRateLimit(withAuth(handler, allowedRoles));
}

// Webhook verification
export async function verifyWebhook(request: NextRequest, secret: string): Promise<boolean> {
  const signature = request.headers.get('x-webhook-signature') || request.headers.get('x-signature');
  if (!signature) return false;

  const body = await request.text();
  const crypto = await import('crypto');
  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Request validation
export function validateRequest<T>(schema: { parse: (data: any) => T }) {
  return async (request: NextRequest): Promise<{ data: T; error?: string }> => {
    try {
      const body = await request.json();
      const data = schema.parse(body);
      return { data, error: undefined };
    } catch (err: any) {
      return { data: null as any, error: err.message || 'Invalid request body' };
    }
  };
}

// Response helpers
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400, details?: any) {
  return NextResponse.json({ success: false, error: message, details }, { status });
}

export function paginatedResponse<T>(data: T[], page: number, limit: number, total: number) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  });
}
