import { defineConfig, devices } from "@playwright/test";

import { guardedPackage2BBrowserTestConfiguration } from "./tests/helpers/package-2b-browser-guard";

const browserTestConfiguration = guardedPackage2BBrowserTestConfiguration();

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "payroll-evidence-review-acceptance.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: browserTestConfiguration.authorizedOrigin,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
