import { describe, expect, it } from "vitest";

import {
  allocateWeeklyOvertime,
  buildTimesheetPreview,
  buildPayrollWeekDates,
  calculateGrossMinutes,
  calculateWorkedMinutes,
  normalizeIdentityKey,
  normalizeReferenceKey,
  normalizeSupportPersonKey,
  parseDateOnly,
} from "@/features/timesheets/calculations";
import {
  supportPersonSchema,
  validateCompletion,
  weeklyTimesheetInputSchema,
  workCodeSchema,
  workOrderSchema,
} from "@/features/timesheets/validation";

function entry(overrides = {}) {
  return {
    workDate: "2026-07-13",
    clockIn: "17:00",
    clockOut: "05:00",
    unpaidBreakMinutes: 30,
    primaryEquipmentId: "equipment-1",
    workScheduleDailyAssignmentId: "",
    notes: "",
    allocations: [],
    ...overrides,
  };
}

function timesheet(overrides = {}) {
  return {
    payrollWeekStartDate: "2026-07-13",
    primaryEmployeeDisplayName: "Alex Operator",
    entries: [entry()],
    ...overrides,
  };
}

describe("Timesheet payroll week and identity", () => {
  it("builds a Monday-Sunday payroll week", () => {
    expect(buildPayrollWeekDates(parseDateOnly("2026-07-15"))).toEqual([
      "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19",
    ]);
  });

  it("normalizes owner and reference identities deterministically", () => {
    expect(normalizeIdentityKey("  ALEX   Operator ")).toBe("alex operator");
    expect(normalizeReferenceKey(" om-137 ")).toBe("OM-137");
    expect(normalizeSupportPersonKey(" Pat  Smith ", " Mechanic ", " ACME ")).toBe("pat smith|mechanic|acme");
  });
});

describe("Timesheet minute calculations", () => {
  it("calculates overnight worked time on the shift-start date", () => {
    expect(calculateGrossMinutes("17:00", "05:00")).toBe(720);
    expect(calculateWorkedMinutes("17:00", "05:00", 30)).toBe(690);
  });

  it("allocates the first 2,400 minutes as regular in work-date order", () => {
    const result = allocateWeeklyOvertime([
      { workDate: "2026-07-17", workedMinutes: 720 },
      { workDate: "2026-07-13", workedMinutes: 1_200 },
      { workDate: "2026-07-15", workedMinutes: 1_200 },
    ]);
    expect(result).toEqual([
      { workDate: "2026-07-13", workedMinutes: 1_200, regularMinutes: 1_200, overtimeMinutes: 0 },
      { workDate: "2026-07-15", workedMinutes: 1_200, regularMinutes: 1_200, overtimeMinutes: 0 },
      { workDate: "2026-07-17", workedMinutes: 720, regularMinutes: 0, overtimeMinutes: 720 },
    ]);
  });

  it("treats equal clock values as the approved 24-hour gross case", () => {
    expect(calculateGrossMinutes("07:00", "07:00")).toBe(1_440);
  });

  it("supports nearly 24 hours and midnight boundaries", () => {
    expect(calculateGrossMinutes("00:01", "00:00")).toBe(1_439);
    expect(calculateGrossMinutes("23:30", "00:00")).toBe(30);
  });

  it("builds per-day and weekly reconciliation previews", () => {
    const preview = buildTimesheetPreview([
      {
        workDate: "2026-07-13",
        clockIn: "07:00",
        clockOut: "19:00",
        unpaidBreakMinutes: 30,
        allocations: [{ allocatedMinutes: 600 }],
      },
      {
        workDate: "2026-07-14",
        clockIn: "07:00",
        clockOut: "19:00",
        unpaidBreakMinutes: 30,
        allocations: [{ allocatedMinutes: 750 }],
      },
    ]);
    expect(preview.entries[0]).toMatchObject({
      workedMinutes: 690,
      allocatedMinutes: 600,
      allocationDifferenceMinutes: 90,
      balanced: false,
    });
    expect(preview.entries[1]).toMatchObject({
      workedMinutes: 690,
      allocationDifferenceMinutes: -60,
      balanced: false,
    });
    expect(preview).toMatchObject({
      workedMinutes: 1_380,
      allocatedMinutes: 1_350,
      allocationDifferenceMinutes: 30,
      balanced: false,
    });
  });

  it("recalculates later overtime previews when an earlier day changes or is removed", () => {
    const input = [
      { workDate: "2026-07-13", clockIn: "00:00", clockOut: "20:00", unpaidBreakMinutes: 0, allocations: [] },
      { workDate: "2026-07-14", clockIn: "00:00", clockOut: "20:00", unpaidBreakMinutes: 0, allocations: [] },
      { workDate: "2026-07-15", clockIn: "00:00", clockOut: "10:00", unpaidBreakMinutes: 0, allocations: [] },
    ];
    const original = buildTimesheetPreview(input);
    expect(original.entries[2]).toMatchObject({ regularMinutes: 0, overtimeMinutes: 600 });

    const edited = buildTimesheetPreview([
      { ...input[0], clockOut: "10:00" },
      input[1],
      input[2],
    ]);
    expect(edited.entries[2]).toMatchObject({ regularMinutes: 600, overtimeMinutes: 0 });

    const removed = buildTimesheetPreview(input.slice(1));
    expect(removed.entries[1]).toMatchObject({ regularMinutes: 600, overtimeMinutes: 0 });
  });

  it("splits a day that crosses the weekly overtime threshold", () => {
    const preview = buildTimesheetPreview([
      { workDate: "2026-07-13", clockIn: "00:00", clockOut: "20:00", unpaidBreakMinutes: 0, allocations: [] },
      { workDate: "2026-07-14", clockIn: "00:00", clockOut: "15:00", unpaidBreakMinutes: 0, allocations: [] },
      { workDate: "2026-07-15", clockIn: "00:00", clockOut: "10:00", unpaidBreakMinutes: 0, allocations: [] },
    ]);
    expect(preview.entries[2]).toMatchObject({ regularMinutes: 300, overtimeMinutes: 300 });
    expect(preview).toMatchObject({ regularMinutes: 2_400, overtimeMinutes: 300 });
  });
});

