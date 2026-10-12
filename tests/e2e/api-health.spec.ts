import { expect, test } from "@playwright/test";
import { authenticateAndMock } from "./helpers";

test("admin health dashboard reports providers, runs checks, and invalidates cache", async ({ page }) => {
  await authenticateAndMock(page);
  await page.goto("/admin/api-health", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "External API health" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Healthy", { exact: true })).toBeVisible();
  await expect(page.getByText(/76 MB/)).toBeVisible();

  await page.getByRole("button", { name: "Invalidate cache" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("Cleared 4 cached entries");
  await expect(page.getByText("Cache invalidated", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Test configured endpoints" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("1 of 1 configured endpoints responded");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("external-api-health.json");
});
