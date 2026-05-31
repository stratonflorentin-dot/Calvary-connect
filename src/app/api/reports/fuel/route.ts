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

    // 3. Fetch fuel requests
    const { data: fuelRequests, error: fuelError } = await supabase
      .from('fuel_requests')
      .select('*')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .eq('status', 'approved');

    // 4. Fetch expenses for fuel
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', fromDate)
      .lte('date', toDate)
      .eq('category', 'fuel');

    const vehicleFuelData = (vehicles || []).map((vehicle) => {
      // Find trips for this vehicle
      const vehicleTrips = (trips || []).filter(
        (t) => t.truck_id === vehicle.id || t.truckId === vehicle.id || t.vehicle_id === vehicle.id
      );
      const completedTrips = vehicleTrips.filter((t) => t.status?.toLowerCase() !== 'cancelled');

      // Sum KM driven
      const kmDriven = completedTrips.reduce((sum, t) => {
        return sum + (t.actual_distance || t.actualDistance || t.estimated_distance || t.estimatedDistance || t.distance_km || 120);
      }, 0);

      // Sum fuel costs from requests
      const vehicleFuelRequests = (fuelRequests || []).filter((f) => f.vehicle_id === vehicle.id || f.vehicleId === vehicle.id);
      const fuelCostFromRequests = vehicleFuelRequests.reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);

      // Sum fuel costs from expenses
      const vehicleFuelExpenses = (expenses || []).filter((e) => e.vehicle_id === vehicle.id || e.vehicleId === vehicle.id);
      const fuelCostFromExpenses = vehicleFuelExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

      const totalFuelCost = Math.max(fuelCostFromRequests, fuelCostFromExpenses);
      
      // Let's compute liters. Check if requests have a liters column, or default to 3,000 TZS per liter
      const totalLitres = Math.round(totalFuelCost / 3000);

      // Litres per 100km
      const litresPer100km = kmDriven > 0 
        ? parseFloat(((totalLitres / kmDriven) * 100).toFixed(1)) 
        : 0;

      return {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber || vehicle.plate_number || 'N/A',
        makeModel: `${vehicle.make || 'Unknown'} ${vehicle.model || ''}`.trim(),
        totalLitresDispensed: totalLitres,
        totalFuelCostTZS: totalFuelCost,
        kmDriven,
        litresPer100km,
        status: vehicle.status || 'available'
      };
    });

    // Summary Statistics
    const totalLitres = vehicleFuelData.reduce((sum, v) => sum + v.totalLitresDispensed, 0);
    const totalCost = vehicleFuelData.reduce((sum, v) => sum + v.totalFuelCostTZS, 0);
    const totalKm = vehicleFuelData.reduce((sum, v) => sum + v.kmDriven, 0);
    
    // Find the most fuel efficient vehicle (lowest L/100km among those with >100 km)
    const efficientVehicles = vehicleFuelData.filter((v) => v.kmDriven > 100 && v.litresPer100km > 0);
    const mostEfficient = efficientVehicles.length > 0
      ? efficientVehicles.reduce((prev, curr) => (curr.litresPer100km < prev.litresPer100km ? curr : prev), efficientVehicles[0])
      : null;

    return NextResponse.json({
      success: true,
      summary: {
        totalLitresDispensed: totalLitres,
        totalFuelCostTZS: totalCost,
        totalKmDriven: totalKm,
        mostEfficientVehicle: mostEfficient ? `${mostEfficient.plateNumber} (${mostEfficient.litresPer100km} L/100km)` : 'N/A'
      },
      data: vehicleFuelData
    });

  } catch (error: any) {
    console.error('[API Fuel Consumption Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
