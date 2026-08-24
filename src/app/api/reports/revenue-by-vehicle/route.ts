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

    // 1. Fetch all vehicles
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*');

    if (vehiclesError) throw vehiclesError;

    // 2. Fetch all trips in the period
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    if (tripsError) throw tripsError;

    // 3. Fetch all expenses in the period
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', fromDate)
      .lte('date', toDate);

    const vehicleRevenueData = (vehicles || []).map((vehicle) => {
      // Find trips for this vehicle
      const vehicleTrips = (trips || []).filter(
        (t) => t.truck_id === vehicle.id || t.truckId === vehicle.id || t.vehicle_id === vehicle.id
      );
      const completedTrips = vehicleTrips.filter((t) => t.status?.toLowerCase() !== 'cancelled');

      // Revenue by currency — t.revenue/t.price are dead legacy columns
      // (always 0) and t.salesAmount doesn't exist; the real figures are
      // total_amount/sales_amount, and blending different-currency trips
      // into one number would be meaningless arithmetic, not just a label
      // issue, so costs/revenue are tracked per currency instead.
      const byCurrency: Record<string, { revenue: number; costs: number }> = {};
      for (const t of completedTrips) {
        const cur = t.currency || 'TZS';
        if (!byCurrency[cur]) byCurrency[cur] = { revenue: 0, costs: 0 };
        byCurrency[cur].revenue += Number(t.total_amount ?? t.sales_amount ?? t.revenue ?? t.price ?? 0);
        byCurrency[cur].costs += Number(t.cost_fuel || 0) + Number(t.cost_tolls || 0) + Number(t.cost_border || 0) + Number(t.cost_customs || 0);
      }

      // Sum expenses from expenses table, also by currency
      const vehicleExpenses = (expenses || []).filter((e) => e.vehicle_id === vehicle.id || e.vehicleId === vehicle.id);
      for (const e of vehicleExpenses) {
        const cur = e.currency || 'TZS';
        if (!byCurrency[cur]) byCurrency[cur] = { revenue: 0, costs: 0 };
        byCurrency[cur].costs = Math.max(byCurrency[cur].costs, parseFloat(e.amount || 0));
      }

      const currencies = Object.keys(byCurrency);
      const mixedCurrencies = currencies.length > 1;
      const primaryCurrency = currencies.length > 0
        ? currencies.reduce((a, b) => (byCurrency[a].revenue >= byCurrency[b].revenue ? a : b))
        : 'TZS';
      const totalRevenue = byCurrency[primaryCurrency]?.revenue ?? 0;
      const totalExpenses = byCurrency[primaryCurrency]?.costs ?? 0;
      const netProfit = totalRevenue - totalExpenses;
      const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      return {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber || vehicle.plate_number || 'N/A',
        makeModel: `${vehicle.make || 'Unknown'} ${vehicle.model || ''}`.trim(),
        currency: primaryCurrency,
        mixedCurrencies,
        financialsByCurrency: byCurrency,
        tripsCount: completedTrips.length,
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMarginPercent: parseFloat(margin.toFixed(1)),
        status: vehicle.status || 'available'
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Summary Statistics — grouped by currency, not blended into one number.
    const totalVehiclesActive = vehicleRevenueData.filter((v) => v.tripsCount > 0).length;
    const totalRevenueByCurrency: Record<string, number> = {};
    const totalExpensesByCurrency: Record<string, number> = {};
    const netProfitByCurrency: Record<string, number> = {};
    for (const v of vehicleRevenueData) {
      for (const [cur, { revenue, costs }] of Object.entries(v.financialsByCurrency)) {
        totalRevenueByCurrency[cur] = (totalRevenueByCurrency[cur] ?? 0) + revenue;
        totalExpensesByCurrency[cur] = (totalExpensesByCurrency[cur] ?? 0) + costs;
        netProfitByCurrency[cur] = (netProfitByCurrency[cur] ?? 0) + (revenue - costs);
      }
    }

    const highestRevenueVehicle = vehicleRevenueData.length > 0
      ? vehicleRevenueData.reduce((prev, curr) => (curr.totalRevenue > prev.totalRevenue ? curr : prev), vehicleRevenueData[0])
      : null;

    return NextResponse.json({
      success: true,
      summary: {
        totalVehiclesActive,
        totalRevenueByCurrency,
        totalExpensesByCurrency,
        netProfitByCurrency,
        bestPerformingVehicle: highestRevenueVehicle ? `${highestRevenueVehicle.plateNumber}` : 'N/A'
      },
      data: vehicleRevenueData
    });

  } catch (error: any) {
    console.error('[API Vehicle Revenue Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
