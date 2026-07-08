/**
 * Calvary Connect — Caching Layer
 *
 * In-memory LRU cache for server-side (API routes / Server Actions).
 * Drop-in replacement interface so it can be swapped for Upstash Redis
 * by simply changing the implementation of `get`/`set`/`del` below.
 *
 * TTL presets match the performance SLAs in the system design doc:
 *   Fleet vehicles:    60 s
 *   Inventory items:   30 s
 *   AI insights:      300 s
 *   User profiles:    600 s
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

// Simple in-process store (replace with Upstash in production)
const store = new Map<string, CacheEntry<unknown>>();

// ─── TTL Presets (seconds) ───────────────────────────────────────────────────
export const TTL = {
  FLEET_VEHICLES: 60,
  INVENTORY: 30,
  AI_INSIGHTS: 300,
  USER_PROFILE: 600,
  REPORTS: 300,
  TRIPS_LIST: 30,
  DASHBOARD_STATS: 45,
} as const;

// ─── Core cache operations ───────────────────────────────────────────────────

export const cache = {
  /**
   * Get a cached value.
   * Returns `null` on miss or if the entry has expired.
   */
  get<T>(key: string): T | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.value;
  },

  /**
   * Store a value in cache with a TTL (seconds).
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  /**
   * Invalidate a specific key.
   */
  del(key: string): void {
    store.delete(key);
  },

  /**
   * Invalidate all keys matching a prefix.
   */
  delByPrefix(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  /**
   * Wrap an async function with cache.
   * If the cache has a hit, returns immediately.
   * On miss, calls the factory, caches, and returns the result.
   */
  async wrap<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    this.set(key, value, ttlSeconds);
    return value;
  },

  /** Return current store size (for monitoring). */
  size(): number {
    return store.size;
  },
};

// ─── Cache key builders ──────────────────────────────────────────────────────
export const CacheKeys = {
  fleetVehicles: (tenantId: string) => `fleet:vehicles:${tenantId}`,
  inventoryItems: (tenantId: string) => `inventory:items:${tenantId}`,
  userProfile: (uid: string) => `user:profile:${uid}`,
  aiInsights: (tenantId: string) => `ai:insights:${tenantId}`,
  dashboardStats: (tenantId: string) => `dashboard:stats:${tenantId}`,
  tripsList: (tenantId: string, page: number) => `trips:list:${tenantId}:p${page}`,
  reportsMonthly: (tenantId: string, month: string) => `reports:monthly:${tenantId}:${month}`,
};
