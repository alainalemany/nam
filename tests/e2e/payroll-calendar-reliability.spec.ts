import { expect, test } from "@playwright/test";

test.describe("Payroll calendar reliability preview", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/payroll/preview");
    await expect(page.getByText("Preview data only")).toBeVisible();
  });

  test("uses semantic cell backgrounds and a distinct selected state", async ({ page }, testInfo) => {
    const canceled = page.getByRole("button", { name: /Monday, October 5, 2026: Shift canceled/ });
    const covered = page.getByRole("button", { name: /Friday, October 9, 2026: Covered by coworker/ });
    const aggregate = page.getByRole("button", { name: /Aggregate match/ }).first();
    const precedingMonday = page.getByRole("button", { name: /Monday, September 28, 2026: Aggregate match/ });
    const precedingTuesday = page.getByRole("button", { name: /Tuesday, September 29, 2026: Aggregate match/ });
    const followingSunday = page.getByRole("button", { name: /Sunday, November 1, 2026: Aggregate match/ });
    const scheduledOff = page.getByRole("button", { name: /Friday, October 2, 2026: Scheduled off/ });

    await expect(canceled).toBeVisible();
    await expect(covered).toBeVisible();
    await expect(aggregate).toBeVisible();
    await expect(precedingMonday).toHaveCSS("background-color", "rgb(237, 249, 241)");
    await expect(precedingTuesday).toHaveCSS("background-color", "rgb(237, 249, 241)");
    await expect(followingSunday).toHaveCSS("background-color", "rgb(237, 249, 241)");
    await expect(scheduledOff).toHaveCSS("background-color", "rgb(247, 248, 250)");
    await expect(canceled).toHaveCSS("background-color", "rgb(248, 243, 232)");
    await expect(covered).toHaveCSS("background-color", "rgb(238, 243, 248)");
    await expect(aggregate).toHaveCSS("background-color", "rgb(237, 249, 241)");
    const latestPaycheck = page.getByRole("heading", { name: "Latest Paycheck" }).locator("..").locator("..");
    await expect(latestPaycheck.getByText("$33.15/hr")).toBeVisible();
    await expect(page.getByText("$33.1500/hr")).toHaveCount(0);

    await canceled.click();
    await expect(canceled).toHaveAttribute("aria-pressed", "true");
    await expect(canceled).toHaveClass(/payroll-day--selected/);
    await expect(canceled).toHaveClass(/payroll-status--shift-canceled/);
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Shift canceled · 0 worked")).toBeVisible();
    await expect(drawer.locator(".payroll-day-drawer")).toHaveCSS("animation-name", "payroll-drawer-in");

    await page.screenshot({ path: testInfo.outputPath("payroll-calendar-selected.png"), fullPage: true });
    await drawer.getByRole("button", { name: "Close day detail" }).click();
    await expect(drawer).toHaveAttribute("data-closing", "true");
    await expect(drawer).toBeHidden();
    await expect(canceled).toBeFocused();
    await expect(canceled).toHaveAttribute("aria-pressed", "false");

    await precedingMonday.click();
    await expect(precedingMonday).toHaveClass(/payroll-day--selected/);
    await expect(precedingMonday).toHaveClass(/payroll-status--reconciled/);
    await expect(precedingMonday).toHaveCSS("background-color", "rgb(237, 249, 241)");
  });

  test("honors reduced motion and remains usable at the configured viewport", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const covered = page.getByRole("button", { name: /Friday, October 9, 2026: Covered by coworker/ });
    await covered.click();

    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Covered by coworker · 0 worked")).toBeVisible();
    await expect(drawer.locator(".payroll-day-drawer")).toHaveCSS("animation-duration", "0.001s");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(1);
  });
});
