import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { connect as connectTcp, type Socket } from "node:net";
import { connect as connectTls } from "node:tls";
import { promisify } from "node:util";
import path from "node:path";

const execFile = promisify(execFileCallback);

function apiAnythingHomePath(configuredHome = process.env.API_ANYTHING_HOME): string {
  const userHome = process.env.USERPROFILE || process.env.HOME || process.cwd();
  if (!configuredHome || configuredHome === "~") return path.join(userHome, ".api-anything");
  if (configuredHome.startsWith("~/") || configuredHome.startsWith("~\\")) {
    return path.join(userHome, configuredHome.slice(2));
  }
  return configuredHome;
}

export interface ApiResponseMeta {
  source: string;
  cached: boolean;
  fetchedAt: string;
  expiresAt: string;
}

export interface FuelPriceEntry {
  fuel?: string;
  date: string;
  tzs: string;
  usd?: string;
}

export interface KenyaFuelPriceEntry {
  fuel?: string;
  date: string;
  kes: string;
  usd?: string;
}

export interface PriceHistoryTable {
  table_text: string;
}

export interface RegionalDieselSummary {
  summary: string;
}

export interface ExchangeRates {
  base_code: string;
  time_last_update_utc?: string;
  time_next_update_utc?: string;
  rates: Record<string, number>;
}

export interface PublicHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  types: string[];
}

export type ApiResponse<T> =
  | { success: true; data: T; meta: ApiResponseMeta }
  | {
      success: false;
      error: { code: string; message: string; retryAfter?: number };
      meta: ApiResponseMeta;
    };

