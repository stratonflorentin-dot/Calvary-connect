import { NextRequest } from "next/server";
import { withAuthAndRateLimit } from "@/lib/api-gateway";
import { callExternalApi, type PublicHoliday } from "@/lib/external-apis";
import { EXTERNAL_API_ROLES, externalApiJson, invalidExternalRequest } from "@/lib/external-api-routes";

export const runtime = "nodejs";

export const GET = withAuthAndRateLimit(async (request: NextRequest) => {
  const rawYear = request.nextUrl.searchParams.get("year")?.trim();
  const year = rawYear ? Number(rawYear) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return invalidExternalRequest("nager", "year must be an integer from 2000 through 2100.");
  }

  return externalApiJson(await callExternalApi<PublicHoliday[]>("nager", "holidays_tz", { year }));
}, EXTERNAL_API_ROLES);
