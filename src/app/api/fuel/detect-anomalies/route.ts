import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  detectFuelAnomaliesForVehicle,
  detectFuelAnomaliesForAllVehicles,
  persistFuelAnomalies,
} from "@/lib/fuel-fraud-detection";
import { notifyFuelAnomalyDetected } from "@/services/notification-service";

const ALLOWED_ROLES = ["CEO", "ADMIN", "OPERATOR", "ACCOUNTANT"];

async function requireFraudScanAccess(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new Error("UNAUTHORIZED: missing access token");

  const admin = supabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error("UNAUTHORIZED: invalid session");

  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !ALLOWED_ROLES.includes(String(profile.role).toUpperCase())) {
    throw new Error("FORBIDDEN: not authorized to run fuel fraud scans");
  }
  return admin;
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireFraudScanAccess(request);
    const body = await request.json().catch(() => ({}));
    const vehicleId: string | undefined = body?.vehicle_id;

    const detected = vehicleId
      ? await detectFuelAnomaliesForVehicle(admin, vehicleId)
      : await detectFuelAnomaliesForAllVehicles(admin);

    const newlyPersisted = await persistFuelAnomalies(admin, detected);

    if (newlyPersisted.length > 0) {
      const vehicleIds = [...new Set(newlyPersisted.map((a) => a.vehicle_id))];
      const { data: vehicles } = await admin.from("vehicles").select("id, plate_number").in("id", vehicleIds);
      const plateById = new Map((vehicles || []).map((v: any) => [v.id, v.plate_number]));

      await Promise.all(
        newlyPersisted.map((a) =>
          notifyFuelAnomalyDetected(admin, {
            vehiclePlate: plateById.get(a.vehicle_id) ?? "Unknown vehicle",
            anomalyType: a.anomaly_type,
            description: a.description,
            severity: a.severity,
          }),
        ),
      );
    }

    return NextResponse.json({ scanned: detected.length, flagged: newlyPersisted.length });
  } catch (error: any) {
    console.error("POST /api/fuel/detect-anomalies error:", error);
    const status = /^UNAUTHORIZED/.test(error.message) ? 401 : /^FORBIDDEN/.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
