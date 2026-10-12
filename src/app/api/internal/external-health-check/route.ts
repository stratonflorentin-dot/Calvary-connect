import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { logScheduledExternalHealth, publishExternalHealthEvent } from "@/lib/api-gateway";
import { callExternalApi } from "@/lib/external-apis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.EXTERNAL_HEALTH_CHECK_SECRET;
  const supplied = request.headers.get("x-cron-secret") ?? "";
  const suppliedBytes = Buffer.from(supplied);
  const secretBytes = Buffer.from(secret ?? "");
  if (secretBytes.length < 32 || suppliedBytes.length !== secretBytes.length || !timingSafeEqual(suppliedBytes, secretBytes)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const checks = await Promise.all([
    ["tpa", "vessel_schedule", {}] as const,
    ["globalpetrolprices", "fuel_prices", {}] as const,
    ["exchangerate", "rates", { base: "TZS" }] as const,
    ["nager", "holidays_tz", { year: new Date().getFullYear() }] as const,
  ].map(async ([site, operation, params]) => {
    const started = Date.now();
    const result = await callExternalApi(site, operation, params, { forceRefresh: true });
    return { site, operation, success: result.success, latencyMs: Date.now() - started, code: result.success ? undefined : result.error.code };
  }));
  const failed = checks.filter((check) => !check.success).length;
  const alerts = [
    ...(failed / checks.length > 0.05 ? [`External endpoint error rate is ${Math.round(failed / checks.length * 100)}%.`] : []),
    ...checks.filter((check) => check.latencyMs > 2_000).map((check) => `${check.site}/${check.operation} exceeded 2 seconds (${check.latencyMs} ms).`),
  ];
  const result = { checkedAt: new Date().toISOString(), checks, failed, alerts };
  await Promise.all([
    logScheduledExternalHealth(result),
    publishExternalHealthEvent("api_health_events", result),
  ]);
  return NextResponse.json({ success: alerts.length === 0, data: result }, { status: alerts.length ? 503 : 200 });
}
