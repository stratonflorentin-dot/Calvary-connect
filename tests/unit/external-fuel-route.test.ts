import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-gateway", () => ({ withAuthAndRateLimit: (handler: unknown) => handler }));
vi.mock("@/lib/external-apis", () => ({
  callExternalApi: vi.fn(),
  apiError: (source: string, code: string, message: string) => ({ success: false, error: { code, message }, meta: { source, cached: false, fetchedAt: "2026-10-12T00:00:00Z", expiresAt: "2026-10-12T00:00:00Z" } }),
  apiResponseStatus: (response: { success: boolean }) => response.success ? 200 : 400,
}));

import { GET } from "@/app/api/external/fuel/prices/route";
import { callExternalApi } from "@/lib/external-apis";

const meta = { source: "globalpetrolprices", cached: false, fetchedAt: "2026-10-12T00:00:00Z", expiresAt: "2026-10-12T00:05:00Z" };
const tanzania = [
  { fuel: "Fuels, price per liter", date: "Date", tzs: "TZS", usd: "USD" },
  { fuel: "Diesel prices", date: "05.10.2026", tzs: "3877", usd: "1.474" },
  { fuel: "Gasoline prices", date: "05.10.2026", tzs: "3796", usd: "1.443" },
];
const kenya = [
  { fuel: "Fuels, price per liter", date: "Date", kes: "KES", usd: "USD" },
  { fuel: "Diesel prices", date: "05.10.2026", kes: "216.57", usd: "1.667" },
  { fuel: "Gasoline prices", date: "05.10.2026", kes: "212.61", usd: "1.637" },
];

function request(query: string) {
  return new NextRequest(`http://localhost/api/external/fuel/prices${query}`);
}

describe("external fuel prices route", () => {
  beforeEach(() => vi.mocked(callExternalApi).mockReset());

  it("compares Tanzania and Kenya prices by fuel without currency conversion", async () => {
    vi.mocked(callExternalApi).mockImplementation(async (_site, operation) => ({
      success: true,
      data: (operation === "fuel_prices" ? tanzania : kenya) as never,
      meta,
    }));
    const response = await GET(request("?compare=true"));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data[0]).toMatchObject({ fuel: "Diesel prices", tanzania: { price: 3877, currency: "TZS/liter" }, kenya: { price: 216.57, currency: "KES/liter" } });
  });

  it("exports compare results as Excel-compatible CSV", async () => {
    vi.mocked(callExternalApi).mockImplementation(async (_site, operation) => ({ success: true, data: (operation === "fuel_prices" ? tanzania : kenya) as never, meta }));
    const response = await GET(request("?compare=true&format=csv"));
    const body = await response.text();
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("fuel-prices.csv");
    expect(body).toContain('"fuel","tanzania","kenya"');
    expect(body).toContain("3877");
    expect(body).toContain("216.57");
  });

  it("filters Kenya national prices for the requested fuel", async () => {
    vi.mocked(callExternalApi).mockResolvedValue({ success: true, data: kenya as never, meta });
    const response = await GET(request("?region=kenya&fuel=diesel"));
    const payload = await response.json();
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].fuel).toBe("Diesel prices");
  });

  it("rejects unknown formats", async () => {
    const response = await GET(request("?format=xlsx"));
    expect(response.status).toBe(400);
    expect(vi.mocked(callExternalApi)).not.toHaveBeenCalled();
  });
});
