import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Public shipment tracking, same trust model as any courier tracking
 * portal — the trip number is the input, not a secret. Uses the admin
 * client because trips_read RLS (058_performance_hardening.sql) requires
 * a staff role or being the trip's own driver, with no exception for an
 * anonymous visitor — a plain browser query here always came back empty
 * for anyone not already logged in as staff.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().toUpperCase();
  if (!q) return NextResponse.json({ error: "Missing tracking number" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
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

  if (error || !data) {
    return NextResponse.json({ error: "No shipment found with that tracking number" }, { status: 404 });
  }
  return NextResponse.json({ trip: data });
}
