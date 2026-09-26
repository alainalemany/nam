import { expect, test, type Page } from "@playwright/test";

const browserFailures = new Map<string, string[]>();

async function waitForDdrHydration(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__NAM_DDR_DIAGNOSTICS__?.formRenders ?? 0,
      ),
    )
    .toBeGreaterThan(0);
}

function trackBrowserFailures(page: Page, failures: string[]) {
  page.on("crash", () => failures.push("renderer crashed"));
  page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    const text = message.text();
    const expectedOfflineDevSocketFailure =
      text.includes("/_next/webpack-hmr") &&
      text.includes("ERR_INTERNET_DISCONNECTED");
    if (message.type() === "error" && !expectedOfflineDevSocketFailure) {
      failures.push(`console: ${text}`);
    }
  });
}

test.beforeEach(async ({ context, page }, testInfo) => {
  await context.addInitScript(() => {
    window.__NAM_DDR_DIAGNOSTICS__ = {
      formRenders: 0,
      timelineRowRenders: 0,
      timelineCalculationCalls: 0,
    };
  });
  const failures: string[] = [];
  browserFailures.set(testInfo.testId, failures);
  trackBrowserFailures(page, failures);
});

test.afterEach(async ({}, testInfo) => {
  const failures = browserFailures.get(testInfo.testId) ?? [];
  browserFailures.delete(testInfo.testId);
  await testInfo.attach("browser-failures", {
    body: JSON.stringify(failures, null, 2),
    contentType: "application/json",
  });
  expect(failures).toEqual([]);
});

test("50-row create/edit interaction remains bounded", async ({ page }, testInfo) => {
  const session = `${testInfo.project.name}-${Date.now()}`;
  await page.goto(`/dragline-delay-reports/stress?session=${session}`);
  await waitForDdrHydration(page);
  await expect(page.locator(".ddr-timeline-row")).toHaveCount(50);
  if (testInfo.project.name.startsWith("chromium")) await page.requestGC();
  const initial = await page.evaluate(() => ({
    nodes: document.querySelectorAll("*").length,
    options: document.querySelectorAll(".ddr-timeline-row option").length,
    diagnostics: { ...window.__NAM_DDR_DIAGNOSTICS__! },
    heap: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
  }));

  for (let iteration = 0; iteration < 20; iteration += 1) {
    const row = (iteration % 50) + 1;
    await page
      .getByLabel(`Description for row ${row}`, { exact: true })
      .fill(`Edited event ${iteration}`);
    await page
      .getByLabel(`Duration for row ${row}`, { exact: true })
      .fill(String(5 + (iteration % 20)));
    await page
      .getByLabel(`Delay Code for row ${row}`, { exact: true })
      .selectOption(iteration % 2 ? "0" : "36");
    await page.getByLabel("Comments").fill(`Shift note ${iteration}`);
    await page.evaluate((top) => window.scrollTo(0, top ? 0 : document.body.scrollHeight), iteration % 2 === 0);
  }
  await expect(page.locator("[data-ddr-autosave-status='saved']")).toBeVisible();
  if (testInfo.project.name.startsWith("chromium")) await page.requestGC();

  const final = await page.evaluate(() => ({
    nodes: document.querySelectorAll("*").length,
    options: document.querySelectorAll(".ddr-timeline-row option").length,
    diagnostics: { ...window.__NAM_DDR_DIAGNOSTICS__! },
    heap: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
  }));
  await testInfo.attach("ddr-profile", {
    body: JSON.stringify({ initial, final }, null, 2),
    contentType: "application/json",
  });
  console.log("DDR_PROFILE", JSON.stringify({ initial, final }));
  expect(final.nodes).toBeLessThanOrEqual(initial.nodes + 2);
  expect(final.options).toBe(initial.options);
  expect(final.diagnostics.timelineRowRenders).toBeLessThanOrEqual(
    initial.diagnostics.timelineRowRenders + 250,
  );
  expect(final.diagnostics.timelineCalculationCalls).toBeLessThanOrEqual(
    // next dev enables React Strict Mode, so each of the 60 row-field updates
    // performs the memoized calculation twice. The first autosave identity
    // hydration adds one memoized calculation pair. Notes edits perform none.
    initial.diagnostics.timelineCalculationCalls + 122,
  );
});

test("server autosave survives reload and local fallback survives an abrupt offline close", async ({ context, page }, testInfo) => {
  const session = `recovery-${testInfo.project.name}-${Date.now()}`;
  const url = `/dragline-delay-reports/stress?session=${session}`;
  await page.goto(url);
  await waitForDdrHydration(page);
  const initialComments = page.getByLabel("Comments");
  await initialComments.click();
  await initialComments.pressSequentially("Saved before reload");
  await expect(
    page.locator("[data-ddr-autosave-status='saved']"),
  ).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await waitForDdrHydration(page);
  await expect(page.getByLabel("Comments")).toHaveValue("Saved before reload");

  await context.setOffline(true);
  const comments = page.getByLabel("Comments");
  await comments.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await comments.pressSequentially("Unsaved during offline close");
  await expect(page.getByLabel("Comments")).toHaveValue(
    "Unsaved during offline close",
  );
  await expect(page.locator("[data-ddr-autosave-status='offline']")).toBeVisible();
  await page.waitForTimeout(600);
  await page.close();
  await context.setOffline(false);
  page = await context.newPage();
  trackBrowserFailures(page, browserFailures.get(testInfo.testId) ?? []);
  await page.goto(url);
  await waitForDdrHydration(page);
  await expect(page.getByText("Recovered unsaved DDR changes from this device.")).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByLabel("Comments")).toHaveValue("Unsaved during offline close");
});

test("WebKit soak performs continuous editing without resource growth", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "webkit-1180x820", "One representative WebKit soak is sufficient.");
  const session = `soak-${Date.now()}`;
  await page.goto(`/dragline-delay-reports/stress?session=${session}`);
  await waitForDdrHydration(page);
  await expect(page.locator(".ddr-timeline-row")).toHaveCount(50);
  const comments = page.getByLabel("Comments");
  await comments.click();
  await comments.pressSequentially("WebKit soak warm-up");
  await expect(
    page.locator("[data-ddr-autosave-status='saved']"),
  ).toBeVisible({ timeout: 30_000 });
  const initialNodes = await page.locator("*").count();
  const started = Date.now();
  let iteration = 0;
  while (Date.now() - started < 120_000) {
    const row = (iteration % 50) + 1;
    await page
      .getByLabel(`Description for row ${row}`, { exact: true })
      .fill(`Soak ${iteration}`);
    await page.getByLabel(`Start time for row ${row}`, { exact: true }).fill(
      `${String(5 + Math.floor((iteration % 48) / 6)).padStart(2, "0")}:${String((iteration % 6) * 10).padStart(2, "0")}`,
    );
    await page.getByLabel("Safety Items Found").fill(`Safety observation ${iteration}`);
    await page.evaluate((down) => window.scrollTo(0, down ? document.body.scrollHeight : 0), iteration % 2 === 0);
    iteration += 1;
  }
  await expect(page.locator(".ddr-timeline-row")).toHaveCount(50);
  expect(await page.locator("*").count()).toBe(initialNodes);
  await testInfo.attach("webkit-soak", {
    body: JSON.stringify({
      iterations: iteration,
      nodes: initialNodes,
      diagnostics: await page.evaluate(() => window.__NAM_DDR_DIAGNOSTICS__),
    }, null, 2),
    contentType: "application/json",
  });
});
