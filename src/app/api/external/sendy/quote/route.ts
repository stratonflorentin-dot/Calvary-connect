import { NextRequest, NextResponse } from "next/server";
import { withAuthAndRateLimit } from "@/lib/api-gateway";
import { EXTERNAL_API_ROLES, invalidExternalRequest } from "@/lib/external-api-routes";

export const runtime = "nodejs";

interface QuoteRequest {
  origin?: unknown;
  destination?: unknown;
  weight?: unknown;
}

export const POST = withAuthAndRateLimit(async (request: NextRequest) => {
  let body: QuoteRequest;
  try {
    body = (await request.json()) as QuoteRequest;
  } catch {
    return invalidExternalRequest("sendy", "Request body must be valid JSON.");
  }

  const origin = typeof body.origin === "string" ? body.origin.trim() : "";
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  const weight = typeof body.weight === "number" ? body.weight : Number(body.weight);
  if (!origin || origin.length > 160 || !destination || destination.length > 160 || !Number.isFinite(weight) || weight <= 0 || weight > 100_000) {
    return invalidExternalRequest("sendy", "origin, destination, and a positive weight up to 100000 are required.");
  }

  return NextResponse.json({ success: false, error: "Service not available in Tanzania", message: "No working public Sendy endpoint is configured for this deployment. Use an approved local logistics provider." }, { status: 503 });
}, EXTERNAL_API_ROLES);
