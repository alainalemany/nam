import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { PayrollCalendar } from "@/features/payroll/PayrollCalendar";
import type { PayrollCalendarDay } from "@/features/payroll/types";

afterEach(cleanup);

const days: PayrollCalendarDay[] = [
  {
    date: "2026-10-05",
    dayNumber: 5,
    inMonth: true,
    status: "SHIFT_CANCELED",
    statusLabel: "Shift canceled",
    scheduledLabel: "Cancelled",
    noWorkReason: "SHIFT_CANCELED",
    noWorkLabel: "Shift canceled · 0 worked",
    detail: "Shift canceled with zero actual worked hours.",
  },
  {
    date: "2026-10-06",
    dayNumber: 6,
    inMonth: true,
    status: "RECONCILED",
    statusLabel: "Aggregate match",
    timesheetMinutes: 720,
    detail: "Pay-period totals agree.",
  },
];

describe("Payroll calendar interaction", () => {
  it("keeps status and selected state distinct while the drawer opens and closes", async () => {
    render(<PayrollCalendar days={days} monthLabel="October 2026" previousHref="?month=2026-09" nextHref="?month=2026-11" />);

    const canceledDay = screen.getByRole("button", { name: /October 5, 2026: Shift canceled/ });
    fireEvent.click(canceledDay);

    expect(canceledDay).toHaveAttribute("aria-pressed", "true");
    expect(canceledDay).toHaveClass("payroll-status--shift-canceled", "payroll-day--selected");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close day detail" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog")).toHaveAttribute("data-closing", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.animationEnd(document.querySelector(".payroll-day-drawer")!, { animationName: "payroll-drawer-out" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(canceledDay).toHaveFocus();
    expect(canceledDay).toHaveAttribute("aria-pressed", "false");
  });

  it("defines full-cell semantic backgrounds and reduced-motion handling", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("background: var(--status-bg, #fff)");
    expect(css).toContain(".payroll-status--reconciled");
    expect(css).toContain(".payroll-status--missing-timesheet");
    expect(css).toContain(".payroll-status--shift-canceled");
    expect(css).toContain(".payroll-status--covered-by-coworker");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("payroll-drawer-out");
  });
});