interface CacheEntry {
  data: unknown;
  fetchedAt: string;
  expiresAt: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface ProviderHealth {
  status: "healthy" | "degraded";
  calls: number;
  failures: number;
  lastLatencyMs: number;
  lastCheckAt: string;
  lastSuccessAt?: string;
  lastErrorCode?: string;
}

type RedisValue = string | number | null | RedisValue[];
type ParsedRedisValue = { value: RedisValue; offset: number } | undefined;

const memoryCache = new Map<string, CacheEntry>();
const knownCacheKeys = new Set<string>();
const memoryRateLimits = new Map<string, RateLimitEntry>();
const providerHealth = new Map<string, ProviderHealth>();
let cacheHits = 0;
let cacheMisses = 0;
let redisUnavailableUntil = 0;
let redisLastAvailableAt = 0;

const CACHE_TTL_SECONDS: Record<string, number> = {
  vessel_schedule: 300,
  declaration_status: 60,
  duty_calculator: 300,
  quote_delivery: 300,
  fuel_prices: 300,
  gasoline_price_history: 300,
  kerosene_price_history: 300,
  diesel_price_dsm: 300,
  gasoline_price_dsm_summary: 300,
  kenya_fuel_prices: 300,
  wait_times: 60,
  track_shipment: 60,
  cargo_tracking: 60,
  container_tracking: 60,
  schedules: 300,
  rates: 3600,
  holidays_tz: 86400,
};

const SITE_RATE_LIMITS_PER_MINUTE: Record<string, number> = {
  globalpetrolprices: 30,
  tpa: 30,
  tra: 30,
  sendy: 20,
  border: 30,
  sgr: 30,
  exchangerate: 30,
  nager: 30,
};

const RATE_WINDOW_MS = 60_000;
const REDIS_SOCKET_TIMEOUT_MS = 350;
const REDIS_RETRY_DELAY_MS = 15_000;
const CLI_TIMEOUT_MS = 35_000;
const MAX_CLI_OUTPUT_BYTES = 2 * 1024 * 1024;

export function resolveApiAnythingNodeExecutable(
  runtimeExecutable = process.execPath,
  configuredExecutable = process.env.API_ANYTHING_NODE_PATH,
): string {
  const configured = configuredExecutable?.trim();
  if (configured) return configured;
  // Some serverless runtimes expose a build-time/runtime shim in execPath that
  // is not present as an executable in the function filesystem. Fall back to
  // resolving the node binary from PATH in those environments.
  return existsSync(runtimeExecutable) ? runtimeExecutable : "node";
}

function makeMeta(source: string, cached: boolean, fetchedAt: string, expiresAt: string): ApiResponseMeta {
  return { source, cached, fetchedAt, expiresAt };
}

export function apiError<T = never>(
  source: string,
  code: string,
  message: string,
  retryAfter?: number,
): ApiResponse<T> {
  const now = new Date().toISOString();
  return {
    success: false,
    error: { code, message, ...(retryAfter ? { retryAfter } : {}) },
    meta: makeMeta(source, false, now, now),
  };
}

export function apiResponseStatus(response: ApiResponse<unknown>): number {
  if (response.success) return 200;
  switch (response.error.code) {
    case "INVALID_ARGUMENT":
    case "UNSUPPORTED_REGION":
      return 400;
    case "RATE_LIMITED":
      return 429;
    case "OPERATION_UNAVAILABLE":
    case "EXTERNAL_AUTH_REQUIRED":
    case "EXTERNAL_SOURCE_BLOCKED":
      return 503;
    default:
      return 502;
  }
}

function cacheKey(site: string, operation: string, params: Record<string, string | number | boolean>): string {
  const normalized = JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
  const digest = createHash("sha256").update(normalized).digest("hex");
  return `external-api:v1:${site}:${operation}:${digest}`;
}

function encodeRedisCommand(parts: string[]): string {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join("")}`;
}

function parseRedisValue(buffer: Buffer, start = 0): ParsedRedisValue {
  if (start >= buffer.length) return undefined;
  const kind = String.fromCharCode(buffer[start]!);
  const lineEnd = buffer.indexOf("\r\n", start);
  if (lineEnd < 0) return undefined;
  const line = buffer.toString("utf8", start + 1, lineEnd);

  if (kind === "+") return { value: line, offset: lineEnd + 2 };
  if (kind === "-") throw new Error(`Redis command failed: ${line}`);
  if (kind === ":") return { value: Number(line), offset: lineEnd + 2 };

  if (kind === "$") {
    const length = Number(line);
    if (length === -1) return { value: null, offset: lineEnd + 2 };
    const dataStart = lineEnd + 2;
    const dataEnd = dataStart + length;
    if (!Number.isInteger(length) || buffer.length < dataEnd + 2) return undefined;
    return { value: buffer.toString("utf8", dataStart, dataEnd), offset: dataEnd + 2 };
  }

  if (kind === "*") {
    const length = Number(line);
    if (length === -1) return { value: null, offset: lineEnd + 2 };
    if (!Number.isInteger(length)) throw new Error("Redis returned an invalid array length");
    const values: RedisValue[] = [];
    let offset = lineEnd + 2;
    for (let index = 0; index < length; index += 1) {
      const parsed = parseRedisValue(buffer, offset);
      if (!parsed) return undefined;
      values.push(parsed.value);
      offset = parsed.offset;
    }
    return { value: values, offset };
  }

  throw new Error("Redis returned an unsupported response type");
}

async function runRedisCommands(commands: string[][]): Promise<RedisValue[]> {
  const urlText = process.env.REDIS_URL;
  if (!urlText) throw new Error("REDIS_URL is not configured");

  const url = new URL(urlText);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss://");
  }

  const setup: string[][] = [];
  const password = decodeURIComponent(url.password);
  const username = decodeURIComponent(url.username);
  if (password) setup.push(username ? ["AUTH", username, password] : ["AUTH", password]);
  const database = url.pathname.slice(1);
  if (database && database !== "0") setup.push(["SELECT", database]);
  const allCommands = [...setup, ...commands];

  return new Promise<RedisValue[]>((resolve, reject) => {
    const port = Number(url.port || 6379);
    const host = url.hostname;
    const socket: Socket =
      url.protocol === "rediss:"
        ? connectTls({ host, port, servername: host })
        : connectTcp({ host, port });
    let buffer = Buffer.alloc(0);
    let offset = 0;
    const replies: RedisValue[] = [];
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.setTimeout(0);
      if (error) {
        socket.destroy();
        reject(error);
      } else {
        socket.end();
        resolve(replies.slice(setup.length));
      }
    };

    socket.setTimeout(REDIS_SOCKET_TIMEOUT_MS, () => finish(new Error("Redis connection timed out")));
    socket.once("error", (error) => finish(error));
    socket.once("close", () => {
      if (!settled) finish(new Error("Redis connection closed before replying"));
    });

    const readyEvent = url.protocol === "rediss:" ? "secureConnect" : "connect";
    socket.once(readyEvent, () => {
      socket.write(allCommands.map(encodeRedisCommand).join(""));
    });

    socket.on("data", (chunk: Buffer) => {
      try {
        buffer = Buffer.concat([buffer, chunk]);
        while (replies.length < allCommands.length) {
          const parsed = parseRedisValue(buffer, offset);
          if (!parsed) break;
          replies.push(parsed.value);
          offset = parsed.offset;
        }
        if (offset > 0) {
          buffer = buffer.subarray(offset);
          offset = 0;
        }
        if (replies.length === allCommands.length) finish();
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Redis response could not be parsed"));
      }
    });
  });
}

async function optionalRedis(commands: string[][]): Promise<RedisValue[] | undefined> {
  if (!process.env.REDIS_URL || Date.now() < redisUnavailableUntil) return undefined;
  try {
    const result = await runRedisCommands(commands);
    redisLastAvailableAt = Date.now();
    redisUnavailableUntil = 0;
    return result;
  } catch {
    redisUnavailableUntil = Date.now() + REDIS_RETRY_DELAY_MS;
    return undefined;
  }
}

function pruneMemoryCache(now: number): void {
  if (memoryCache.size < 1_000) return;
  for (const [key, entry] of memoryCache) {
    if (Date.parse(entry.expiresAt) <= now) memoryCache.delete(key);
  }
  while (memoryCache.size > 2_000) memoryCache.delete(memoryCache.keys().next().value as string);
}

async function readCache(key: string): Promise<CacheEntry | undefined> {
  const now = Date.now();
  const local = memoryCache.get(key);
  if (local) {
    if (Date.parse(local.expiresAt) > now) return local;
    memoryCache.delete(key);
  }

  const replies = await optionalRedis([["GET", key]]);
  const serialized = replies?.[0];
  if (typeof serialized !== "string") return undefined;
  try {
    const entry = JSON.parse(serialized) as CacheEntry;
    if (Date.parse(entry.expiresAt) <= now) return undefined;
    memoryCache.set(key, entry);
    knownCacheKeys.add(key);
    return entry;
  } catch {
    return undefined;
  }
}

async function writeCache(key: string, entry: CacheEntry, ttlSeconds: number): Promise<void> {
  memoryCache.set(key, entry);
  knownCacheKeys.add(key);
  pruneMemoryCache(Date.now());
  await optionalRedis([["SETEX", key, String(ttlSeconds), JSON.stringify(entry)]]);
}

function takeLocalRateLimit(site: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const resetAt = (Math.floor(now / RATE_WINDOW_MS) + 1) * RATE_WINDOW_MS;
  const key = `${site}:${resetAt}`;
  const entry = memoryRateLimits.get(key);
  const limit = SITE_RATE_LIMITS_PER_MINUTE[site] ?? 30;
  if (!entry) {
    memoryRateLimits.set(key, { count: 1, resetAt });
    for (const [oldKey, oldValue] of memoryRateLimits) {
      if (oldValue.resetAt <= now) memoryRateLimits.delete(oldKey);
    }
    return { allowed: true };
  }
  if (entry.count >= limit) return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1_000) };
  entry.count += 1;
  return { allowed: true };
}

async function takeRateLimit(site: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const bucket = Math.floor(now / RATE_WINDOW_MS);
  const bucketEnd = (bucket + 1) * RATE_WINDOW_MS;
  const key = `external-api:rate:${site}:${bucket}`;
  const replies = await optionalRedis([
    ["INCR", key],
    ["EXPIRE", key, String(Math.max(1, Math.ceil((bucketEnd - now) / 1_000)))],
  ]);
  const count = replies?.[0];
  if (typeof count === "number") {
    const limit = SITE_RATE_LIMITS_PER_MINUTE[site] ?? 30;
    return count > limit
      ? { allowed: false, retryAfter: Math.ceil((bucketEnd - now) / 1_000) }
      : { allowed: true };
  }
  return takeLocalRateLimit(site);
}

function operationTtl(operation: string): number {
  return CACHE_TTL_SECONDS[operation] ?? 60;
}

function recordProviderHealth(site: string, success: boolean, latencyMs: number, errorCode?: string): void {
  const previous = providerHealth.get(site);
  const checkedAt = new Date().toISOString();
  const lastErrorCode = success ? undefined : errorCode ?? previous?.lastErrorCode;
  providerHealth.set(site, {
    status: success ? "healthy" : "degraded",
    calls: (previous?.calls ?? 0) + 1,
    failures: (previous?.failures ?? 0) + (success ? 0 : 1),
    lastLatencyMs: latencyMs,
    lastCheckAt: checkedAt,
    ...(success ? { lastSuccessAt: checkedAt } : previous?.lastSuccessAt ? { lastSuccessAt: previous.lastSuccessAt } : {}),
    ...(lastErrorCode ? { lastErrorCode } : {}),
  });
}

function isValidIdentifier(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(value);
}

function responseFromCli(source: string, operation: string, result: Record<string, unknown>): ApiResponse<unknown> {
  const now = new Date().toISOString();
  if (result.ok === true) {
    const ttlSeconds = operationTtl(operation);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1_000).toISOString();
    return {
      success: true,
      data: result.data,
      meta: makeMeta(source, false, now, expiresAt),
    };
  }

  const classification = String(result.class ?? "");
  const reason = String(result.reason ?? result.error ?? "External API operation failed").slice(0, 500);
  if (
    classification === "input" &&
    /no operation|operation .*not found|operation does not exist|does not exist|no site|unknown site/i.test(reason)
  ) {
    return apiError(source, "OPERATION_UNAVAILABLE", "This external API operation has not been created or configured yet.");
  }
  if (classification === "rate") {
    const retryAfter = Number(result.retryAfter);
    return apiError(source, "RATE_LIMITED", reason, Number.isFinite(retryAfter) ? retryAfter : undefined);
  }
  if (classification === "auth") return apiError(source, "EXTERNAL_AUTH_REQUIRED", reason);
  if (classification === "blocked") return apiError(source, "EXTERNAL_SOURCE_BLOCKED", reason);
  return apiError(source, "EXTERNAL_API_FAILED", reason);
}

async function runApiAnything(
  site: string,
  operation: string,
  params: Record<string, string | number | boolean>,
): Promise<Record<string, unknown>> {
  const projectRoot = process.cwd();
  const apiAnythingRoot = path.join(projectRoot, "temp-api-anything");
  const cliPath = path.join(apiAnythingRoot, "src", "cli.ts");
  const apiAnythingHome = apiAnythingHomePath();
  const cliArgs = [
    "--import",
    "tsx",
    cliPath,
    "call",
    site,
    operation,
    ...Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${String(value)}`),
  ];

  let stdout = "";
  try {
    const result = await execFile(resolveApiAnythingNodeExecutable(), cliArgs, {
      cwd: apiAnythingRoot,
      env: { ...process.env, API_ANYTHING_HOME: apiAnythingHome },
      timeout: CLI_TIMEOUT_MS,
      maxBuffer: MAX_CLI_OUTPUT_BYTES,
      windowsHide: true,
    });
    stdout = result.stdout;
  } catch (error) {
    stdout = String((error as NodeJS.ErrnoException & { stdout?: string }).stdout ?? "");
    if (!stdout.trim()) throw error;
  }

  const line = stdout.replace(/^\uFEFF/, "").trim().split(/\r?\n/, 1)[0];
  if (!line) throw new Error("API Anything returned no response");
  const parsed: unknown = JSON.parse(line);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("API Anything returned an invalid response");
  }
  return parsed as Record<string, unknown>;
}

