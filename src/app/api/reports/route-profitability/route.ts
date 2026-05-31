import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
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

    // Group trips by unique Route: Origin -> Destination
    const routeGroups: Record<string, {
      origin: string;
      destination: string;
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
      const routeKey = `${origin.toUpperCase()} to ${destination.toUpperCase()}`;

      if (!routeGroups[routeKey]) {
        routeGroups[routeKey] = {
          origin,
          destination,
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
      
      // Get trip direct cost values from trip columns
      const tripRevenue = parseFloat(trip.revenue || trip.price || trip.salesAmount || 0);
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
        tripsCount: grp.tripsCount,
        totalRevenueTZS: grp.revenue,
        totalFuelCostTZS: grp.fuelCost,
        totalOtherExpensesTZS: grp.tollsCost + grp.borderCost + grp.customsCost + grp.otherExpenses,
        grossProfitTZS: grossProfit,
        profitMarginPercent: parseFloat(margin.toFixed(1))
      };
    }).sort((a, b) => b.totalRevenueTZS - a.totalRevenueTZS);

    // Summary Statistics
    const totalRoutes = routeData.length;
    const totalRevenue = routeData.reduce((sum, r) => sum + r.totalRevenueTZS, 0);
    const totalCosts = routeData.reduce((sum, r) => sum + (r.totalRevenueTZS - r.grossProfitTZS), 0);
    const bestMargin = routeData.length > 0 
      ? routeData.reduce((prev, curr) => (curr.profitMarginPercent > prev.profitMarginPercent ? curr : prev), routeData[0])
      : null;

    return NextResponse.json({
      success: true,
      summary: {
        totalRoutes,
        totalRevenue,
        totalCosts,
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
