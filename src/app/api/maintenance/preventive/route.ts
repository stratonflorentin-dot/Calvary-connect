import { NextRequest, NextResponse } from "next/server";
import { runPreventiveMaintenanceScheduler } from "@/lib/workflow/preventive-maintenance";

export const dynamic = "force-dynamic";

/**
 * POST /api/maintenance/preventive
 *
 * Runs the preventive maintenance scan and opens tickets for vehicles that
 * hit their date or mileage thresholds. Safe to hit from a cron.
 */
export async function POST(req: NextRequest) {
  const actor =
    req.headers.get("x-actor-id") ?? req.nextUrl.searchParams.get("actor") ?? "cron";
  try {
    const result = await runPreventiveMaintenanceScheduler(actor);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Scheduler failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
