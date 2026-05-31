import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
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

      // Sum Revenue
      const totalRevenue = completedTrips.reduce((sum, t) => {
        return sum + (t.revenue || t.price || t.salesAmount || 0);
      }, 0);

      // Sum direct costs from trips table
      const tripFuel = completedTrips.reduce((sum, t) => sum + parseFloat(t.cost_fuel || t.costFuel || t.fuelExpense || 0), 0);
      const tripTolls = completedTrips.reduce((sum, t) => sum + parseFloat(t.cost_tolls || t.costTolls || 0), 0);
      const tripBorder = completedTrips.reduce((sum, t) => sum + parseFloat(t.cost_border || t.costBorder || 0), 0);
      const tripCustoms = completedTrips.reduce((sum, t) => sum + parseFloat(t.cost_customs || t.costCustoms || 0), 0);
      const tripOther = completedTrips.reduce((sum, t) => sum + parseFloat(t.otherExpenses || t.other_expenses || 0), 0);

      const directTripCosts = tripFuel + tripTolls + tripBorder + tripCustoms + tripOther;

      // Sum expenses from expenses table
      const vehicleExpenses = (expenses || []).filter((e) => e.vehicle_id === vehicle.id || e.vehicleId === vehicle.id);
      const expensesTotal = vehicleExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

      const totalExpenses = Math.max(directTripCosts, expensesTotal);
      const netProfit = totalRevenue - totalExpenses;
      const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      return {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber || vehicle.plate_number || 'N/A',
        makeModel: `${vehicle.make || 'Unknown'} ${vehicle.model || ''}`.trim(),
        tripsCount: completedTrips.length,
        totalRevenueTZS: totalRevenue,
        totalExpensesTZS: totalExpenses,
        netProfitTZS: netProfit,
        profitMarginPercent: parseFloat(margin.toFixed(1)),
        status: vehicle.status || 'available'
      };
    }).sort((a, b) => b.totalRevenueTZS - a.totalRevenueTZS);

    // Summary Statistics
    const totalVehiclesActive = vehicleRevenueData.filter((v) => v.tripsCount > 0).length;
    const totalRevenue = vehicleRevenueData.reduce((sum, v) => sum + v.totalRevenueTZS, 0);
    const totalExpenses = vehicleRevenueData.reduce((sum, v) => sum + v.totalExpensesTZS, 0);
    const netProfit = totalRevenue - totalExpenses;

    const highestRevenueVehicle = vehicleRevenueData.length > 0
      ? vehicleRevenueData.reduce((prev, curr) => (curr.totalRevenueTZS > prev.totalRevenueTZS ? curr : prev), vehicleRevenueData[0])
      : null;

    return NextResponse.json({
      success: true,
      summary: {
        totalVehiclesActive,
        totalRevenue,
        totalExpenses,
        netProfit,
        bestPerformingVehicle: highestRevenueVehicle ? `${highestRevenueVehicle.plateNumber}` : 'N/A'
      },
      data: vehicleRevenueData
    });

  } catch (error: any) {
    console.error('[API Vehicle Revenue Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
