import { expect, test } from "@playwright/test";
import { authenticateAndMock } from "./helpers";

test("map layers open from controls and keyboard shortcuts, and remain selected after reload", async ({ page }, testInfo) => {
  const mapWorkerErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Worker failed to load/i.test(message.text())) {
      mapWorkerErrors.push(message.text());
    }
  });
  await authenticateAndMock(page);
  await page.route("https://api.maptiler.com/**", (route) => route.abort());
  await page.goto("/map", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Fleet tracking" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Loading map…")).toHaveCount(0, { timeout: 20_000 });
  expect(mapWorkerErrors).toEqual([]);

  const globeMode = page.locator('[title="Globe view"]');
  await expect(globeMode).toHaveAttribute("aria-pressed", "true");
  await page.locator('[title="2D map"]').click();
  await page.locator('[title="Globe view"]').click();
  await expect(globeMode).toHaveAttribute("aria-pressed", "true");

  await page.locator('[title="Fuel prices"]').click();
  await expect(page.getByRole("heading", { name: "Fuel prices by hub" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show Tanga hub fuel trend" })).toBeVisible();
  await page.getByRole("button", { name: "Show Tanga hub fuel trend" }).click();
  await expect(page.getByText("Tanga · EWURA retail cap")).toBeVisible();
  await expect(page.getByText(/National diesel benchmark/)).toBeVisible();

  await page.keyboard.press("p");
  await expect(page.getByRole("heading", { name: "Dar es Salaam port" })).toBeVisible();
  await page.keyboard.press("b");
  await expect(page.getByRole("heading", { name: "Border status" })).toBeVisible();
  await page.keyboard.press("m");
  await expect(page.getByRole("heading", { name: "Fuel market trends" })).toBeVisible();
  await expect(page.getByText(/\/ 3mo/).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("external-map-panels.png"), fullPage: true });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fleet-map:external-panel:v1"))).toBe("market");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Fuel market trends" })).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Fuel market trends" })).toHaveCount(0);
});
