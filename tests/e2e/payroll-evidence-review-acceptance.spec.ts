import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";

import { guardedPackage2BBrowserTestConfiguration } from "../helpers/package-2b-browser-guard";

const browserTestConfiguration = guardedPackage2BBrowserTestConfiguration();
const prisma = new PrismaClient({ datasourceUrl: browserTestConfiguration.databaseUrl });
const accessKey = "package2b-browser-access-key-000000000000";
const sessionSecret = "package2b-browser-session-secret-0000000000";

function signedOwnerSession() {
  const payload = Buffer.from(JSON.stringify({ employeeId: "browser-owner", expiresAt: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `${payload}.${createHmac("sha256", sessionSecret).update(payload).digest("base64url")}`;
}

async function unlock(page: Page, origin = browserTestConfiguration.authorizedOrigin) {
  await page.goto(`${origin}/payroll/access`);
  await page.getByLabel("Payroll access key").fill(accessKey);
  await page.getByRole("button", { name: "Unlock Payroll" }).click();
  await expect(page).toHaveURL(new RegExp(`${origin.replaceAll(".", "\\.")}/payroll`));
  await page.context().addCookies([{ name: "nam-payroll-session", value: signedOwnerSession(), url: origin, httpOnly: true, secure: false, sameSite: "Strict" }]);
}

async function authenticatedPage(context: BrowserContext) {
  const page = await context.newPage();
  await unlock(page);
  return page;
}

async function proposeTimesheet(page: Page, employeeId: string, reason: string) {
  await page.getByRole("combobox", { name: "Decision" }).selectOption("VERIFY_OWNER");
  await expect(page.getByLabel("Canonical Employee")).toHaveValue("");
  await page.getByLabel("Canonical Employee").selectOption(employeeId);
  await page.getByLabel("Reason").fill(reason);
  await page.getByRole("button", { name: "Review proposed change" }).click();
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe.serial("Package 2B isolated browser acceptance", () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test("unauthenticated and non-reviewer sessions cannot access review routes", async ({ browser }) => {
    const anonymous = await browser.newPage();
    await anonymous.goto("/payroll/evidence-review");
    await expect(anonymous).toHaveURL(/\/payroll\/access$/);
    await expect(anonymous.getByRole("heading", { name: "Financial records protected" })).toBeVisible();

    const deniedContext = await browser.newContext();
    const denied = await deniedContext.newPage();
    await unlock(denied, browserTestConfiguration.mismatchedReviewerOrigin);
    await denied.goto(`${browserTestConfiguration.mismatchedReviewerOrigin}/payroll/evidence-review/timesheets/browser-timesheet-review`);
    await expect(denied).toHaveURL(`${browserTestConfiguration.mismatchedReviewerOrigin}/payroll/access`);
    await expect(denied.getByText("Alex Duplicate")).toHaveCount(0);
    await deniedContext.close();
  });

  test("authorized dashboard exposes bounded synthetic queues and responsive controls", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    await page.goto("/payroll/evidence-review");
    await expect(page.getByRole("heading", { name: "Historical Evidence Review" })).toBeVisible();
    await expect(page.getByText("Timesheets requiring review").locator("..").getByText("2", { exact: true })).toBeVisible();
    await expect(page.getByText("Rates requiring review").locator("..").getByText("3", { exact: true })).toBeVisible();
    await expect(page.getByText("Unverified candidate").first()).toBeVisible();
    await expect(page.getByText("Browser Payroll Owner").first()).toBeVisible();

    await page.getByRole("link", { name: "Review" }).first().click();
    await expect(page.getByText("Unverified context")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Decision" })).toHaveValue("");
    await page.getByRole("combobox", { name: "Decision" }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Reason")).toBeFocused();

    for (const viewport of [{ width: 820, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/payroll/evidence-review/timesheets/browser-timesheet-review");
      await page.getByRole("combobox", { name: "Decision" }).selectOption("VERIFY_OWNER");
      await expectNoPageOverflow(page);
      await expect(page.getByRole("option", { name: /Browser Employee With An Intentionally Long Synthetic Name/ })).toBeAttached();
    }

    for (const viewport of [{ width: 1280, height: 900 }, { width: 820, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/payroll/evidence-review");
      await expectNoPageOverflow(page);
      await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
    }
    await context.close();
  });

  test("timesheet review confirms explicitly, prevents duplicate UI submission, and refreshes Payroll", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    await page.goto("/payroll/evidence-review/timesheets/browser-timesheet-review");
    await proposeTimesheet(page, "browser-owner", "Verified from synthetic signed timesheet evidence.");
    await expect(page.getByRole("heading", { name: "Confirm this change" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Confirm identity decision" })).toBeFocused();
    const save = page.getByRole("button", { name: "Confirm and save" });
    await save.dblclick({ delay: 10 });
    await expect(page.getByRole("status")).toContainText("Review decision saved with immutable history");
    await expect(page.getByText("OWNER VERIFIED").last()).toBeVisible();
    expect(await prisma.timesheetIdentityReviewEvent.count({ where: { weeklyTimesheetId: "browser-timesheet-review" } })).toBe(1);

    await page.goto("/payroll?month=2026-10");
    await expect(page.getByRole("link", { name: "Evidence Review" })).toBeVisible();
    const reviewedDay = page.getByRole("button", { name: "Wednesday, September 30, 2026: Needs Review" });
    await expect(reviewedDay.getByText("8h recorded")).toBeVisible();
    await context.close();
  });

  test("independent pay-rate verification requires evidence reference and enables expected gross", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    await page.goto("/payroll?month=2026-10");
    const unavailableGross = page.getByText(/Estimated pending gross · 1 entry needs verified rate evidence/).locator("..");
    await expect(unavailableGross.getByText("Unavailable", { exact: true })).toBeVisible();
    await page.goto("/payroll/evidence-review/rates/browser-rate-simple");
    await expect(page.getByText("Unverified context").locator("..")).toContainText("browser-paycheck");
    await page.getByRole("combobox", { name: "Decision" }).selectOption("VERIFY_INDEPENDENT");
    await page.getByLabel("Reason").fill("Verified against synthetic wage notice.");
    await expect(page.getByRole("button", { name: "Review proposed change" })).toBeDisabled();
    await page.getByLabel(/Evidence reference/).fill("WAGE-NOTICE-2026-09-28");
    await page.getByRole("button", { name: "Review proposed change" }).click();
    await expect(page.getByRole("group", { name: "Confirm rate decision" })).toBeFocused();
    await page.getByRole("button", { name: "Confirm and save" }).click();
    await expect(page.getByRole("status")).toContainText("Authoritative state: VERIFIED");
    expect(await prisma.payRateEvidenceReviewEvent.count({ where: { employeePayRateId: "browser-rate-simple" } })).toBe(1);

    await page.goto("/payroll?month=2026-10");
    const availableGross = page.getByText("Estimated pending gross", { exact: true }).locator("..");
    await expect(availableGross.getByText("$232.00", { exact: true })).toBeVisible();
    await expect(page.getByText("Unavailable", { exact: true })).toHaveCount(0);
    await context.close();
  });

  test("competitor resolution is explicit and stale reviews return focused actionable feedback", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    await page.goto("/payroll/evidence-review/rates/browser-rate-primary");
    for (const viewport of [{ width: 820, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expectNoPageOverflow(page);
      await expect(page.getByText("Competing same-date evidence")).toBeVisible();
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("combobox", { name: "Decision" }).selectOption("VERIFY_INDEPENDENT");
    await page.getByLabel("Reason").fill("Resolve synthetic same-date evidence.");
    await page.getByLabel(/Evidence reference/).fill("WAGE-NOTICE-2026-10-05");
    await expect(page.getByText("Verification may conflict")).toBeVisible();
    await page.getByLabel("Resolve every active competitor atomically").check();
    await page.getByRole("group", { name: "Competing evidence" }).getByRole("combobox").selectOption("EXCLUDED");
    await page.getByRole("button", { name: "Review proposed change" }).click();
    await expect(page.getByText("browser-rate-competitor: EXCLUDED")).toBeVisible();
    await page.getByRole("button", { name: "Confirm and save" }).click();
    await expect(page.getByRole("status")).toContainText("Authoritative state: VERIFIED");
    expect(await prisma.payRateEvidenceReviewEvent.count({ where: { employeePayRateId: { in: ["browser-rate-primary", "browser-rate-competitor"] } } })).toBe(2);

    const first = await context.newPage();
    const second = await context.newPage();
    await Promise.all([
      first.goto("/payroll/evidence-review/timesheets/browser-timesheet-stale"),
      second.goto("/payroll/evidence-review/timesheets/browser-timesheet-stale"),
    ]);
    await proposeTimesheet(first, "browser-candidate-a", "First synthetic reviewer decision.");
    await first.getByRole("button", { name: "Confirm and save" }).click();
    await expect(first.getByRole("status")).toBeVisible();
    await second.getByRole("combobox", { name: "Decision" }).selectOption("REVIEW_UNASSIGNED");
    await second.getByLabel("Reason").fill("Stale synthetic competing decision.");
    await second.getByRole("button", { name: "Review proposed change" }).click();
    await second.getByRole("button", { name: "Confirm and save" }).click();
    const staleAlert = second.locator(".payroll-notice--error");
    await expect(staleAlert).toContainText("This evidence changed. Refresh");
    await expect(staleAlert).toBeFocused();
    expect(await prisma.timesheetIdentityReviewEvent.count({ where: { weeklyTimesheetId: "browser-timesheet-stale" } })).toBe(1);
    await context.close();
  });

  test("history distinguishes automatic correction from an owner decision", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authenticatedPage(context);
    await page.goto("/payroll/evidence-review/rates/browser-rate-system");
    await expect(page.getByText("Automatic Paycheck correction")).toBeVisible();
    await expect(page.getByText("Owner review decision")).toHaveCount(0);
    await page.getByRole("combobox", { name: "Decision" }).selectOption("REOPEN_REVIEW");
    await page.getByLabel("Reason").fill("Reopened synthetic correction evidence for review.");
    await page.getByRole("button", { name: "Review proposed change" }).click();
    await page.getByRole("button", { name: "Confirm and save" }).click();
    await expect(page.getByRole("status")).toContainText("Authoritative state: NEEDS_REVIEW");
    await expect(page.getByText("Automatic Paycheck correction")).toBeVisible();
    await expect(page.getByText("Owner review decision")).toBeVisible();
    await context.close();
  });
});
