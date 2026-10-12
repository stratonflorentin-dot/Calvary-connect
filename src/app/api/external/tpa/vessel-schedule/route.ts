import { NextRequest } from "next/server";
import { withAuthAndRateLimit } from "@/lib/api-gateway";
import { callExternalApi } from "@/lib/external-apis";
import { EXTERNAL_API_ROLES, externalApiJson } from "@/lib/external-api-routes";

export const runtime = "nodejs";

export const GET = withAuthAndRateLimit(async (_request: NextRequest) => {
  // TPA publishes the current snapshot without date query parameters.
  return externalApiJson(await callExternalApi("tpa", "vessel_schedule"));
}, EXTERNAL_API_ROLES);
