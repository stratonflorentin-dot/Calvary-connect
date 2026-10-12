import { expect, test } from "@playwright/test";
import { authenticateAndMock } from "./helpers";

test("fuel route variants issue authenticated requests and support CSV downloads", async ({ page }) => {
  await authenticateAndMock(page);
  await page.goto("/map", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Fleet tracking" })).toBeVisible({ timeout: 30_000 });

  const result = await page.evaluate(async () => {
    const requests = [
      "/api/external/fuel/prices?region=tanzania",
      "/api/external/fuel/prices?region=kenya&fuel=diesel",
      "/api/external/fuel/prices?region=dsm&summary=true&fuel=gasoline",
      "/api/external/fuel/prices?compare=true&format=csv",
    ];
    const responses = await Promise.all(requests.map(async (url) => {
      const response = await fetch(url, { headers: { authorization: "Bearer e2e-access-token" } });
      return { url, status: response.status, contentType: response.headers.get("content-type"), body: await response.text() };
    }));
    return responses;
  });

  expect(result.map((entry) => entry.status)).toEqual([200, 200, 200, 200]);
  expect(result[3]?.contentType).toContain("text/csv");
  expect(result[3]?.body).toContain("fuel,tanzania.price,kenya.price");
});
