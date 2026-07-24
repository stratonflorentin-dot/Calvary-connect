"use server";

import { createClient } from "@supabase/supabase-js";
import { DRIVER_DOCUMENT_TYPES } from "@/lib/compliance/driver-documents";
import { daysRemaining, REMINDER_THRESHOLDS } from "@/lib/compliance/status";

const MANAGER_ROLES = ["CEO", "ADMIN", "OPERATOR", "HR"];

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

/**
 * On-demand reminder scan for driver document expiry — mirrors
 * `runReminderScan()` in `src/app/fleet/compliance/page.tsx` (same
 * threshold/dedup logic, same "compliance" notification category so both
 * features actually show up in the Notifications Center).
 */
export async function runDriverReminderScan(): Promise<{ sent: number }> {
  const admin = getAdminClient();

  const { data: drivers } = await admin
    .from("user_profiles")
    .select(`id, name, ${DRIVER_DOCUMENT_TYPES.map((d) => d.key).join(", ")}`)
    .eq("role", "DRIVER");

  const due: { driverId: string; driverName: string; docLabel: string; days: number }[] = [];
  for (const driver of drivers ?? []) {
    for (const doc of DRIVER_DOCUMENT_TYPES) {
      const days = daysRemaining((driver as any)[doc.key]);
      if (days === null) continue;
      if (days < 0 || (REMINDER_THRESHOLDS as readonly number[]).includes(days)) {
        due.push({ driverId: (driver as any).id, driverName: (driver as any).name, docLabel: doc.label, days });
      }
    }
  }
  if (due.length === 0) return { sent: 0 };

  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data: recent } = await admin
    .from("notifications")
    .select("message")
    .eq("type", "compliance")
    .gte("created_at", since);
  const recentSet = new Set((recent ?? []).map((n: any) => n.message));

  const { data: managers } = await admin.from("user_profiles").select("id").in("role", MANAGER_ROLES);

  let sent = 0;
  for (const item of due) {
    const message = `${item.docLabel} for ${item.driverName} ${
      item.days < 0 ? `expired ${Math.abs(item.days)} day(s) ago` : item.days === 0 ? "expires today" : `expires in ${item.days} day(s)`
    }`;
    if (recentSet.has(message)) continue;

    const title = item.days < 0 ? "Driver document EXPIRED" : "Driver document renewal due";
    const recipients = new Set([item.driverId, ...(managers ?? []).map((m: any) => m.id)]);
    await admin.from("notifications").insert(
      Array.from(recipients).map((userId) => ({
        user_id: userId,
        type: "compliance",
        title,
        message,
        read: false,
      })),
    );
    sent += 1;
  }
  return { sent };
}
