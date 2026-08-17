import { NextRequest, NextResponse } from "next/server";
import { requireFleetReportAccess } from "../helpers";
import { DRIVER_DOCUMENT_TYPES } from "@/lib/compliance/driver-documents";
import { complianceStatus } from "@/lib/compliance/status";

/**
 * Persisted driver scorecard — completion rate, on-time rate, and
 * compliance rate (critical documents only). Deliberately 3 components,
 * not LogiPRO's 4: there is no incidents/abandonment table anywhere in
 * this schema, so a "no abandonments" component would have to be
 * fabricated as automatic full marks — exactly the defect that floors
 * LogiPRO's own untested drivers at 30/100. overall_score stays null
 * when nothing about a driver is actually measurable, never a floor.
 */

export async function GET(request: NextRequest) {
  let supabase;
  try {
    supabase = await requireFleetReportAccess(request);
  } catch (err: any) {
    const status = String(err.message).startsWith("FORBIDDEN") ? 403 : 401;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }

  const { data, error } = await supabase
    .from("driver_scorecards")
    .select("*, user_profiles!driver_id(name, employee_id)")
    .order("overall_score", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: NextRequest) {
  let supabase;
  let userId: string;
  try {
    supabase = await requireFleetReportAccess(request);
    const accessToken = request.headers.get("authorization")!.replace(/^Bearer\s+/i, "");
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    userId = user!.id;
  } catch (err: any) {
    const status = String(err.message).startsWith("FORBIDDEN") ? 403 : 401;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }

  try {
    const { data: drivers, error: driversError } = await supabase
      .from("user_profiles")
      .select(`id, ${DRIVER_DOCUMENT_TYPES.map((d) => d.key).join(", ")}`)
      .ilike("role", "driver");
    if (driversError) throw driversError;

    const { data: trips, error: tripsError } = await supabase.from("trips").select("*");
    if (tripsError) throw tripsError;

    const GRACE_MS = 2 * 60 * 60 * 1000;
    const now = new Date().toISOString();
    const rows: any[] = [];

    for (const driverRow of drivers ?? []) {
      // The dynamic select() template string (driver document keys spliced
      // in at runtime) can't be statically parsed by supabase-js's typed
      // query builder, same as the identical pattern in
      // src/app/admin/hr/driver-compliance/actions.ts — cast once here
      // rather than losing type safety on every property access below.
      const driver = driverRow as any;
      const driverTrips = (trips ?? []).filter((t: any) => t.driver_id === driver.id || t.driverId === driver.id);
      const completed = driverTrips.filter((t: any) => t.status?.toLowerCase() === "delivered" || t.status?.toLowerCase() === "completed");
      const cancelled = driverTrips.filter((t: any) => t.status?.toLowerCase() === "cancelled");
      const finished = completed.length + cancelled.length;
      const completionRate = finished > 0 ? Math.round((completed.length / finished) * 100) : null;

      let onTimeCount = 0;
      let onTimeSampleSize = 0;
      for (const t of completed) {
        const durationHours = Number(t.estimated_duration);
        if (!t.created_at || !durationHours) continue;
        const actual = t.pod_uploaded_at || t.updated_at;
        if (!actual) continue;
        const expectedMs = new Date(t.created_at).getTime() + durationHours * 60 * 60 * 1000;
        const actualMs = new Date(actual).getTime();
        onTimeSampleSize += 1;
        if (actualMs <= expectedMs + GRACE_MS) onTimeCount += 1;
      }
      const onTimeRate = onTimeSampleSize > 0 ? Math.round((onTimeCount / onTimeSampleSize) * 100) : null;

      // Compliance: share of CRITICAL document types (license, medical —
      // not the optional cross-border pass) that are currently ok/due_7/
      // due_30. "unknown" (never dated) and "expired"/"due_today" both
      // count against the driver — a document nobody ever filed is not
      // evidence of compliance, matching the status.ts fix.
      const criticalDocs = DRIVER_DOCUMENT_TYPES.filter((d) => d.critical);
      const compliantCount = criticalDocs.filter((d) => {
        const s = complianceStatus((driver as any)[d.key]);
        return s === "ok" || s === "due_7" || s === "due_30";
      }).length;
      const complianceRate = criticalDocs.length > 0 ? Math.round((compliantCount / criticalDocs.length) * 100) : null;

      // Weighted average over whichever components are actually present —
      // never redistributes a missing component's weight onto full marks.
      const weighted: [number | null, number][] = [
        [completionRate, 0.4],
        [onTimeRate, 0.3],
        [complianceRate, 0.3],
      ];
      const present = weighted.filter(([v]) => v !== null) as [number, number][];
      const totalWeight = present.reduce((s, [, w]) => s + w, 0);
      const overallScore = totalWeight > 0
        ? Math.round(present.reduce((s, [v, w]) => s + v * w, 0) / totalWeight)
        : null;

      rows.push({
        driver_id: driver.id,
        completion_rate: completionRate,
        completed_trips: completed.length,
        cancelled_trips: cancelled.length,
        on_time_rate: onTimeRate,
        on_time_sample_size: onTimeSampleSize,
        compliance_rate: complianceRate,
        overall_score: overallScore,
        computed_at: now,
        computed_by: userId,
      });
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase.from("driver_scorecards").upsert(rows, { onConflict: "driver_id" });
      if (upsertError) throw upsertError;
    }

    return NextResponse.json({ success: true, recomputed: rows.length });
  } catch (error: any) {
    console.error("[API Driver Scorecards Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
