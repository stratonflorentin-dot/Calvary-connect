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

    // Fetch all trips in the period
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    if (tripsError) throw tripsError;

    // Fetch expenses linked to trips
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', fromDate)
      .lte('date', toDate);

    // Group trips by Route + currency — a route quoted in both TZS and USD
    // (or however a customer pays) needs its own row rather than blending
    // the two into a number labeled with whichever currency happened to be
    // hardcoded in the UI.
    const routeGroups: Record<string, {
      origin: string;
      destination: string;
      currency: string;
      tripsCount: number;
      revenue: number;
      fuelCost: number;
      tollsCost: number;
      borderCost: number;
      customsCost: number;
      otherExpenses: number;
    }> = {};

    (trips || []).forEach((trip) => {
      if (trip.status?.toLowerCase() === 'cancelled') return;

      const origin = (trip.origin || 'Unknown').trim();
      const destination = (trip.destination || 'Unknown').trim();
      const currency = trip.currency || 'TZS';
      const routeKey = `${origin.toUpperCase()} to ${destination.toUpperCase()}::${currency}`;

      if (!routeGroups[routeKey]) {
        routeGroups[routeKey] = {
          origin,
          destination,
          currency,
          tripsCount: 0,
          revenue: 0,
          fuelCost: 0,
          tollsCost: 0,
          borderCost: 0,
          customsCost: 0,
          otherExpenses: 0
        };
      }

      const grp = routeGroups[routeKey];
      grp.tripsCount += 1;
      
      // Get trip direct cost values from trip columns. trip.revenue/price are
      // dead legacy columns (always 0) and trip.salesAmount doesn't exist —
      // the real figures are total_amount/sales_amount.
      const tripRevenue = parseFloat(trip.total_amount || trip.sales_amount || trip.revenue || trip.price || 0);
      const tripFuel = parseFloat(trip.cost_fuel || trip.costFuel || trip.fuelExpense || 0);
      const tripTolls = parseFloat(trip.cost_tolls || trip.costTolls || 0);
      const tripBorder = parseFloat(trip.cost_border || trip.costBorder || 0);
      const tripCustoms = parseFloat(trip.cost_customs || trip.costCustoms || 0);
      const tripOtherExpCol = parseFloat(trip.otherExpenses || trip.other_expenses || 0);

      // Get trip costs from expenses table
      const tripExpenses = (expenses || []).filter((e) => e.trip_id === trip.id || e.tripId === trip.id);
      const expenseFuel = tripExpenses.filter(e => e.category?.toLowerCase() === 'fuel').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
      const expenseOther = tripExpenses.filter(e => e.category?.toLowerCase() !== 'fuel').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

      grp.revenue += tripRevenue;
      grp.fuelCost += Math.max(tripFuel, expenseFuel);
      grp.tollsCost += tripTolls;
      grp.borderCost += tripBorder;
      grp.customsCost += tripCustoms;
      grp.otherExpenses += Math.max(tripOtherExpCol, expenseOther);
    });

    const routeData = Object.values(routeGroups).map((grp) => {
      const totalExpenses = grp.fuelCost + grp.tollsCost + grp.borderCost + grp.customsCost + grp.otherExpenses;
      const grossProfit = grp.revenue - totalExpenses;
      const margin = grp.revenue > 0 ? (grossProfit / grp.revenue) * 100 : 0;

      return {
        origin: grp.origin,
        destination: grp.destination,
        routeName: `${grp.origin} to ${grp.destination}`,
        currency: grp.currency,
        tripsCount: grp.tripsCount,
        totalRevenue: grp.revenue,
        totalFuelCost: grp.fuelCost,
        totalOtherExpenses: grp.tollsCost + grp.borderCost + grp.customsCost + grp.otherExpenses,
        grossProfit: grossProfit,
        profitMarginPercent: parseFloat(margin.toFixed(1))
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Summary Statistics — grouped by currency rather than blended into one
    // number, since routes above may now span more than one currency.
    const totalRoutes = routeData.length;
    const totalRevenueByCurrency: Record<string, number> = {};
    const totalCostsByCurrency: Record<string, number> = {};
    for (const r of routeData) {
      totalRevenueByCurrency[r.currency] = (totalRevenueByCurrency[r.currency] ?? 0) + r.totalRevenue;
      totalCostsByCurrency[r.currency] = (totalCostsByCurrency[r.currency] ?? 0) + (r.totalRevenue - r.grossProfit);
    }
    const bestMargin = routeData.length > 0
      ? routeData.reduce((prev, curr) => (curr.profitMarginPercent > prev.profitMarginPercent ? curr : prev), routeData[0])
      : null;

    return NextResponse.json({
      success: true,
      summary: {
        totalRoutes,
        totalRevenueByCurrency,
        totalCostsByCurrency,
        bestMarginRoute: bestMargin ? bestMargin.routeName : 'N/A',
        bestMarginPercent: bestMargin ? bestMargin.profitMarginPercent : 0
      },
      data: routeData
    });

  } catch (error: any) {
    console.error('[API Route Profitability Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
