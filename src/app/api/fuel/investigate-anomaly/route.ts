import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { calculateFraudRisk, getAnomalyEscalationTier, getDriverBaseline, getVehicleBaseline, type RuleCode } from "@/lib/fuel-fraud-detection";
import { investigateFuelAnomaly } from "@/ai/flows/fuel-investigation";
import { AIAuditService } from "@/services/ai-audit-service";

// Same roles as FRAUD_REVIEW_ROLES in src/lib/workflow/state-machines.ts —
// anyone who can review a fuel anomaly can also investigate it with AI.
const ALLOWED_ROLES = ["CEO", "ADMIN", "OPERATOR", "ACCOUNTANT"];

async function requireInvestigateAccess(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new Error("UNAUTHORIZED: missing access token");

  const admin = supabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error("UNAUTHORIZED: invalid session");

  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !ALLOWED_ROLES.includes(String(profile.role).toUpperCase())) {
    throw new Error("FORBIDDEN: not authorized to investigate fuel anomalies");
  }
  return { admin, userId: user.id };
}

export async function POST(request: NextRequest) {
  try {
    const { admin, userId } = await requireInvestigateAccess(request);
    const body = await request.json().catch(() => ({}));
    const fuelLogId: string | undefined = body?.fuel_log_id;
    if (!fuelLogId) {
      return NextResponse.json({ error: "fuel_log_id is required" }, { status: 400 });
    }

    const [{ data: findings }, { data: fuelLog }, risk] = await Promise.all([
      admin
        .from("fuel_anomalies")
        .select("rule_code, severity, confidence, expected_value, actual_value, deviation_pct, description, evidence")
        .eq("fuel_log_id", fuelLogId)
        .neq("status", "dismissed"),
      admin
        .from("fuel_logs")
        .select("id, vehicle_id, driver_id, trip_id, fuel_date, litres, efficiency_km_l")
        .eq("id", fuelLogId)
        .maybeSingle(),
      calculateFraudRisk(admin, fuelLogId),
    ]);

    if (!fuelLog) {
      return NextResponse.json({ error: "Fuel transaction not found" }, { status: 404 });
    }
    if (!findings || findings.length === 0) {
      return NextResponse.json({ error: "No active findings for this transaction — nothing to investigate" }, { status: 400 });
    }

    const dataQualityNotes: string[] = [];

    const [vehicleRes, driverRes, prevLogRes, nextLogRes, maintenanceRes, tripRes, driverBaseline, vehicleBaseline] = await Promise.all([
      admin.from("vehicles").select("plate_number").eq("id", fuelLog.vehicle_id).maybeSingle(),
      fuelLog.driver_id
        ? admin.from("user_profiles").select("name").eq("id", fuelLog.driver_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("fuel_logs")
        .select("fuel_date, litres, efficiency_km_l")
        .eq("vehicle_id", fuelLog.vehicle_id)
        .lt("fuel_date", fuelLog.fuel_date)
        .order("fuel_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("fuel_logs")
        .select("fuel_date, litres, efficiency_km_l")
        .eq("vehicle_id", fuelLog.vehicle_id)
        .gt("fuel_date", fuelLog.fuel_date)
        .order("fuel_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from("maintenance_records")
        .select("status, scheduled_date")
        .eq("vehicle_id", fuelLog.vehicle_id)
        .in("status", ["requested", "scheduled", "in_progress", "postponed"]),
      fuelLog.trip_id
        ? admin.from("trips").select("origin, destination").eq("id", fuelLog.trip_id).maybeSingle()
        : Promise.resolve({ data: null }),
      fuelLog.driver_id ? getDriverBaseline(admin, fuelLog.driver_id) : Promise.resolve(null),
      getVehicleBaseline(admin, fuelLog.vehicle_id),
    ]);

    if (!fuelLog.driver_id) dataQualityNotes.push("No driver linked to this transaction");
    if (!driverBaseline) dataQualityNotes.push("Insufficient driver history to compute a driver baseline");
    if (!vehicleBaseline) dataQualityNotes.push("Insufficient vehicle history to compute a vehicle baseline");

    const primaryRuleCode = findings[0]?.rule_code as RuleCode | undefined;
    const escalation = fuelLog.driver_id && primaryRuleCode
      ? await getAnomalyEscalationTier(admin, fuelLog.driver_id, primaryRuleCode)
      : null;

    const maintenanceRecords = maintenanceRes.data || [];
    const todayIso = new Date().toISOString().split("T")[0];
    const overdueService = maintenanceRecords.some((m: any) => m.scheduled_date && m.scheduled_date < todayIso);

    const investigationInput = {
      vehiclePlate: vehicleRes.data?.plate_number ?? "Unknown vehicle",
      driverName: (driverRes.data as any)?.name ?? null,
      findings: findings.map((f: any) => ({
        ruleCode: f.rule_code,
        severity: f.severity,
        confidence: f.confidence,
        expectedValue: f.expected_value,
        actualValue: f.actual_value,
        deviationPct: f.deviation_pct,
        description: f.description,
        evidence: f.evidence ?? {},
      })),
      combinedScore: risk.combinedScore,
      band: risk.band,
      escalationTier: escalation?.tier ?? null,
      escalationOccurrences: escalation?.occurrences ?? null,
      driverBaseline,
      vehicleBaseline,
      previousFuelLog: prevLogRes.data
        ? { fuelDate: prevLogRes.data.fuel_date, litres: Number(prevLogRes.data.litres), efficiencyKmL: prevLogRes.data.efficiency_km_l }
        : null,
      nextFuelLog: nextLogRes.data
        ? { fuelDate: nextLogRes.data.fuel_date, litres: Number(nextLogRes.data.litres), efficiencyKmL: nextLogRes.data.efficiency_km_l }
        : null,
      maintenanceStatus: { openIssuesCount: maintenanceRecords.length, overdueService },
      tripSummary: tripRes.data ? { origin: (tripRes.data as any).origin, destination: (tripRes.data as any).destination } : null,
      dataQualityNotes,
    };

    const report = await investigateFuelAnomaly(investigationInput);

    await AIAuditService.log(admin, {
      userId,
      flowName: "fuelInvestigationFlow",
      entityType: "fuel_anomaly",
      entityId: fuelLogId,
      requestSummary: `Investigate fuel transaction ${fuelLogId} (${risk.band}, score ${risk.combinedScore})`,
      toolsUsed: ["calculateFraudRisk", "getDriverBaseline", "getVehicleBaseline", "getAnomalyEscalationTier"],
      recordsQueried: { fuel_log_id: fuelLogId, findings_count: findings.length, vehicle_id: fuelLog.vehicle_id, driver_id: fuelLog.driver_id },
      output: report,
      confidence: report.confidence,
      model: "groq/openai/gpt-oss-120b",
    });

    return NextResponse.json({ risk, report });
  } catch (error: any) {
    console.error("POST /api/fuel/investigate-anomaly error:", error);
    const status = /^UNAUTHORIZED/.test(error.message) ? 401 : /^FORBIDDEN/.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
