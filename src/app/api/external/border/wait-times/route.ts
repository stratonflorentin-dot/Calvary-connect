import { NextRequest, NextResponse } from "next/server";
import { withAuthAndRateLimit } from "@/lib/api-gateway";
import { EXTERNAL_API_ROLES, invalidExternalRequest } from "@/lib/external-api-routes";

export const runtime = "nodejs";

export const GET = withAuthAndRateLimit(async (request: NextRequest) => {
  const crossing = request.nextUrl.searchParams.get("crossing")?.trim();
  if (!crossing || crossing.length < 2 || crossing.length > 60 || !/^[A-Za-z0-9 _-]+$/.test(crossing)) {
    return invalidExternalRequest("border", "crossing must be a valid crossing name or identifier.");
  }

  return NextResponse.json({ success: false, error: "No public API available", message: "No verified live border wait-time feed is available. Check manually with the border post or TRA.", manualUrl: "https://identity.tra.go.tz/Account/Login" }, { status: 503 });
}, EXTERNAL_API_ROLES);
