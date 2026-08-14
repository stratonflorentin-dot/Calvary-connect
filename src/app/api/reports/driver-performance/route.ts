import { NextRequest, NextResponse } from 'next/server';
import { requireFleetReportAccess } from '../helpers';

export async function GET(request: NextRequest) {
  let supabase;
  try {
    supabase = await requireFleetReportAccess(request);
  } catch (err: any) {
    const status = String(err.message).startsWith('FORBIDDEN') ? 403 : 401;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const toDate = searchParams.get('to') || new Date().toISOString();

    // 1. Fetch all drivers
    const { data: drivers, error: driversError } = await supabase
      .from('user_profiles')
      .select('*')
      .ilike('role', 'driver');

    if (driversError) throw driversError;

    // 2. Fetch all trips in the period
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    if (tripsError) throw tripsError;

    // 3. Fetch expenses (including fuel) in the period
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', fromDate)
      .lte('date', toDate);

    if (expensesError) throw expensesError;

    // 4. Fetch performance reviews
    const { data: reviews, error: reviewsError } = await supabase
      .from('performance_reviews')
      .select('*');

    // 5. Fetch fuel requests in the period
    const { data: fuelRequests, error: fuelError } = await supabase
      .from('fuel_requests')
      .select('*')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .eq('status', 'approved');

    // 6. Real fleet-wide cost-per-litre from fuel_logs (falls back to a
    // labeled estimate only when no fuel_logs rows exist at all — previously
    // this was an unconditional hardcoded 3000 TZS/L).
    const { data: recentFuelLogs } = await supabase
      .from('fuel_logs')
      .select('cost_per_litre')
      .gte('fuel_date', fromDate)
      .lte('fuel_date', toDate)
      .not('cost_per_litre', 'is', null);
    const realRates = (recentFuelLogs || []).map((r) => Number(r.cost_per_litre)).filter((v) => v > 0);
    const fuelPriceIsEstimate = realRates.length === 0;
    const fleetCostPerLitre = fuelPriceIsEstimate
      ? 3000
      : realRates.reduce((s, v) => s + v, 0) / realRates.length;

    // Process driver stats
    const driverPerformance = (drivers || []).map((driver) => {
      const driverTrips = (trips || []).filter((t) => t.driver_id === driver.id || t.driverId === driver.id);
      const completedTrips = driverTrips.filter((t) => t.status?.toLowerCase() !== 'cancelled');

      // Calculate total distance — only from trips with a real distance
      // value recorded. Previously missing distance fabricated 120km per
      // trip; now such trips are excluded and flagged via distanceTracked.
      let totalDistance = 0;
      let tripsWithDistance = 0;
      for (const t of completedTrips) {
        const d = t.actual_distance ?? t.actualDistance ?? t.estimated_distance ?? t.estimatedDistance ?? t.distance_km;
        if (d) {
          totalDistance += Number(d);
          tripsWithDistance += 1;
        }
      }
      const distanceTracked = tripsWithDistance > 0;

      // Calculate total revenue
      const totalRevenue = completedTrips.reduce((sum, t) => {
        return sum + (t.revenue || t.price || t.salesAmount || 0);
      }, 0);

      // Calculate fuel cost / litres used
      // Get fuel from fuel requests
      const driverFuelReqs = (fuelRequests || []).filter((f) => f.driver_id === driver.id);
      const fuelFromReqs = driverFuelReqs.reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);

      // Get fuel from expenses
      const driverFuelExpenses = (expenses || []).filter(
        (e) => (e.driver_id === driver.id || e.driverId === driver.id) && e.category?.toLowerCase() === 'fuel'
      );
      const fuelFromExpenses = driverFuelExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

      const totalFuelCost = Math.max(fuelFromReqs, fuelFromExpenses);
      const totalFuelLiters = Math.round(totalFuelCost / fleetCostPerLitre);

      // Calculate rating — a driver with zero reviews has no evidenced
      // score, not an assumed-good one. Previously defaulted to 4.5.
      const driverReviews = (reviews || []).filter((r) => r.employee_id === driver.id);
      const hasReviews = driverReviews.length > 0;
      const avgScore = hasReviews
        ? driverReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / driverReviews.length
        : null;

      // On-time rate: compare expected arrival (created_at + estimated_duration
      // hours) against the actual delivery signal (pod_uploaded_at, falling
      // back to updated_at), with a 2-hour grace window. Only trips with both
      // an estimated_duration and a delivery timestamp count toward the
      // sample — this used to be `charCodeAt(0) % N`, i.e. fabricated.
      const GRACE_MS = 2 * 60 * 60 * 1000;
      let onTimeCount = 0;
      let onTimeSampleSize = 0;
      for (const t of completedTrips) {
        const durationHours = Number(t.estimated_duration);
        if (!t.created_at || !durationHours) continue;
        const actual = t.pod_uploaded_at || t.updated_at;
        if (!actual) continue;
        const expectedMs = new Date(t.created_at).getTime() + durationHours * 60 * 60 * 1000;
        const actualMs = new Date(actual).getTime();
        onTimeSampleSize += 1;
        if (actualMs <= expectedMs + GRACE_MS) onTimeCount += 1;
      }
      const onTimeDeliveryRate = onTimeSampleSize > 0 ? Math.round((onTimeCount / onTimeSampleSize) * 100) : null;

      return {
        id: driver.id,
        name: driver.name || 'Unknown Driver',
        employeeId: driver.employeeId || driver.employee_id || 'N/A',
        completedTripsCount: completedTrips.length,
        totalDistanceKm: totalDistance,
        distanceTracked,
        totalRevenueTZS: totalRevenue,
        totalFuelCostTZS: totalFuelCost,
        totalFuelLiters,
        fuelPriceIsEstimate,
        // No incidents table exists anywhere in the schema — surface that
        // honestly instead of a fabricated count.
        incidentsCount: null as number | null,
        incidentsTracked: false,
        onTimeDeliveryRate,
        onTimeSampleSize,
        averagePerformanceScore: avgScore !== null ? parseFloat(avgScore.toFixed(1)) : null,
        hasReviews,
        status: driver.status || 'active'
      };
    });

    // Summary Statistics
    const activeDrivers = driverPerformance.filter((d) => d.completedTripsCount > 0 || d.status === 'active');
    const totalTrips = driverPerformance.reduce((sum, d) => sum + d.completedTripsCount, 0);
    const totalRevenue = driverPerformance.reduce((sum, d) => sum + d.totalRevenueTZS, 0);
    const driversWithOnTimeData = driverPerformance.filter((d) => d.onTimeDeliveryRate !== null);
    const avgOnTime = driversWithOnTimeData.length > 0
      ? Math.round(driversWithOnTimeData.reduce((sum, d) => sum + (d.onTimeDeliveryRate as number), 0) / driversWithOnTimeData.length)
      : null;

    return NextResponse.json({
      success: true,
      summary: {
        totalDriversActive: activeDrivers.length,
        totalTrips,
        totalRevenue,
        avgOnTimePercent: avgOnTime
      },
      data: driverPerformance
    });

  } catch (error: any) {
    console.error('[API Driver Performance Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