export async function callExternalApi<T = unknown>(
  site: string,
  operation: string,
  params: Record<string, string | number | boolean> = {},
  options: { forceRefresh?: boolean } = {},
): Promise<ApiResponse<T>> {
  if (!isValidIdentifier(site) || !isValidIdentifier(operation)) {
    return apiError(site || "unknown", "INVALID_ARGUMENT", "Invalid external API operation name.");
  }
  if (
    Object.entries(params).some(
      ([key, value]) => !isValidIdentifier(key) || !["string", "number", "boolean"].includes(typeof value),
    )
  ) {
    return apiError(site, "INVALID_ARGUMENT", "External API parameters must be named scalar values.");
  }

  const key = cacheKey(site, operation, params);
  const cached = options.forceRefresh ? null : await readCache(key);
  if (cached) {
    cacheHits += 1;
    return {
      success: true,
      data: cached.data as T,
      meta: makeMeta(site, true, cached.fetchedAt, cached.expiresAt),
    };
  }
  cacheMisses += 1;

  const quota = await takeRateLimit(site);
  if (!quota.allowed) {
    return apiError(site, "RATE_LIMITED", "The external API rate limit has been reached.", quota.retryAfter);
  }

  try {
    const startedAt = Date.now();
    const raw = await runApiAnything(site, operation, params);
    const response = responseFromCli(site, operation, raw);
    if (!response.success) {
      recordProviderHealth(site, false, Date.now() - startedAt, response.error.code);
      return response;
    }

    const ttlSeconds = operationTtl(operation);
    const fetchedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1_000).toISOString();
    const entry = { data: response.data, fetchedAt, expiresAt };
    await writeCache(key, entry, ttlSeconds);
    recordProviderHealth(site, true, Date.now() - startedAt);
    return {
      success: true,
      data: response.data as T,
      meta: makeMeta(site, false, fetchedAt, expiresAt),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "API Anything could not be started";
    recordProviderHealth(site, false, 0, "API_ANYTHING_UNAVAILABLE");
    return apiError(site, "API_ANYTHING_UNAVAILABLE", message);
  }
}

