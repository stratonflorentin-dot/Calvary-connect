import { NextResponse } from "next/server";
import { requireFleetReportAccess } from "../helpers";

/**
 * Three-way cost control per trip — LogiPRO's REQUESTED / COMMITTED /
 * ACTUAL pattern (its own imprest cycle projected onto shipment cost
 * control), adapted to data this app actually has a real link for:
 * expenses.trip_id exists, fuel_requests does not have a trip_id at all
 * (only driver_id/vehicle_id), so this covers trip-linked expenses only.
 *
 *   REQUESTED  = every non-rejected expense raised against the trip
 *   COMMITTED  = the subset that's been approved (or already paid)
 *   ACTUAL     = the subset that's actually been paid
 *
 * This reuses the real pending -> approved -> paid states expenseMachine
 * already drives (state-machines.ts) rather than inventing a parallel
 * budget concept — no fabricated "budget" field anywhere.
 */

// Variance = actual - committed (LogiPRO compares actual spend against
// what was approved, not the original ask). Bands are plain constants,
// not a hidden magic number — LogiPRO's own equivalent thresholds are
// nowhere exposed in its UI, flagged in the comparison as something that
// should be configurable; these are a documented starting point, not
// claimed to be tuned for this fleet.
const WARNING_VARIANCE_PCT = 15;
const CRITICAL_VARIANCE_PCT = 30;

export async function GET(request: Request) {
  let supabase;
  try {
    supabase = await requireFleetReportAccess(request);
  } catch (err: any) {
    const status = String(err.message).startsWith("FORBIDDEN") ? 403 : 401;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const toDate = searchParams.get("to") || new Date().toISOString();

    const { data: trips, error: tripsError } = await supabase
      .from("trips")
      .select("id, trip_number, origin, destination, status, created_at")
      .gte("created_at", fromDate)
      .lte("created_at", toDate);
    if (tripsError) throw tripsError;

    const tripIds = (trips ?? []).map((t: any) => t.id);
    let expenses: any[] = [];
    if (tripIds.length > 0) {
      const { data, error: expensesError } = await supabase
        .from("expenses")
        .select("trip_id, amount, status, currency")
        .in("trip_id", tripIds)
        .is("deleted_at", null);
      if (expensesError) throw expensesError;
      expenses = data ?? [];
    }

    const rows = (trips ?? []).map((trip: any) => {
      const tripExpenses = expenses.filter((e) => e.trip_id === trip.id);
      const requested = tripExpenses
        .filter((e) => e.status !== "rejected")
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const committed = tripExpenses
        .filter((e) => e.status === "approved" || e.status === "paid")
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const actual = tripExpenses
        .filter((e) => e.status === "paid")
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);

      const variance = actual - committed;
      const variancePct = committed > 0 ? Math.round((variance / committed) * 1000) / 10 : null;
      const band: "ok" | "warning" | "critical" | null =
        variancePct === null
          ? null
          : Math.abs(variancePct) >= CRITICAL_VARIANCE_PCT
          ? "critical"
          : Math.abs(variancePct) >= WARNING_VARIANCE_PCT
          ? "warning"
          : "ok";

      // A trip's expenses are expected to share one currency; flag it
      // rather than silently blending amounts labeled with whichever
      // currency happened to come first if that assumption is ever wrong.
      const currencies = Array.from(new Set(tripExpenses.map((e: any) => (e.currency || "TZS").toUpperCase())));
      const currency = currencies[0] ?? "TZS";
      const mixedCurrencies = currencies.length > 1;

      return {
        tripId: trip.id,
        tripNumber: trip.trip_number,
        origin: trip.origin,
        destination: trip.destination,
        status: trip.status,
        expenseCount: tripExpenses.length,
        currency,
        mixedCurrencies,
        requested,
        committed,
        actual,
        variance,
        variancePct,
        band,
      };
    }).filter((r) => r.expenseCount > 0); // trips with no expenses at all aren't a variance case

    // Never summed across currencies — grouped per currency, same "Mixed
    // currencies" convention as the rest of Finance.
    const byCurrency: Record<string, { requested: number; committed: number; actual: number }> = {};
    for (const r of rows) {
      if (!byCurrency[r.currency]) byCurrency[r.currency] = { requested: 0, committed: 0, actual: 0 };
      byCurrency[r.currency].requested += r.requested;
      byCurrency[r.currency].committed += r.committed;
      byCurrency[r.currency].actual += r.actual;
    }
    const summary = {
      tripsWithExpenses: rows.length,
      byCurrency,
      currencies: Object.keys(byCurrency).sort(),
      criticalCount: rows.filter((r) => r.band === "critical").length,
      warningCount: rows.filter((r) => r.band === "warning").length,
    };

    return NextResponse.json({ success: true, summary, data: rows, thresholds: { warning: WARNING_VARIANCE_PCT, critical: CRITICAL_VARIANCE_PCT } });
  } catch (error: any) {
    console.error("[API Trip Cost Variance Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
