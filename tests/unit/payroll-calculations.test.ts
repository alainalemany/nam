import { describe, expect, it } from "vitest";

import {
  aggregateReconciliationState,
  derivePayrollDayState,
  estimatedGrossCents,
  payrollPeriodForDate,
} from "@/features/payroll/calculations";
import { calculateWorkedMinutes, dateInputValue } from "@/features/timesheets/calculations";

describe("payroll reconciliation calculations", () => {
  it("projects a Monday-Sunday period to the following Friday", () => {
    const result = payrollPeriodForDate(new Date("2026-09-16T00:00:00.000Z"));
    expect(dateInputValue(result.periodStart)).toBe("2026-09-14");
    expect(dateInputValue(result.periodEnd)).toBe("2026-09-20");
    expect(dateInputValue(result.expectedCheckDate)).toBe("2026-09-25");
  });

  it("matches 60 recorded hours to 40 regular plus 20 overtime", () => {
    expect(aggregateReconciliationState({ hasPaycheck: true, timesheetStatus: "COMPLETED", recordedMinutes: 3600, paidMinutes: 3600 }))
      .toMatchObject({ status: "RECONCILED", differenceMinutes: 0 });
  });

  it("reports a 12-hour discrepancy", () => {
    expect(aggregateReconciliationState({ hasPaycheck: true, timesheetStatus: "COMPLETED", recordedMinutes: 4320, paidMinutes: 3600 }))
      .toMatchObject({ status: "DISCREPANCY", differenceMinutes: 720 });
  });

  it("calls completed hours awaiting payroll without claiming overdue pay", () => {
    const result = aggregateReconciliationState({ hasPaycheck: false, timesheetStatus: "COMPLETED", recordedMinutes: 2520 });
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
