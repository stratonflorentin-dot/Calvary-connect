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

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().toUpperCase();
  if (!q) return NextResponse.json({ error: "Missing tracking number" }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: shipment } = await admin
    .from("shipments")
    .select(`
      id, shipment_number, origin_city, destination_city, status, cargo_type,
      created_at, delivered_at,
      customer:customer_id(company_name)
    `)
    .ilike("shipment_number", `%${q}%`)
    .limit(1)
    .maybeSingle();

  if (shipment) {
    const { data: trip } = await admin
      .from("trips")
      .select(`
        status, notes, estimated_time, salesAmount,
        driver:user_profiles(name),
        vehicle:vehicles(plate_number)
      `)
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
        driver: trip?.driver,
        vehicle: trip?.vehicle,
        created_at: shipment.created_at,
        estimated_time: trip?.estimated_time,
        notes: trip?.notes,
        salesAmount: trip?.salesAmount,
        delivered_at: shipment.delivered_at,
      },
    });
  }

  const { data: trip, error } = await admin
    .from("trips")
    .select(`
      id, trip_number, origin, destination, status, cargo,
      client, created_at, estimated_time, notes, salesAmount, delivered_at,
      driver:user_profiles(name),
      vehicle:vehicles(plate_number)
    `)
    .ilike("trip_number", `%${q}%`)
    .limit(1)
    .maybeSingle();

  if (error || !trip) {
    return NextResponse.json({ error: "No shipment found with that tracking number" }, { status: 404 });
  }
  return NextResponse.json({ trip });
}
