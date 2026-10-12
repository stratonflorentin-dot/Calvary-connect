import { NextRequest } from "next/server";
import { withAuthAndRateLimit } from "@/lib/api-gateway";
import { callExternalApi, type ExchangeRates } from "@/lib/external-apis";
import { EXTERNAL_API_ROLES, externalApiJson, invalidExternalRequest } from "@/lib/external-api-routes";

export const runtime = "nodejs";

export const GET = withAuthAndRateLimit(async (request: NextRequest) => {
  const base = request.nextUrl.searchParams.get("base")?.trim().toUpperCase() || "TZS";
  if (!/^[A-Z]{3}$/.test(base)) {
    return invalidExternalRequest("exchangerate", "base must be a three-letter currency code.");
  }

  return externalApiJson(await callExternalApi<ExchangeRates>("exchangerate", "rates", { base }));
}, EXTERNAL_API_ROLES);
