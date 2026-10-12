import { NextRequest, NextResponse } from "next/server";
import { withAuthAndRateLimit } from "@/lib/api-gateway";
import { EXTERNAL_API_ROLES, invalidExternalRequest } from "@/lib/external-api-routes";

export const runtime = "nodejs";

export const GET = withAuthAndRateLimit(async (request: NextRequest) => {
  const declarationId = request.nextUrl.searchParams.get("declaration_id")?.trim();
  if (!declarationId || declarationId.length < 3 || declarationId.length > 120) {
    return invalidExternalRequest("tra", "declaration_id must contain between 3 and 120 characters.");
  }

  return NextResponse.json({ success: false, error: "No public API available", message: "Customs status requires authorized TRA portal access. Contact an administrator for credentials.", manualUrl: "https://identity.tra.go.tz/Account/Login" }, { status: 503 });
}, EXTERNAL_API_ROLES);
