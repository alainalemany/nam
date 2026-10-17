import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";

import { resetPackage2BBrowserRateHistoryFixture } from "../helpers/package-2b-browser-fixture";
import { guardedPackage2BBrowserTestConfiguration } from "../helpers/package-2b-browser-guard";

const configuration = guardedPackage2BBrowserTestConfiguration();
const prisma = new PrismaClient({ datasourceUrl: configuration.databaseUrl });

function signedOwnerSession() {
  const payload = Buffer.from(JSON.stringify({
    employeeId: configuration.ownerEmployeeId,
    expiresAt: Math.floor(Date.now() / 1_000) + 3_600,
  })).toString("base64url");
  return `${payload}.${createHmac("sha256", configuration.sessionSecret).update(payload).digest("base64url")}`;
}

async function unlock(page: Page, origin = configuration.authorizedOrigin) {
  await page.goto(`${origin}/payroll/access`);
  await page.getByLabel("Payroll access key").fill(configuration.accessKey);
  await page.getByRole("button", { name: "Unlock Payroll" }).click();
  await expect(page).toHaveURL(new RegExp(`${origin.replaceAll(".", "\\.")}/payroll`));
  await page.context().addCookies([{
    name: "nam-payroll-session",
    value: signedOwnerSession(),
    url: origin,
    httpOnly: true,
    secure: false,
    sameSite: "Strict",
  }]);
}

async function authenticatedPage(context: BrowserContext) {
  const page = await context.newPage();
  await unlock(page);
  return page;
}

