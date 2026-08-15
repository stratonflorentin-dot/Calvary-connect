import { NextRequest, NextResponse } from 'next/server';
import { requireFleetReportAccess } from '../helpers';

// Real per-trip fuel figures from view_fuel_per_trip (migration 065) — no
// fabricated liters-from-cost or default-distance guesses, unlike the
// per-vehicle /api/reports/fuel route.
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

    const { data, error } = await supabase
      .from('view_fuel_per_trip')
      .select('*')
      .gte('trip_date', fromDate)
      .lte('trip_date', toDate)
      .order('trip_date', { ascending: false });

    if (error) throw error;

    const rows = data ?? [];
    const summary = {
      trips: rows.length,
      tripsWithFuelLogged: rows.filter((r) => r.fuel_entry_count > 0).length,
      totalLiters: rows.reduce((sum, r) => sum + Number(r.total_liters || 0), 0),
      totalFuelCost: rows.reduce((sum, r) => sum + Number(r.total_fuel_cost || 0), 0),
      totalDistanceKm: rows.reduce((sum, r) => sum + Number(r.distance_km || 0), 0),
    };

    return NextResponse.json({ success: true, summary, rows });
  } catch (error: any) {
    console.error('GET /api/reports/fuel-per-trip error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

interface ImportRecord {
  trip_number?: string;
  plate_number?: string;
  date?: string;
  liters?: string | number;
  amount?: string | number;
  currency?: string;
  description?: string;
}

// Bulk-imports fuel entries against existing trips (matched by trip_number)
// as real vehicle_costs rows (cost_type = 'fuel') — the same live table the
// fuel-costs entry page and view_fuel_per_trip both read/aggregate from.
// Does not create trips or vehicles; a row referencing an unknown
// trip_number/plate_number is reported as a per-row error, not silently
// dropped or guessed at.
export async function POST(request: NextRequest) {
  let supabase;
  try {
    supabase = await requireFleetReportAccess(request);
  } catch (err: any) {
    const status = String(err.message).startsWith('FORBIDDEN') ? 403 : 401;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }

  try {
    const body = await request.json();
    const records: ImportRecord[] = Array.isArray(body?.records) ? body.records : [];
    if (records.length === 0) {
      return NextResponse.json({ success: false, error: 'records array is required and must not be empty' }, { status: 400 });
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const [index, record] of records.entries()) {
      const rowLabel = `Row ${index + 1}`;
      try {
        const tripNumber = String(record.trip_number ?? '').trim();
        const plateNumber = String(record.plate_number ?? '').trim();
        const liters = record.liters != null ? Number(record.liters) : null;
        const amount = Number(record.amount);

        if (!tripNumber) throw new Error('trip_number is required');
        if (!amount || amount <= 0) throw new Error('amount must be a positive number');

        const { data: trip, error: tripError } = await supabase
          .from('trips')
          .select('id, vehicle_id, truck_id')
          .eq('trip_number', tripNumber)
          .maybeSingle();
        if (tripError) throw tripError;
        if (!trip) throw new Error(`no trip found with trip_number "${tripNumber}"`);

        let vehicleId: string | null = trip.vehicle_id ?? trip.truck_id ?? null;
        if (plateNumber) {
          const { data: vehicle, error: vehicleError } = await supabase
            .from('vehicles')
            .select('id')
            .eq('plate_number', plateNumber)
            .maybeSingle();
          if (vehicleError) throw vehicleError;
          if (!vehicle) throw new Error(`no vehicle found with plate_number "${plateNumber}"`);
          vehicleId = vehicle.id;
        }
        if (!vehicleId) throw new Error(`trip "${tripNumber}" has no vehicle assigned — include plate_number`);

        const { error: insertError } = await supabase.from('vehicle_costs').insert({
          vehicle_id: vehicleId,
          trip_id: trip.id,
          cost_type: 'fuel',
          amount,
          currency: record.currency || 'TZS',
          date: record.date || new Date().toISOString().slice(0, 10),
          liters,
          description: record.description || `Imported fuel entry — ${tripNumber}`,
        });
        if (insertError) throw insertError;

        success += 1;
      } catch (err: any) {
        failed += 1;
        errors.push(`${rowLabel}: ${err.message}`);
      }
    }

    return NextResponse.json({ success, failed, errors });
  } catch (error: any) {
    console.error('POST /api/reports/fuel-per-trip error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
