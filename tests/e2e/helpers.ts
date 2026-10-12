import type { Page } from "@playwright/test";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e-admin@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { name: "E2E Administrator" },
  identities: [],
  created_at: "2026-01-01T00:00:00.000Z",
};

const health = {
  providers: { tpa: { status: "healthy", calls: 4, failures: 0, lastLatencyMs: 120, lastCheckAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString() } },
  cache: { hits: 8, misses: 2, entries: 4 },
  memory: { heapUsed: 80_000_000, rss: 220_000_000 },
  redisStatus: "not_configured",
};

export async function authenticateAndMock(page: Page, role: "ADMIN" | "OPERATOR" = "ADMIN") {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  await page.addInitScript(({ key, storedUser }) => {
    localStorage.setItem(key, JSON.stringify({
      access_token: "e2e-access-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "e2e-refresh-token",
      user: storedUser,
    }));
  }, { key: storageKey, storedUser: user });

  await page.route("**/auth/v1/**", async (route) => route.fulfill({ json: user }));
  await page.route("**/rest/v1/**", async (route) => {
    if (new URL(route.request().url()).pathname.includes("/user_profiles")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...user, name: "E2E Administrator", role, status: "active" }) });
    }
    return route.fulfill({ json: [] });
  });
  // The auth provider also runs server actions to activate newly invited
  // accounts. They are unrelated to these mocked-page flows, so let the
  // mocked profile resolve without reaching a configured database.
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      return route.fulfill({ status: 200, body: "" });
    }
    if (route.request().url().includes("api.maptiler.com")) return route.abort();
    return route.fallback();
  });
  await page.route("**/api/external/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/health") && route.request().method() === "GET") {
      return route.fulfill({ json: { success: true, data: health } });
    }
    if (url.pathname.endsWith("/health") && route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { action: string };
      return route.fulfill({ json: body.action === "invalidate-cache"
        ? { success: true, data: { clearedEntries: 4 } }
        : { success: true, data: [{ site: "tpa", operation: "vessel_schedule", success: true }] } });
    }
    if (url.pathname.endsWith("/fuel/ewura-caps")) {
      return route.fulfill({ json: { success: true, data: [
        { city: "Dar es Salaam", petrol: 4057, diesel: 4086, kerosene: 4067 },
        { city: "Tanga", petrol: 4123, diesel: 4152, kerosene: 4133 },
      ], meta: { source: "EWURA monthly retail cap PDF", fetchedAt: new Date().toISOString(), effectiveDate: "7 October 2026" } } });
    }
    if (url.pathname.endsWith("/tpa/vessel-schedule")) {
      return route.fulfill({ json: { success: true, data: [{ rows: ["header"] }, { rows: ["h1", "h2", "2 ASC GLORY 14.5 191 0 190 General Cargo 2026-10-14 06:30:00"] }, { rows: ["header", "120 ship Waiting to berth"] }], meta: { fetchedAt: new Date().toISOString() } } });
    }
    if (url.pathname.endsWith("/fuel/prices")) {
      if (url.searchParams.get("format") === "csv") return route.fulfill({ status: 200, contentType: "text/csv", body: 'fuel,tanzania.price,kenya.price\nDiesel,3877,216.57' });
      if (url.searchParams.get("history") === "true") return route.fulfill({ json: { success: true, data: [{ table_text: "Diesel prices Current price 3,877.00 Three months ago 4,182.00 One year ago 2,704.00" }], meta: { fetchedAt: new Date().toISOString() } } });
      return route.fulfill({ json: { success: true, data: [{ fuel: "Diesel prices", date: "2026-10-05", tzs: "3877" }, { fuel: "Gasoline prices", date: "2026-10-05", tzs: "3796" }], meta: { fetchedAt: new Date().toISOString() } } });
    }
    return route.fulfill({ json: { success: true, data: [], meta: { fetchedAt: new Date().toISOString() } } });
  });
  await page.route("**/api/map/locations", async (route) => route.fulfill({
    json: { locations: [], driversWithoutGps: ["Test Driver"] },
  }));
}
