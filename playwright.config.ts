import { defineConfig } from "@playwright/test";

const viewports = [
  { label: "1180x820", width: 1180, height: 820 },
  { label: "1024x768", width: 1024, height: 768 },
  { label: "834x1194", width: 834, height: 1194 },
] as const;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  outputDir: "/tmp/nam-playwright-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "/tmp/nam-ddr-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3100",
    hasTouch: true,
    trace: "retain-on-failure",
    screenshot:
      process.env.NAM_DDR_CAPTURE_VISUALS === "1" ? "on" : "only-on-failure",
  },
  projects: ["chromium", "webkit"].flatMap((browserName) =>
    viewports.map((viewport) => ({
      name: `${browserName}-${viewport.label}`,
      use: {
        browserName: browserName as "chromium" | "webkit",
        viewport: { width: viewport.width, height: viewport.height },
        ...(browserName === "chromium"
          ? { launchOptions: { args: ["--enable-precise-memory-info"] } }
          : {}),
      },
    })),
  ),
  webServer: {
    command:
      "NAM_DDR_STRESS_TEST=1 corepack pnpm exec next dev --hostname 0.0.0.0 --port 3100",
    url: "http://127.0.0.1:3100/dragline-delay-reports/stress?session=health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
