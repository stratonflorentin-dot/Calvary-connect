/**
 * Preventive maintenance scheduler.
 *
 * Scans the fleet and opens a maintenance_requests row for any vehicle whose
 * `next_maintenance_due` date has arrived or whose mileage has passed a
 * service interval, provided there isn't already an open request for that
 * vehicle.
 *
 * Runs are idempotent: an already-open `requested`/`scheduled`/`in_progress`
 * record for the vehicle blocks a duplicate from being created.
 */

import { supabase } from "@/lib/supabase";
import { AuditTrailService } from "@/services/audit-trail-service";
import { createNotification, fetchOperatorUserIds } from "@/services/notification-service";

/** Default km interval between preventive services when the vehicle doesn't declare one. */
const DEFAULT_SERVICE_INTERVAL_KM = 10_000;
/** How many days *before* next_maintenance_due to open the ticket. */
const LEAD_DAYS = 5;

interface Vehicle {
  id: string;
  plate_number?: string;
  make?: string;
  model?: string;
  mileage?: number;
  last_service_mileage?: number;
  next_maintenance_due?: string | null;
  service_interval_km?: number | null;
}

interface OpenRequest {
  vehicle_id: string;
}

export interface ScheduleResult {
  scanned: number;
  created: number;
  skipped: number;
  createdIds: string[];
  errors: string[];
}

function daysUntil(date: string | Date): number {
  const d = new Date(date).getTime();
  return (d - Date.now()) / (1000 * 60 * 60 * 24);
}

/**
 * Decide whether a vehicle needs a preventive maintenance ticket right now.
 * Returns a short reason string when it does, or null when it does not.
 */
function reasonToSchedule(v: Vehicle): string | null {
  if (v.next_maintenance_due) {
    const days = daysUntil(v.next_maintenance_due);
    if (days <= LEAD_DAYS) {
      return days < 0
        ? `Service overdue by ${Math.abs(days).toFixed(0)} days`
        : `Service due in ${days.toFixed(0)} days`;
    }
  }
  if (v.mileage != null) {
    const interval = Number(v.service_interval_km ?? DEFAULT_SERVICE_INTERVAL_KM);
    const last = Number(v.last_service_mileage ?? 0);
    const since = v.mileage - last;
    if (since >= interval) {
      return `Mileage interval reached (${since.toLocaleString()} km since last service)`;
    }
  }
  return null;
}

export async function runPreventiveMaintenanceScheduler(
  actorId = "system",
): Promise<ScheduleResult> {
  const result: ScheduleResult = {
    scanned: 0,
    created: 0,
    skipped: 0,
    createdIds: [],
    errors: [],
  };

  const { data: vehicles, error: vErr } = await supabase.from("vehicles").select("*");
  if (vErr) {
    result.errors.push(`vehicles: ${vErr.message}`);
    return result;
  }

  const list = (vehicles ?? []) as Vehicle[];
  result.scanned = list.length;
  if (list.length === 0) return result;

  const { data: openRows, error: openErr } = await supabase
    .from("maintenance_records")
    .select("vehicle_id")
    .in("status", ["requested", "scheduled", "in_progress"]);
  if (openErr) result.errors.push(`open lookup: ${openErr.message}`);

  const alreadyOpen = new Set((openRows ?? []).map((r: OpenRequest) => r.vehicle_id));

  const rowsToInsert: any[] = [];
  const reasons: Record<string, string> = {};
  for (const v of list) {
    const reason = reasonToSchedule(v);
    if (!reason) {
      result.skipped += 1;
      continue;
    }
    if (alreadyOpen.has(v.id)) {
      result.skipped += 1;
      continue;
    }
    const record = {
      vehicle_id: v.id,
      title: `Preventive service — ${v.plate_number ?? v.id}`,
      description: reason,
      type: "preventive",
      priority: "medium",
      status: "requested",
      record_number: `PM-${Date.now().toString(36).toUpperCase()}-${v.id.slice(0, 4)}`,
      created_at: new Date().toISOString(),
    };
    reasons[record.record_number] = reason;
    rowsToInsert.push(record);
  }

  if (rowsToInsert.length === 0) return result;

  const { data: inserted, error: insertErr } = await supabase
    .from("maintenance_records")
    .insert(rowsToInsert)
    .select();
  if (insertErr) {
    result.errors.push(`insert: ${insertErr.message}`);
    return result;
  }

  result.created = inserted?.length ?? 0;
  result.createdIds = (inserted ?? []).map((r: any) => r.id);

  await Promise.all(
    (inserted ?? []).map((r: any) =>
      AuditTrailService.log({
        user_id: actorId,
        module: "maintenance",
        action: "create",
        entity_type: "maintenance_request",
        entity_id: r.id,
        new_value: r,
        description: `Preventive maintenance auto-created: ${r.description}`,
      }),
    ),
  );

  try {
    const operators = await fetchOperatorUserIds();
    if (operators.length > 0 && result.created > 0) {
      await Promise.all(
        operators.map((uid) =>
          createNotification({
            userId: uid,
            title: "Preventive maintenance queued",
            message: `${result.created} vehicle(s) now have preventive tickets awaiting scheduling.`,
            type: "warning",
            module: "maintenance",
            entityType: "maintenance_request",
            actionUrl: "/maintenance",
          }),
        ),
      );
    }
  } catch {
    // Notification failure is non-fatal.
  }

  return result;
}