async function chooseRejection(page: Page, reason: string) {
  await page.getByLabel("Reject proposed boundary").check();
  await page.getByLabel("Reason").fill(reason);
  await page.getByRole("button", { name: "Review proposed decision" }).click();
  await expect(page.getByRole("group", { name: "Confirm rate boundary decision" })).toBeFocused();
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe.serial("Phase 5B.3 isolated progressive rate-history acceptance", () => {
  test.beforeEach(async () => {
    await resetPackage2BBrowserRateHistoryFixture(prisma);
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("rate-history routes deny anonymous and ordinary Payroll sessions", async ({ browser }) => {
    const anonymous = await browser.newPage();
    await anonymous.goto("/payroll/rate-history");
    await expect(anonymous).toHaveURL(/\/payroll\/access$/);
    await expect(anonymous.getByRole("heading", { name: "Financial records protected" })).toBeVisible();

    const deniedContext = await browser.newContext();
    const denied = await deniedContext.newPage();
    await unlock(denied, configuration.mismatchedReviewerOrigin);
    await denied.goto(`${configuration.mismatchedReviewerOrigin}/payroll/rate-history`);
    await expect(denied).toHaveURL(`${configuration.mismatchedReviewerOrigin}/payroll/access`);
    await expect(denied.getByText("Browser Payroll Owner With An Intentionally Long Synthetic Identifier")).toHaveCount(0);
    await deniedContext.close();
  });

  test("an authorized reviewer sees verified history, provenance, support, and open classifications", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    await page.goto("/payroll/rate-history");

    await expect(page.getByRole("heading", { name: "Progressive Rate History" })).toBeVisible();
    await expect(page.getByText("Browser Payroll Owner With An Intentionally Long Synthetic Identifier")).toBeVisible();
    await expect(page.getByText("$32.0000/hr").first()).toBeVisible();
    await expect(page.getByText(/Current verified base rate · effective Jul 1, 2026/)).toBeVisible();
    await expect(page.getByText("Confirmed Paycheck").first()).toBeVisible();
    const verifiedRateRow = page.getByRole("row").filter({ hasText: "Jul 1, 2026" }).filter({ hasText: "$32.0000/hr" }).first();
    await expect(verifiedRateRow.getByRole("cell").nth(4)).toHaveText("2");
    await expect(page.getByText("2026-07-01–2026-07-14, 2026-07-15–2026-07-28").first()).toBeVisible();
    await expect(page.getByText("Proposed increase").first()).toBeVisible();
    await expect(page.getByText("Proposed decrease").first()).toBeVisible();
    await expect(page.getByText("Conflicting evidence").first()).toBeVisible();
    await expect(page.getByText("Repeated supporting observation")).toHaveCount(0);
    await expect(page.getByText("Expected gross is protected by unresolved rate evidence.")).toBeVisible();
    await context.close();
  });

  test("the overview refuses to infer a current rate when no verified boundary exists", async ({ browser }) => {
    await resetPackage2BBrowserRateHistoryFixture(prisma, { includeVerifiedRate: false });
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    await page.goto("/payroll/rate-history");

    await expect(page.getByText("Not established", { exact: true })).toBeVisible();
    await expect(page.getByText("Current verified base rate · no trusted boundary")).toBeVisible();
    await expect(page.getByText("No trusted rate history")).toBeVisible();
    await expect(page.getByText("$35.0000/hr").first()).toBeVisible();
    await context.close();
  });

  test("candidate details distinguish authenticated evidence, conflicts, missing evidence, and system attribution", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    await page.goto("/payroll/rate-history/candidates/browser-candidate-increase");

    await expect(page.getByRole("heading", { name: "Proposed increase" })).toBeVisible();
    await expect(page.getByText("Document-proven row dates").first()).toBeVisible();
    await expect(page.getByText("Authenticated pay-period bounds").first()).toBeVisible();
    await expect(page.getByText("Aug 1, 2026–Aug 14, 2026").first()).toBeVisible();
    await expect(page.getByText("2 of 2 active")).toBeVisible();
    await expect(page.getByText(/8h 00m regular · 0h 00m overtime · expected gross unavailable/).first()).toBeVisible();
    await expect(page.getByText("System classification")).toBeVisible();
    await expect(page.getByText("Owner review decision")).toHaveCount(0);
    await page.getByLabel("Confirm exact effective date").check();
    await expect(page.getByLabel("Exact effective date")).toHaveValue("");

    await page.goto("/payroll/rate-history/candidates/browser-candidate-decrease");
    await expect(page.getByRole("heading", { name: "Conflicting evidence" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overlapping open conflicts" })).toBeVisible();
    await expect(page.getByText("$34.0000/hr").first()).toBeVisible();
    await expect(page.getByText("Expected gross remains unavailable for affected work dates.")).toBeVisible();

    await page.goto("/payroll/rate-history/candidates/browser-candidate-missing-evidence");
    await expect(page.getByText("Candidate evidence is missing")).toBeVisible();
    await expect(page.getByText("Promotion unavailable")).toBeVisible();
    await expect(page.getByLabel("Confirm exact effective date")).toBeDisabled();
    await context.close();
  });

  test("exact-date review has no default and rejects impossible or out-of-window dates", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    await page.goto("/payroll/rate-history/candidates/browser-candidate-increase");
    await page.getByLabel("Confirm exact effective date").check();
    const exactDate = page.getByLabel("Exact effective date");
    await expect(exactDate).toHaveValue("");

    await exactDate.evaluate((input: HTMLInputElement) => {
      input.value = "2026-02-30";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(exactDate).toHaveValue("");
    await expect(page.getByRole("button", { name: "Review proposed decision" })).toBeDisabled();

    await exactDate.fill("2026-07-31");
    await expect(page.getByRole("alert")).toContainText("Select a date inside the evidence window");
    await expect(page.getByRole("button", { name: "Review proposed decision" })).toBeDisabled();
    await context.close();
  });

  test("promotion confirms deliberately, resists duplicate submission, and refreshes authoritative state", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    await page.goto("/payroll/rate-history/candidates/browser-candidate-increase");
    await page.getByLabel("Confirm exact effective date").check();
    await page.getByLabel("Exact effective date").fill("2026-08-05");
    await page.getByLabel("Reason").fill("Synthetic wage notice confirms the exact boundary.");
    await page.getByLabel(/Evidence reference/).fill("SYNTHETIC-WAGE-NOTICE-2026-08-05");
    await page.getByRole("button", { name: "Review proposed decision" }).click();
    const confirmation = page.getByRole("group", { name: "Confirm rate boundary decision" });
    await expect(confirmation).toBeFocused();
    await expect(confirmation).toContainText("$32.0000/hr");
    await expect(confirmation).toContainText("$35.0000/hr");
    await expect(confirmation).toContainText("2026-08-05");
    const actionRequestPromise = page.waitForRequest((request) =>
      request.method() === "POST" && new URL(request.url()).pathname.endsWith("/payroll/rate-history/candidates/browser-candidate-increase"));
    await page.getByRole("button", { name: "Confirm exact boundary" }).dblclick({ delay: 10 });
    const actionRequest = await actionRequestPromise;

    const saved = page.locator(".rate-decision-success").getByRole("status");
    await expect(saved).toContainText("Decision saved with immutable history");
    await expect(saved).toContainText("Authoritative candidate state: RESOLVED");
    const replayHeaders = Object.fromEntries(
      Object.entries(actionRequest.headers()).filter(([name]) => name !== "content-length"),
    );
    const replay = await context.request.fetch(actionRequest.url(), {
      method: "POST",
      headers: replayHeaders,
      data: actionRequest.postDataBuffer() ?? Buffer.alloc(0),
    });
    expect(replay.ok()).toBe(true);
    expect(await replay.text()).toContain("idempotencyReplay");
    expect(await prisma.payRateBoundaryDecisionEvent.count({ where: { candidateId: "browser-candidate-increase" } })).toBe(1);
    expect(await prisma.employeePayRate.count({ where: { employeeId: "browser-owner", effectiveFrom: new Date("2026-08-05T00:00:00.000Z"), verificationStatus: "VERIFIED" } })).toBe(1);

    await page.getByRole("link", { name: "Return to refreshed rate history" }).click();
    await expect(page.getByText("$35.0000/hr").first()).toBeVisible();
    await expect(page.getByText("Expected gross is protected by unresolved rate evidence.")).toBeVisible();
    expect(await prisma.payRateBoundaryCandidate.count({ where: { status: "OPEN" } })).toBe(3);
    await context.close();
  });

  test("rejection requires a reason, retains evidence, and leaves unrelated uncertainty open", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    await page.goto("/payroll/rate-history/candidates/browser-candidate-increase");
    await page.getByLabel("Reject proposed boundary").check();
    await expect(page.getByRole("button", { name: "Review proposed decision" })).toBeDisabled();
    await page.getByLabel("Reason").fill("Synthetic source confirms this proposed boundary is not authoritative.");
    await page.getByRole("button", { name: "Review proposed decision" }).click();
    await expect(page.getByRole("group", { name: "Confirm rate boundary decision" })).toBeFocused();
    await page.getByRole("button", { name: "Confirm rejection" }).click();

    await expect(page.locator(".rate-decision-success").getByRole("status")).toContainText("Authoritative candidate state: REJECTED");
    expect(await prisma.payRateObservation.count({ where: { id: { in: ["browser-observation-increase-1", "browser-observation-increase-2"] } } })).toBe(2);
    expect(await prisma.payRateBoundaryCandidate.count({ where: { status: "OPEN" } })).toBe(3);
    await page.getByRole("link", { name: "Return to refreshed rate history" }).click();
    await expect(page.getByText("Expected gross is protected by unresolved rate evidence.")).toBeVisible();
    await context.close();
  });

  test("stale reviews receive focused feedback and immutable history keeps reviewer snapshots distinct", async ({ browser }) => {
    const context = await browser.newContext();
    const first = await authenticatedPage(context);
    const second = await context.newPage();
    await Promise.all([
      first.goto("/payroll/rate-history/candidates/browser-candidate-increase"),
      second.goto("/payroll/rate-history/candidates/browser-candidate-increase"),
    ]);
    await chooseRejection(first, "First synthetic reviewer decision wins.");
    await chooseRejection(second, "Second synthetic reviewer decision is stale.");
    await first.getByRole("button", { name: "Confirm rejection" }).click();
    await expect(first.locator(".rate-decision-success").getByRole("status")).toContainText("Authoritative candidate state: REJECTED");
    await second.getByRole("button", { name: "Confirm rejection" }).click();
    const stale = second.getByRole("alert");
    await expect(stale).toContainText("This candidate changed. Refresh");
    await expect(stale).toBeFocused();

    await first.goto("/payroll/rate-history/candidates/browser-candidate-increase");
    await expect(first.getByText("System classification")).toBeVisible();
    await expect(first.getByText("Owner review decision")).toBeVisible();
    await expect(first.getByText(/Reviewer: Browser Payroll Owner With An Intentionally Long Synthetic Identifier/)).toBeVisible();
    expect(await prisma.payRateBoundaryDecisionEvent.count({ where: { candidateId: "browser-candidate-increase" } })).toBe(1);
    await context.close();
  });

  test("overview and decision surfaces remain usable at approved viewports and by keyboard", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 820, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/payroll/rate-history");
      await expect(page.getByRole("heading", { name: "Progressive Rate History" })).toBeVisible();
      await expect(page.getByText("Browser Payroll Owner With An Intentionally Long Synthetic Identifier")).toBeVisible();
      await expectNoPageOverflow(page);

      await page.goto("/payroll/rate-history/candidates/browser-candidate-increase");
      await expect(page.getByText("Structured source evidence")).toBeVisible();
      await expect(page.getByLabel("Reject proposed boundary")).toBeVisible();
      await expectNoPageOverflow(page);
    }

    await page.getByLabel("Confirm exact effective date").focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Exact effective date")).toBeFocused();
    await context.close();
  });
});
