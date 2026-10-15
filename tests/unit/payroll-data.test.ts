import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPayrollDashboardData } from "@/features/payroll/data";

const mocks = vi.hoisted(() => ({
  employeeFindUnique: vi.fn(),
  assignmentFindMany: vi.fn(),
  timesheetFindMany: vi.fn(),
  paycheckFindMany: vi.fn(),
  payRateFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: { findUnique: mocks.employeeFindUnique },
    dailyAssignment: { findMany: mocks.assignmentFindMany },
    weeklyTimesheet: { findMany: mocks.timesheetFindMany },
    paycheck: { findMany: mocks.paycheckFindMany },
    employeePayRate: { findMany: mocks.payRateFindMany },
  },
}));

function money(value: string) {
  return { toString: () => value };
}

function entry(id: string, workDate: string, regularMinutes: number, overtimeMinutes: number, clockOut = "19:00") {
  return {
    id,
    weeklyTimesheetId: `timesheet-${workDate}`,
    workDate: new Date(`${workDate}T00:00:00.000Z`),
    clockIn: "07:00",
    clockOut,
    workedMinutes: regularMinutes + overtimeMinutes,
    regularMinutes,
    overtimeMinutes,
    unpaidBreakMinutes: 0,
    primaryEquipmentDisplayNameSnapshot: "Synthetic Dragline",
  };
}