describe("Timesheet validation", () => {
  it("accepts a valid overnight Draft entry without allocations", () => {
    expect(weeklyTimesheetInputSchema.safeParse(timesheet()).success).toBe(true);
  });

  it("does not create an empty first-use weekly container", () => {
    const parsed = weeklyTimesheetInputSchema.safeParse(timesheet({ entries: [] }));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["entries"] }),
    ]));
  });

  it("rejects non-Monday weeks, dates outside the week, and duplicate dates", () => {
    const parsed = weeklyTimesheetInputSchema.safeParse(timesheet({
      payrollWeekStartDate: "2026-07-14",
      entries: [entry(), entry({ workDate: "2026-07-13" })],
    }));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["payrollWeekStartDate", "entries"]),
    );
  });

  it("rejects breaks at least as long as the gross shift", () => {
    const parsed = weeklyTimesheetInputSchema.safeParse(timesheet({ entries: [entry({ unpaidBreakMinutes: 720 })] }));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["entries", 0, "unpaidBreakMinutes"] }),
    ]));
  });

  it("requires unique allocation sequence and positive integer minutes", () => {
    const allocation = { sequence: 1, workCodeId: "code-1", workOrderId: "", allocatedMinutes: 60, supportPersonIds: [], notes: "" };
    const parsed = weeklyTimesheetInputSchema.safeParse(timesheet({ entries: [entry({ allocations: [allocation, { ...allocation }] })] }));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["entries", 0, "allocations"] }),
    ]));
  });

  it("allows Draft imbalance but completion requires exact reconciliation", () => {
    expect(weeklyTimesheetInputSchema.safeParse(timesheet()).success).toBe(true);
    expect(validateCompletion([{ workedMinutes: 690, allocations: [{ allocatedMinutes: 600 }] }])).toContain("Entry 1 allocations must equal worked minutes.");
    expect(validateCompletion([{ workedMinutes: 690, allocations: [{ allocatedMinutes: 690 }] }])).toEqual([]);
  });

  it("validates Timesheet-owned reference records", () => {
    expect(workCodeSchema.safeParse({ code: "P-137", description: "Production", active: true }).success).toBe(true);
    expect(workOrderSchema.safeParse({ workOrderNumber: "WO-1", description: "Repair", active: true }).success).toBe(true);
    expect(supportPersonSchema.safeParse({ displayName: "Pat Smith", tradeOrRole: "Mechanic", active: true }).success).toBe(true);
  });
});
