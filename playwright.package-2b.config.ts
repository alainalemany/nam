import { defineConfig } from "@playwright/test";

import { guardedPackage2BBrowserTestConfiguration } from "./tests/helpers/package-2b-browser-guard";

// Deliberately evaluated while Playwright loads configuration. A bad environment
// therefore fails before global setup constructs Prisma or a browser launches.
const configuration = guardedPackage2BBrowserTestConfiguration();

function applicationEnvironment(reviewerEmployeeId: string) {
  return {
    DATABASE_URL: configuration.databaseUrl,
    NAM_PAYROLL_OWNER_EMPLOYEE_ID: configuration.ownerEmployeeId,
    NAM_PAYROLL_EVIDENCE_REVIEWER_EMPLOYEE_ID: reviewerEmployeeId,
    NAM_PAYROLL_ACCESS_KEY: configuration.accessKey,
    NAM_PAYROLL_SESSION_SECRET: configuration.sessionSecret,
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "payroll-rate-history-acceptance.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  globalSetup: "./tests/helpers/package-2b-browser-global-setup.ts",
  outputDir: "/tmp/nam-package-2b-playwright-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "/tmp/nam-package-2b-playwright-results.json" }],
  ],
  use: {
    baseURL: configuration.authorizedOrigin,
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "corepack pnpm exec next start --hostname 127.0.0.1 --port 3102",
      url: `${configuration.authorizedOrigin}/payroll/access`,
      env: applicationEnvironment(configuration.authorizedReviewerEmployeeId),
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "corepack pnpm exec next start --hostname 127.0.0.1 --port 3103",
      url: `${configuration.mismatchedReviewerOrigin}/payroll/access`,
      env: applicationEnvironment(configuration.mismatchedReviewerEmployeeId),
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
