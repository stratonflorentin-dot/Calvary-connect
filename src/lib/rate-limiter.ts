/**
 * Calvary Connect — Rate Limiter
 *
 * Sliding-window in-process rate limiter for API routes.
 * Replace the `store` Map with Upstash Redis for distributed environments.
 *
 * Usage (in an API route):
 *   const result = await rateLimiter.check(request, 'OPERATOR');
 *   if (!result.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
 */

import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@/lib/permissions';

// ─── Limits per role (requests per minute) ───────────────────────────────────
const ROLE_LIMITS: Record<UserRole | 'ANONYMOUS', { rpm: number; burst: number }> = {
  CEO:       { rpm: 600, burst: 200 },
  ADMIN:     { rpm: 600, burst: 200 },
  ACCOUNTANT: { rpm: 200, burst: 50 },
  HR:        { rpm: 200, burst: 50 },
  OPERATOR:  { rpm: 300, burst: 100 },
  DRIVER:    { rpm: 60,  burst: 20 },
  MECHANIC:  { rpm: 100, burst: 30 },
  CUSTOMER:  { rpm: 60,  burst: 20 },
  ANONYMOUS: { rpm: 20,  burst: 5 },
};

// ─── Sliding window store ─────────────────────────────────────────────────────
const windows = new Map<string, { timestamps: number[]; blocked: boolean }>();

const WINDOW_MS = 60_000; // 1 minute

function getKey(ip: string, role: string): string {
  return `rl:${ip}:${role}`;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export const rateLimiter = {
  check(ip: string, role: UserRole | 'ANONYMOUS' = 'ANONYMOUS'): RateLimitResult {
    const { rpm } = ROLE_LIMITS[role];
    const key = getKey(ip, role);
    const now = Date.now();
    const cutoff = now - WINDOW_MS;

    // Get or create window entry
    const entry = windows.get(key) ?? { timestamps: [], blocked: false };

    // Purge old timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    const count = entry.timestamps.length;
    const remaining = Math.max(0, rpm - count);
    const resetAt = now + WINDOW_MS;

    if (count >= rpm) {
      windows.set(key, entry);
      return {
        success: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil(WINDOW_MS / 1000),
      };
    }

    entry.timestamps.push(now);
    windows.set(key, entry);

    return { success: true, remaining: remaining - 1, resetAt };
  },

  /**
   * Middleware-style check — returns a 429 Response on limit exceeded.
   */
  middleware(request: NextRequest, role: UserRole | 'ANONYMOUS' = 'ANONYMOUS'): NextResponse | null {
    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';

    const result = this.check(ip, role);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please slow down.',
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfter ?? 60),
            'X-RateLimit-Limit': String(ROLE_LIMITS[role].rpm),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
          },
        }
      );
    }

    return null; // no limit hit
  },
};
