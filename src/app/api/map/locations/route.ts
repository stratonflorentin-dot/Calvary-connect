import { NextRequest, NextResponse } from "next/server";
import { getDriverLocationsForMapAction } from "@/app/tracking/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Sign in to view fleet locations." }, { status: 401 });
  }
  const result = await getDriverLocationsForMapAction(authorization.slice(7));
  if (result.error) {
    const status = result.error === "Not signed in" || result.error === "Invalid session" ? 401 : 403;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ locations: result.locations, driversWithoutGps: result.driversWithoutGps ?? [] });
}