export function getExternalApiHealth() {
  const apiAnythingHome = apiAnythingHomePath();
  const apiAnythingRoot = path.join(process.cwd(), "temp-api-anything");
  const redisStatus = !process.env.REDIS_URL
    ? "not_configured"
    : Date.now() < redisUnavailableUntil
      ? "unavailable"
      : redisLastAvailableAt > 0
        ? "available"
        : "unknown";
  return {
    apiAnythingConfigured: existsSync(path.join(apiAnythingRoot, "src", "cli.ts")) && existsSync(path.join(apiAnythingRoot, "node_modules", "tsx")),
    apiAnythingHomeConfigured: existsSync(apiAnythingHome),
    redisConfigured: Boolean(process.env.REDIS_URL),
    redisStatus,
    redisRetryAt: redisUnavailableUntil ? new Date(redisUnavailableUntil).toISOString() : undefined,
    cache: { hits: cacheHits, misses: cacheMisses, entries: memoryCache.size },
    memory: process.memoryUsage(),
    providers: Object.fromEntries(providerHealth),
  };
}

export async function invalidateExternalApiCache(): Promise<{ clearedEntries: number }> {
  const keys = [...knownCacheKeys];
  memoryCache.clear();
  knownCacheKeys.clear();
  if (keys.length) await optionalRedis(keys.map((key) => ["DEL", key]));
  return { clearedEntries: keys.length };
}
