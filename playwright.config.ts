import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test.local", override: false });
loadEnv({ path: ".env.local", override: false });

const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

export default defineConfig({
  testDir: "./tests/e2e",
  // The Next dev server compiles the fleet map and external panels on demand;
  // serialize browser work so those first-request compilations do not compete.
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    headless: true,
    launchOptions: existsSync(edgePath) ? { executablePath: edgePath } : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/run-next.cjs dev -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