function timesheet(
  id: string,
  start: string,
  status: "DRAFT" | "COMPLETED",
  entries: ReturnType<typeof entry>[],
  primaryEmployeeId: string | null = "employee-1",
) {
  const end = new Date(`${start}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    id,
    payrollWeekStartDate: new Date(`${start}T00:00:00.000Z`),
    payrollWeekEndDate: end,
    status,
    primaryEmployeeId,
    primaryEmployeeDisplayName: "Alex Operator",
    primaryEmployeeKey: "alex operator",
    workedMinutesTotal: entries.reduce((sum, item) => sum + item.workedMinutes, 0),
    regularMinutesTotal: entries.reduce((sum, item) => sum + item.regularMinutes, 0),
    overtimeMinutesTotal: entries.reduce((sum, item) => sum + item.overtimeMinutes, 0),
    entries,
  };
}

function paycheck(
  id: string,
  start: string,
  end: string,
  regularMinutes: number,
  overtimeMinutes: number,
  reviewStatus: "CONFIRMED" | "NEEDS_REVIEW" = "CONFIRMED",
) {
  return {
    id,
    employeeId: "employee-1",
    payrollPeriodId: `period-${id}`,
    payrollPeriod: {
      id: `period-${id}`,
      employeeId: "employee-1",
      periodStart: new Date(`${start}T00:00:00.000Z`),
      periodEnd: new Date(`${end}T00:00:00.000Z`),
      expectedCheckDate: new Date("2026-10-21T00:00:00.000Z"),
      actualCheckDate: new Date("2026-10-21T00:00:00.000Z"),
    },
    checkDate: new Date("2026-10-21T00:00:00.000Z"),
    regularPaidMinutes: regularMinutes,
    overtimePaidMinutes: overtimeMinutes,
    baseRate: money("33.15"),
    regularEarnings: money("1326.00"),
    overtimeBaseEarnings: money("663.00"),
    overtimePremiumEarnings: money("331.50"),
    otherCashEarnings: money("0.00"),
    grossCashPay: money("2320.50"),
    noncashImputedEarnings: money("10.31"),
    preTaxDeductions: money("0.00"),
    employeeTaxes: money("0.00"),
    postTaxDeductions: money("0.00"),
    adjustments: money("0.00"),
    netPay: money("1679.46"),
    sourceFingerprint: id.padEnd(64, "a"),
    parserVersion: "synthetic-v1",
    reviewStatus,
    notes: null,
    importedAt: new Date("2026-10-21T12:00:00.000Z"),
    correctedAt: null,
  };
}

function arrange(canonical: ReturnType<typeof timesheet>[], paychecks: ReturnType<typeof paycheck>[], legacy: ReturnType<typeof timesheet>[] = []) {
  mocks.timesheetFindMany.mockResolvedValueOnce(canonical).mockResolvedValueOnce(legacy);
  mocks.paycheckFindMany.mockResolvedValue(paychecks);
}

describe("Payroll interval reconciliation data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.employeeFindUnique.mockResolvedValue({ id: "employee-1", displayName: "Alex Operator" });
    mocks.assignmentFindMany.mockResolvedValue([]);
    mocks.payRateFindMany.mockResolvedValue([]);
  });

  it("reconciles a midweek Workday period across two NAM weeks by workDate", async () => {
    arrange([
      timesheet("week-1", "2026-10-12", "COMPLETED", [
        entry("entry-before-period", "2026-10-13", 600, 0, "05:30"),
        entry("entry-1", "2026-10-14", 2400, 0, "05:30"),
      ]),
      timesheet("week-2", "2026-10-19", "COMPLETED", [entry("entry-2", "2026-10-19", 0, 1200)]),
    ], [paycheck("paycheck-1", "2026-10-14", "2026-10-20", 2400, 1200)]);

    const data = await getPayrollDashboardData("employee-1", "2026-10");
    expect(mocks.timesheetFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { primaryEmployeeId: "employee-1" },
    }));
    expect(mocks.timesheetFindMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { primaryEmployeeId: null, primaryEmployeeKey: "alex operator" },
    }));
    expect(data.paychecks[0]).toMatchObject({
      status: "RECONCILED",
      reason: "FULL_AGGREGATE_MATCH",
      differences: { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 },
    });
    expect(data.paychecks[0].boundaryExplanation).toContain("start-date workDate");
  });

  it("supports a period spanning three NAM weeks without restarting overtime", async () => {
    arrange([
      timesheet("week-1", "2026-09-28", "COMPLETED", [entry("entry-1", "2026-10-02", 600, 0)]),
      timesheet("week-2", "2026-10-05", "COMPLETED", [entry("entry-2", "2026-10-08", 600, 300)]),
      timesheet("week-3", "2026-10-12", "COMPLETED", [entry("entry-3", "2026-10-12", 600, 300)]),
    ], [paycheck("paycheck-1", "2026-10-02", "2026-10-12", 1800, 600)]);
    const data = await getPayrollDashboardData("employee-1", "2026-10");
    expect(data.paychecks[0].status).toBe("RECONCILED");
  });

  it("does not reconcile Draft, unresolved-identity, or overlapping evidence", async () => {
    const canonical = [timesheet("week-1", "2026-10-12", "DRAFT", [entry("entry-1", "2026-10-14", 600, 0)])];
    const legacy = [timesheet("legacy", "2026-10-12", "COMPLETED", [entry("legacy-entry", "2026-10-15", 600, 0)], null)];
    arrange(canonical, [
      paycheck("paycheck-1", "2026-10-12", "2026-10-18", 600, 0),
      paycheck("paycheck-2", "2026-10-15", "2026-10-21", 600, 0),
    ], legacy);
    const data = await getPayrollDashboardData("employee-1", "2026-10");
    expect(data.paychecks[0].status).toBe("NEEDS_REVIEW");
    expect(data.paychecks[0].reasons).toEqual(expect.arrayContaining([
      "DRAFT_TIMESHEET_EVIDENCE",
      "UNRESOLVED_EMPLOYEE_IDENTITY",
      "OVERLAPPING_PAYROLL_EVIDENCE",
    ]));
    expect(data.paychecks[1].status).toBe("NEEDS_REVIEW");
  });

  it("anchors selected-month reconciliation totals to Workday period end", async () => {
    const september = timesheet("week-sep", "2026-09-21", "COMPLETED", [entry("entry-sep", "2026-09-23", 600, 0)]);
    const october = timesheet("week-oct", "2026-10-12", "COMPLETED", [entry("entry-oct", "2026-10-14", 600, 0)]);
    arrange([september, october], [
      paycheck("paycheck-oct", "2026-10-12", "2026-10-18", 600, 0),
      paycheck("paycheck-sep", "2026-09-21", "2026-09-27", 600, 0),
    ]);
    const data = await getPayrollDashboardData("employee-1", "2026-10");
    expect(data.summary.reconciledMinutes).toBe(600);
    expect(data.summary.reconciledScopeLabel).toContain("ending in selected month");
  });

  it("keeps completed entries outside a partially overlapping Workday period pending", async () => {
    arrange([
      timesheet("week-oct", "2026-10-12", "COMPLETED", [
        entry("entry-covered", "2026-10-14", 600, 0),
        entry("entry-uncovered", "2026-10-17", 600, 0),
      ]),
    ], [paycheck("paycheck-partial", "2026-10-14", "2026-10-14", 600, 0)]);
    const data = await getPayrollDashboardData("employee-1", "2026-10");
    expect(data.paychecks[0].status).toBe("RECONCILED");
    expect(data.summary.pendingMinutes).toBe(600);
  });

  it("keeps matching totals in review when a scheduled date has no recorded entry", async () => {
    mocks.assignmentFindMany.mockResolvedValue([{
      assignmentDate: new Date("2026-10-15T00:00:00.000Z"),
      plannedStatus: "SCHEDULED",
      actualStatus: "UNKNOWN",
      plannedShift: "DAY",
      actualShift: "UNKNOWN",
      plannedEquipmentDisplayName: "Synthetic Dragline",
      actualEquipmentDisplayName: null,
      weeklySchedule: { primaryEmployeeId: "employee-1", status: "ACTIVE" },
    }]);
    arrange([
      timesheet("week-oct", "2026-10-12", "COMPLETED", [entry("entry-1", "2026-10-14", 600, 0)]),
    ], [paycheck("paycheck-1", "2026-10-12", "2026-10-18", 600, 0)]);
    const data = await getPayrollDashboardData("employee-1", "2026-10");
    expect(data.paychecks[0]).toMatchObject({
      status: "NEEDS_REVIEW",
      reason: "MISSING_TIMESHEET_EVIDENCE",
    });
  });

  it("does not double-count duplicate Daily Time Entry IDs and flags ambiguous dates", async () => {
    const duplicate = entry("same-entry-id", "2026-10-14", 600, 0);
    arrange([
      timesheet("week-a", "2026-10-12", "COMPLETED", [duplicate]),
      timesheet("week-b", "2026-10-12", "COMPLETED", [duplicate]),
    ], [paycheck("paycheck-1", "2026-10-12", "2026-10-18", 600, 0)]);
    const data = await getPayrollDashboardData("employee-1", "2026-10");
    expect(data.paychecks[0]).toMatchObject({
      status: "NEEDS_REVIEW",
      reason: "AMBIGUOUS_TIMESHEET_EVIDENCE",
      differences: { totalMinutes: 0 },
    });
  });

  it("does not reconcile or total an unconfirmed Paycheck even when every minute matches", async () => {
    arrange([
      timesheet("week-oct", "2026-10-12", "COMPLETED", [entry("entry-1", "2026-10-14", 2400, 1200)]),
    ], [paycheck("paycheck-1", "2026-10-12", "2026-10-18", 2400, 1200, "NEEDS_REVIEW")]);

    const data = await getPayrollDashboardData("employee-1", "2026-10");

    expect(data.paychecks[0]).toMatchObject({
      reviewStatus: "NEEDS_REVIEW",
      status: "NEEDS_REVIEW",
      reason: "UNCONFIRMED_PAYCHECK_EVIDENCE",
      differences: { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 },
    });
    expect(data.summary.reconciledMinutes).toBe(0);
    expect(data.summary.openIssues).toBe(1);
  });

  it("counts an unresolved legacy Timesheet as one actionable issue across its affected days", async () => {
    const legacy = timesheet("legacy-week", "2026-10-12", "COMPLETED", [
      entry("legacy-entry-1", "2026-10-13", 600, 0),
      entry("legacy-entry-2", "2026-10-14", 600, 0),
    ], null);
    arrange([], [], [legacy]);

    const data = await getPayrollDashboardData("employee-1", "2026-10");

    expect(data.days.find((day) => day.date === "2026-10-13")?.status).toBe("NEEDS_REVIEW");
    expect(data.days.find((day) => day.date === "2026-10-14")?.status).toBe("NEEDS_REVIEW");
    expect(data.summary.openIssues).toBe(1);
  });

  it("counts a past scheduled day without Timesheet history as a day-level issue", async () => {
    mocks.assignmentFindMany.mockResolvedValue([{
      assignmentDate: new Date("2026-10-01T00:00:00.000Z"),
      plannedStatus: "SCHEDULED",
      actualStatus: "UNKNOWN",
      plannedShift: "DAY",
      actualShift: "UNKNOWN",
      plannedEquipmentDisplayName: "Synthetic Dragline",
      actualEquipmentDisplayName: null,
      weeklySchedule: { primaryEmployeeId: "employee-1", status: "ACTIVE" },
    }]);
    arrange([], []);

    const data = await getPayrollDashboardData("employee-1", "2026-10");

    expect(data.days.find((day) => day.date === "2026-10-01")?.status).toBe("NEEDS_REVIEW");
    expect(data.summary.openIssues).toBe(1);
  });

  it("counts one period issue rather than repeating it for every affected calendar day", async () => {
    arrange([
      timesheet("week-oct", "2026-10-12", "COMPLETED", [
        entry("entry-1", "2026-10-13", 600, 0),
        entry("entry-2", "2026-10-14", 600, 0),
      ]),
    ], [paycheck("paycheck-1", "2026-10-12", "2026-10-18", 1200, 0, "NEEDS_REVIEW")]);

    const data = await getPayrollDashboardData("employee-1", "2026-10");

    expect(data.summary.openIssues).toBe(1);
  });

  it("deduplicates simultaneous day and period evidence issues", async () => {
    mocks.assignmentFindMany.mockResolvedValue([{
      assignmentDate: new Date("2026-10-15T00:00:00.000Z"),
      plannedStatus: "SCHEDULED",
      actualStatus: "UNKNOWN",
      plannedShift: "DAY",
      actualShift: "UNKNOWN",
      plannedEquipmentDisplayName: "Synthetic Dragline",
      actualEquipmentDisplayName: null,
      weeklySchedule: { primaryEmployeeId: "employee-1", status: "ACTIVE" },
    }]);
    arrange([
      timesheet("week-oct", "2026-10-12", "COMPLETED", [entry("entry-1", "2026-10-14", 600, 0)]),
    ], [paycheck("paycheck-1", "2026-10-12", "2026-10-18", 600, 0)]);

    const data = await getPayrollDashboardData("employee-1", "2026-10");

    expect(data.paychecks[0].reason).toBe("MISSING_TIMESHEET_EVIDENCE");
    expect(data.summary.openIssues).toBe(1);
  });

  it("counts an issue covering the selected calendar month even when its period ends next month", async () => {
    arrange([
      timesheet("week-oct", "2026-10-26", "COMPLETED", [entry("entry-1", "2026-10-31", 600, 0)]),
    ], [paycheck("paycheck-1", "2026-10-31", "2026-11-01", 600, 0, "NEEDS_REVIEW")]);

    const data = await getPayrollDashboardData("employee-1", "2026-10");

    expect(data.summary.openIssues).toBe(1);
    expect(data.summary.reconciledMinutes).toBe(0);
  });

  it("reports zero open issues when no actionable evidence exists", async () => {
    arrange([], []);

    const data = await getPayrollDashboardData("employee-1", "2026-10");

    expect(data.summary.openIssues).toBe(0);
  });
});
