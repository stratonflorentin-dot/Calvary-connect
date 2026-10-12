import { NextRequest, NextResponse } from "next/server";
import { getRecentExternalAdminActions, logExternalAdminAction, withAuthAndRateLimit } from "@/lib/api-gateway";
import {
  apiError,
  callExternalApi,
  getExternalApiHealth,
  invalidateExternalApiCache,
} from "@/lib/external-apis";
import { externalApiJson, invalidExternalRequest } from "@/lib/external-api-routes";

export const runtime = "nodejs";
export const maxDuration = 60;
const ADMIN_ROLES = ["CEO", "ADMIN"];

export const GET = withAuthAndRateLimit(async (_request: NextRequest) =>
  NextResponse.json({ success: true, data: getExternalApiHealth(), audit: await getRecentExternalAdminActions() }), ADMIN_ROLES);

export const POST = withAuthAndRateLimit(async (request: NextRequest, user: { id: string; profile?: { name?: string; role?: string } }) => {
  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return invalidExternalRequest("external", "Request body must be valid JSON.");
  }

  if (body.action === "invalidate-cache") {
    const result = await invalidateExternalApiCache();
    await logExternalAdminAction(request, user, "cache.invalidate", result);
    return NextResponse.json({ success: true, data: result });
  }
  if (body.action === "test-endpoints") {
    const checks = await Promise.all([
      ["tpa", "vessel_schedule", {}] as const,
      ["globalpetrolprices", "fuel_prices", {}] as const,
      ["exchangerate", "rates", { base: "TZS" }] as const,
      ["nager", "holidays_tz", { year: new Date().getFullYear() }] as const,
    ].map(async ([site, operation, params]) => {
      const result = await callExternalApi(site, operation, params, { forceRefresh: true });
      return { site, operation, success: result.success, code: result.success ? undefined : result.error.code };
    }));
    await logExternalAdminAction(request, user, "endpoints.check", { checks });
    return NextResponse.json({ success: checks.every((check) => check.success), data: checks });
  }

  return externalApiJson(apiError("external", "INVALID_ARGUMENT", "action must be invalidate-cache or test-endpoints."));
}, ADMIN_ROLES);
