import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Public shipment tracking, same trust model as any courier tracking
 * portal — the tracking number is the input, not a secret. Uses the admin
 * client because trips_read/shipments RLS requires a staff role or being
 * the trip's own driver, with no exception for an anonymous visitor — a
 * plain browser query here always came back empty for anyone not already
 * logged in as staff.
 *
 * Accepts either a shipment number (SH-...) or a trip number (TRP-...) —
 * customers are given the shipment number, not the internal trip number,
 * so shipments must be searched first.
 */

const SHIPMENT_STAGE_TO_TRIP_STATUS: Record<string, string> = {
  created: "pending",
  approved: "pending",
  active: "in_transit",
  delivered: "delivered",
  invoiced: "delivered",
  paid: "delivered",
  cancelled: "cancelled",
};

// trips has five separate FKs into vehicles (truck/trailer/escort/hose/vehicle_id)
// and two into user_profiles (driver/customer_confirmed_by) — PostgREST refuses
// an unqualified embed when more than one relationship matches, so both joins
// below must name the exact constraint.
const TRIP_SELECT = `
  id, trip_number, origin, destination, status, cargo_type,
  client, created_at, estimated_arrival, notes, sales_amount, total_amount,
  pod_uploaded_at, updated_at,
  driver:user_profiles!fk_trips_driver_id(name),
  vehicle:vehicles!trips_truck_id_fkey(plate_number)
`;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().toUpperCase();
  if (!q) return NextResponse.json({ error: "Missing tracking number" }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: shipment } = await admin
    .from("shipments")
    .select(`
      id, shipment_number, origin_city, destination_city, status, cargo_type,
      created_at, actual_delivery,
      customer:customer_id(company_name)
    `)
    .ilike("shipment_number", `%${q}%`)
    .limit(1)
    .maybeSingle();

  if (shipment) {
    const { data: trip } = await admin
      .from("trips")
      .select(TRIP_SELECT)
      .eq("shipment_id", shipment.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      trip: {
        id: shipment.id,
        trip_number: shipment.shipment_number,
        origin: shipment.origin_city,
        destination: shipment.destination_city,
        status: SHIPMENT_STAGE_TO_TRIP_STATUS[shipment.status] ?? "pending",
        cargo: shipment.cargo_type,
        client: (shipment.customer as any)?.company_name,
        driver: (trip as any)?.driver,
        vehicle: (trip as any)?.vehicle,
        created_at: shipment.created_at,
        estimated_time: (trip as any)?.estimated_arrival,
        notes: (trip as any)?.notes,
        salesAmount: (trip as any)?.total_amount ?? (trip as any)?.sales_amount,
        delivered_at: shipment.actual_delivery ?? (trip as any)?.pod_uploaded_at,
      },
    });
  }

  const { data: trip, error } = await admin
    .from("trips")
    .select(TRIP_SELECT)
    .ilike("trip_number", `%${q}%`)
    .limit(1)
    .maybeSingle();

  if (error || !trip) {
    return NextResponse.json({ error: "No shipment found with that tracking number" }, { status: 404 });
  }
  const t = trip as any;
  return NextResponse.json({
    trip: {
      id: t.id,
      trip_number: t.trip_number,
      origin: t.origin,
      destination: t.destination,
      status: t.status,
      cargo: t.cargo_type,
      client: t.client,
      created_at: t.created_at,
      estimated_time: t.estimated_arrival,
      notes: t.notes,
      salesAmount: t.total_amount ?? t.sales_amount,
      delivered_at: t.pod_uploaded_at ?? (t.status?.toLowerCase() === "delivered" ? t.updated_at : null),
      driver: t.driver,
      vehicle: t.vehicle,
    },
  });
}
