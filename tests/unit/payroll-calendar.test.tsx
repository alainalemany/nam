import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PayrollCalendar } from "@/features/payroll/PayrollCalendar";
import type { PayrollCalendarDay } from "@/features/payroll/types";

afterEach(cleanup);

const days: PayrollCalendarDay[] = [
  { date: "2026-10-05", dayNumber: 5, inMonth: true, status: "RECONCILED", statusLabel: "Aggregate match", timesheetMinutes: 720, paidEvidenceLabel: "60h aggregate paid", evidenceLevel: "aggregate", detail: "Aggregate match; no individual allocation." },
  { date: "2026-10-06", dayNumber: 6, inMonth: true, status: "MISSING_TIMESHEET", statusLabel: "Missing Timesheet", scheduledLabel: "Day shift", detail: "Review required.", actionHref: "/timesheets/one", actionLabel: "Open Timesheet" },
  { date: "2026-10-07", dayNumber: 7, inMonth: true, status: "AWAITING_PAYROLL", statusLabel: "Awaiting Payroll", timesheetMinutes: 720, estimatedGrossStatus: "UNAVAILABLE", estimatedGrossReason: "RATE_EVIDENCE_CONFLICT", detail: "Awaiting confirmation." },
];

describe("PayrollCalendar", () => {
  it("renders distinct accessible statuses and opens day detail", () => {
    render(<PayrollCalendar days={days} monthLabel="October 2026" previousHref="/payroll?month=2026-09" nextHref="/payroll?month=2026-11" />);
    expect(screen.getByRole("button", { name: /October 5, 2026: Aggregate match/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /October 6, 2026: Missing Timesheet/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /October 5, 2026/ }).querySelector(".payroll-day-status-mark"))
      .toHaveTextContent("✓");
    expect(screen.getByRole("button", { name: /October 6, 2026/ }).querySelector(".payroll-day-status-mark"))
      .toHaveTextContent("!");
    fireEvent.click(screen.getByRole("button", { name: /October 5, 2026/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("not this date's individual paid allocation");
  });

  it("labels a conflicted daily estimate as unavailable", () => {
    render(<PayrollCalendar days={days} monthLabel="October 2026" previousHref="/payroll?month=2026-09" nextHref="/payroll?month=2026-11" />);
    fireEvent.click(screen.getByRole("button", { name: /October 7, 2026/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Unavailable — rate evidence conflicts");
  });
});
