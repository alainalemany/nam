import { describe, expect, it } from "vitest";

import {
  derivePayrollDayState,
  estimatedGrossCents,
  payrollPeriodForDate,
  projectedCheckDateForNamPeriod,
  reconcilePayrollEvidence,
} from "@/features/payroll/calculations";
import { calculateWorkedMinutes, dateInputValue } from "@/features/timesheets/calculations";

describe("payroll reconciliation calculations", () => {
  it("projects a Monday-Sunday NAM period to the following Wednesday", () => {
    const result = payrollPeriodForDate(new Date("2026-09-16T00:00:00.000Z"));
    expect(dateInputValue(result.periodStart)).toBe("2026-09-14");
    expect(dateInputValue(result.periodEnd)).toBe("2026-09-20");
    expect(dateInputValue(result.expectedCheckDate)).toBe("2026-09-23");
    expect(dateInputValue(projectedCheckDateForNamPeriod(result.periodStart, result.periodEnd)!)).toBe("2026-09-23");
  });

  it("does not project a check date for arbitrary Workday boundaries", () => {
    expect(projectedCheckDateForNamPeriod(
      new Date("2026-09-16T00:00:00.000Z"),
      new Date("2026-09-22T00:00:00.000Z"),
    )).toBeUndefined();
  });

  it("requires total, regular, and overtime aggregate categories to match", () => {
    const full = reconcilePayrollEvidence({
      hasPaycheck: true,
      recorded: { totalMinutes: 3600, regularMinutes: 2400, overtimeMinutes: 1200 },
      paid: { totalMinutes: 3600, regularMinutes: 2400, overtimeMinutes: 1200 },
    });
    expect(full).toMatchObject({ status: "RECONCILED", reason: "FULL_AGGREGATE_MATCH" });

    const classification = reconcilePayrollEvidence({
      hasPaycheck: true,
      recorded: { totalMinutes: 3600, regularMinutes: 2400, overtimeMinutes: 1200 },
      paid: { totalMinutes: 3600, regularMinutes: 2160, overtimeMinutes: 1440 },
    });
    expect(classification).toMatchObject({
      status: "DISCREPANCY",
      reason: "REGULAR_OVERTIME_CLASSIFICATION_MISMATCH",
      differences: { totalMinutes: 0, regularMinutes: 240, overtimeMinutes: -240 },
    });

    const total = reconcilePayrollEvidence({
      hasPaycheck: true,
      recorded: { totalMinutes: 3600, regularMinutes: 2400, overtimeMinutes: 1200 },
      paid: { totalMinutes: 2880, regularMinutes: 2400, overtimeMinutes: 480 },
    });
    expect(total).toMatchObject({
      status: "DISCREPANCY",
      reason: "TOTAL_HOURS_MISMATCH",
      differences: { totalMinutes: 720 },
    });
  });

  it.each([
    "DRAFT_TIMESHEET_EVIDENCE",
    "MISSING_TIMESHEET_EVIDENCE",
    "UNCONFIRMED_PAYCHECK_EVIDENCE",
    "UNRESOLVED_EMPLOYEE_IDENTITY",
    "AMBIGUOUS_TIMESHEET_EVIDENCE",
    "OVERLAPPING_PAYROLL_EVIDENCE",
  ] as const)("keeps incomplete evidence in review for %s", (reason) => {
    expect(reconcilePayrollEvidence({
      hasPaycheck: true,
      recorded: { totalMinutes: 3600, regularMinutes: 2400, overtimeMinutes: 1200 },
      paid: { totalMinutes: 3600, regularMinutes: 2400, overtimeMinutes: 1200 },
      evidenceIssues: [reason],
    })).toMatchObject({ status: "NEEDS_REVIEW", reason });
  });

  it("calls completed hours awaiting payroll without claiming overdue pay", () => {
    const result = reconcilePayrollEvidence({
      hasPaycheck: false,
      recorded: { totalMinutes: 2520, regularMinutes: 2400, overtimeMinutes: 120 },
    });
    expect(result.status).toBe("AWAITING_PAYROLL");
    expect(result.explanation).toContain("waiting for paycheck confirmation");
  });

  it("flags a missing entry only when Timesheet history exists and the shift ended", () => {
    expect(derivePayrollDayState({ hasEntry: false, hasTimesheet: true, timesheetStatus: "COMPLETED", scheduled: true, shiftEnded: true, hasPaycheck: false, aggregateStatus: "AWAITING_PAYROLL", aggregateExplanation: "" }).status).toBe("MISSING_TIMESHEET");
    const historical = derivePayrollDayState({ hasEntry: false, hasTimesheet: false, scheduled: true, shiftEnded: true, hasPaycheck: true, aggregateStatus: "NEEDS_REVIEW", aggregateExplanation: "" });
    expect(historical.status).toBe("NEEDS_REVIEW");
    expect(historical.detail).toContain("not proof");
  });

  it("preserves overnight minutes and does not invent day-level payroll allocation", () => {
    expect(calculateWorkedMinutes("17:00", "05:00", 0)).toBe(720);
    const state = derivePayrollDayState({ hasEntry: true, hasTimesheet: true, timesheetStatus: "COMPLETED", scheduled: true, shiftEnded: true, hasPaycheck: true, aggregateStatus: "RECONCILED", aggregateExplanation: "" });
    expect(state.detail).toContain("does not prove");
  });

  it("uses exact decimal arithmetic for regular and time-and-a-half estimates", () => {
    expect(estimatedGrossCents(2400, 1200, "33.15")).toBe(232050);
  });
});
