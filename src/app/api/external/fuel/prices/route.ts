import { NextRequest, NextResponse } from "next/server";
import { withAuthAndRateLimit } from "@/lib/api-gateway";
import {
  apiError,
  callExternalApi,
  type FuelPriceEntry,
  type KenyaFuelPriceEntry,
  type PriceHistoryTable,
  type RegionalDieselSummary,
  type ApiResponse,
} from "@/lib/external-apis";
import { EXTERNAL_API_ROLES, externalApiJson } from "@/lib/external-api-routes";

export const runtime = "nodejs";
export const maxDuration = 60;

const COUNTRY_REGIONS = new Set(["", "tz", "tanzania", "country"]);
const KENYA_REGIONS = new Set(["ke", "kenya"]);
const DAR_REGIONS = new Set(["dsm", "dar", "dar-es-salaam", "dar_es_salaam"]);
const FUEL_NAMES = new Set(["gasoline", "diesel", "kerosene"]);

function parsePrice(value: unknown): number | null {
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function csvCell(value: unknown): string {
  let text = value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  if (/^[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function formatResponse(response: ApiResponse<unknown>, format: string) {
  if (format !== "csv" || !response.success) return externalApiJson(response);
  const data = Array.isArray(response.data) ? response.data : [response.data];
  const records = data.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row));
  const headers = [...new Set(records.flatMap((record) => Object.keys(record)))];
  const lines = headers.length ? [headers.map(csvCell).join(","), ...records.map((record) => headers.map((header) => csvCell(record[header])).join(","))] : [];
  return new NextResponse(lines.join("\r\n"), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="fuel-prices.csv"',
      "cache-control": "no-store",
      "x-external-source": response.meta.source,
      "x-external-fetched-at": response.meta.fetchedAt,
    },
  });
}

export const GET = withAuthAndRateLimit(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get("region")?.trim().toLowerCase() ?? "";
  const fuel = searchParams.get("fuel")?.trim().toLowerCase() ?? "";
  const history = searchParams.get("history") === "true";
  const compare = searchParams.get("compare") === "true";
  const summary = searchParams.get("summary") === "true";
  const format = searchParams.get("format")?.trim().toLowerCase() ?? "json";
  if (format !== "json" && format !== "csv") return externalApiJson(apiError("globalpetrolprices", "INVALID_ARGUMENT", "format must be json or csv."));

  if (compare) {
    const [tz, ke] = await Promise.all([
      callExternalApi<FuelPriceEntry[]>("globalpetrolprices", "fuel_prices"),
      callExternalApi<KenyaFuelPriceEntry[]>("globalpetrolprices", "kenya_fuel_prices"),
    ]);
    if (!tz.success) return formatResponse(tz, format);
    if (!ke.success) return formatResponse(ke, format);
    const tanzania = tz.data.filter((row) => FUEL_NAMES.has(row.fuel?.replace(/\s+prices?$/i, "").trim().toLowerCase() ?? ""));
    const kenya = ke.data.filter((row) => FUEL_NAMES.has(row.fuel?.replace(/\s+prices?$/i, "").trim().toLowerCase() ?? ""));
    const selected = fuel ? fuel.replace(/\s+prices?$/, "") : "";
    const rows = tanzania
      .filter((row) => !selected || row.fuel?.toLowerCase().startsWith(selected))
      .map((row) => {
        const counterpart = kenya.find((entry) => entry.fuel?.toLowerCase() === row.fuel?.toLowerCase());
        return {
          fuel: row.fuel,
          tanzania: { date: row.date, price: parsePrice(row.tzs), currency: "TZS/liter" },
          kenya: counterpart ? { date: counterpart.date, price: parsePrice(counterpart.kes), currency: "KES/liter" } : null,
        };
      });
    return formatResponse({ success: true as const, data: rows, meta: tz.meta }, format);
  }

  if (KENYA_REGIONS.has(region)) {
    if (history) return formatResponse(apiError("globalpetrolprices", "UNSUPPORTED_REGION", "Historical prices are available for Tanzania only."), format);
    const response = await callExternalApi<KenyaFuelPriceEntry[]>("globalpetrolprices", "kenya_fuel_prices");
    if (!response.success || !fuel || fuel === "all") return formatResponse(response, format);
    const selected = fuel.replace(/\s+prices?$/, "");
    if (!["gasoline", "diesel", "kerosene"].includes(selected)) {
      return formatResponse(apiError("globalpetrolprices", "INVALID_ARGUMENT", "fuel must be gasoline, diesel, kerosene, or all."), format);
    }
    return formatResponse({ ...response, data: response.data.filter((row) => row.fuel?.toLowerCase().startsWith(selected)) }, format);
  }

  if (DAR_REGIONS.has(region) || (summary && DAR_REGIONS.has(region))) {
    if (fuel === "gasoline") {
      return formatResponse(await callExternalApi<RegionalDieselSummary[]>("globalpetrolprices", "gasoline_price_dsm_summary"), format);
    }
    if (fuel && fuel !== "diesel") {
      return formatResponse(apiError("globalpetrolprices", "UNSUPPORTED_REGION", "Dar es Salaam summaries are available for gasoline and diesel."), format);
    }
    return formatResponse(await callExternalApi<RegionalDieselSummary[]>("globalpetrolprices", "diesel_price_dsm"), format);
  }

  if (COUNTRY_REGIONS.has(region) && history) {
    const operationByFuel: Record<string, string> = {
      gasoline: "gasoline_price_history",
      diesel: "diesel_price_history",
      kerosene: "kerosene_price_history",
    };
    if (operationByFuel[fuel]) {
      return formatResponse(await callExternalApi<PriceHistoryTable[]>("globalpetrolprices", operationByFuel[fuel]!), format);
    }
    return formatResponse(apiError("globalpetrolprices", "INVALID_ARGUMENT", "For price history, set fuel to gasoline, diesel, or kerosene."), format);
  }

  if (COUNTRY_REGIONS.has(region) && (!fuel || fuel === "all")) {
    return formatResponse(await callExternalApi<FuelPriceEntry[]>("globalpetrolprices", "fuel_prices"), format);
  }

  return formatResponse(
    apiError(
      "globalpetrolprices",
      "UNSUPPORTED_REGION",
      "Available fuel data: current Tanzania and Kenya prices, Tanzania gasoline/diesel/kerosene history, and Dar es Salaam gasoline/diesel summaries.",
    ), format,
  );
}, EXTERNAL_API_ROLES);
