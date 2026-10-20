import { describe, expect, it } from "vitest";

import {
  derivePayrollDayState,
  estimatedGrossCents,
  nextExpectedDirectDepositDate,
  payrollPeriodForDate,
  projectedCheckDateForNamPeriod,
  reconcilePayrollEvidence,
} from "@/features/payroll/calculations";
import { calculateWorkedMinutes, dateInputValue } from "@/features/timesheets/calculations";

describe("payroll reconciliation calculations", () => {
  it("predicts Wednesday, October 21 for Monday, October 19 in the Payroll timezone", () => {
    expect(nextExpectedDirectDepositDate(new Date("2026-10-19T16:00:00.000Z")))
      .toBe("2026-10-21");
  });

  it.each([
    ["Monday", "2026-10-19T16:00:00.000Z", "2026-10-21"],
    ["Tuesday", "2026-10-20T16:00:00.000Z", "2026-10-21"],
    ["Wednesday", "2026-10-21T16:00:00.000Z", "2026-10-21"],
    ["Thursday", "2026-10-22T16:00:00.000Z", "2026-10-28"],
    ["Friday", "2026-10-23T16:00:00.000Z", "2026-10-28"],
    ["Saturday", "2026-10-24T16:00:00.000Z", "2026-10-28"],
    ["Sunday", "2026-10-25T16:00:00.000Z", "2026-10-28"],
  ])("uses the current or next Wednesday on %s", (_day, now, expected) => {
    expect(nextExpectedDirectDepositDate(new Date(now))).toBe(expected);
  });

  it.each([
    ["month boundary", "2026-10-29T16:00:00.000Z", "2026-11-04"],
    ["year boundary", "2026-12-31T17:00:00.000Z", "2027-01-06"],
    ["spring DST boundary", "2026-03-05T17:00:00.000Z", "2026-03-11"],
    ["fall DST boundary", "2026-10-29T16:00:00.000Z", "2026-11-04"],
  ])("keeps local calendar dates stable across a %s", (_boundary, now, expected) => {
    expect(nextExpectedDirectDepositDate(new Date(now))).toBe(expected);
  });

  it("uses the New York calendar date when UTC has already advanced to Thursday", () => {
    expect(nextExpectedDirectDepositDate(new Date("2026-11-05T04:30:00.000Z")))
      .toBe("2026-11-04");
  });

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
    "UNVERIFIED_FTO_EVIDENCE",
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

  it("presents FTO as separate unresolved evidence instead of worked time or a missing entry", () => {
    const result = derivePayrollDayState({
      hasEntry: false,
      hasTimesheet: true,
      timesheetStatus: "COMPLETED",
      scheduled: true,
      shiftEnded: true,
      hasPaycheck: true,
      aggregateStatus: "NEEDS_REVIEW",
      aggregateExplanation: "",
      hasFtoRequest: true,
      ftoApprovalStatus: "Requested",
      ftoPaymentStatus: "Unverified",
    });
    expect(result.status).toBe("FTO_REQUESTED");
    expect(result.detail).toContain("separately from worked time");
    expect(result.detail).toContain("Payment: Unverified");
  });

  it("does not let an FTO state hide a confirmed aggregate discrepancy", () => {
    const result = derivePayrollDayState({
      hasEntry: false,
      hasTimesheet: true,
      timesheetStatus: "COMPLETED",
      scheduled: true,
      shiftEnded: true,
      hasPaycheck: true,
      aggregateStatus: "DISCREPANCY",
      aggregateExplanation: "Paid totals differ from recorded totals.",
      hasFtoRequest: true,
      ftoApprovalStatus: "APPROVED",
      ftoPaymentStatus: "UNVERIFIED",
    });
    expect(result.status).toBe("DISCREPANCY");
    expect(result.detail).toContain("FTO remains separate evidence");
  });

  it("accounts for an explained canceled or covered shift with zero worked minutes", () => {
    expect(derivePayrollDayState({ hasEntry: false, hasTimesheet: true, timesheetStatus: "COMPLETED", scheduled: true, shiftEnded: true, hasPaycheck: true, aggregateStatus: "RECONCILED", aggregateExplanation: "", noWorkReason: "SHIFT_CANCELED" })).toMatchObject({ status: "SHIFT_CANCELED" });
    expect(derivePayrollDayState({ hasEntry: false, hasTimesheet: true, timesheetStatus: "COMPLETED", scheduled: true, shiftEnded: true, hasPaycheck: true, aggregateStatus: "RECONCILED", aggregateExplanation: "", noWorkReason: "COVERED_BY_COWORKER" })).toMatchObject({ status: "COVERED_BY_COWORKER" });
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
