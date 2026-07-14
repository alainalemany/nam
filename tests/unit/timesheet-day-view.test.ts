import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getTimesheetContextsForDate,
  timesheetContextFromEntry,
  timesheetContextsFromEntries,
} from "@/features/timesheets/data";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dailyTimeEntry: { findMany: mocks.findMany },
  },
}));

type ContextEntry = Parameters<typeof timesheetContextFromEntry>[0];

function entry(overrides: Partial<ContextEntry> = {}): ContextEntry {
  return {
    id: "entry-1",
    weeklyTimesheetId: "timesheet-1",
    workDate: new Date("2026-07-13T00:00:00.000Z"),
    clockIn: "07:00",
    clockOut: "19:00",
    unpaidBreakMinutes: 30,
    workedMinutes: 690,
    regularMinutes: 690,
    overtimeMinutes: 0,
    primaryEquipmentId: null,
    primaryEquipmentDisplayNameSnapshot: "Historic Dragline",
    primaryEquipmentNumberSnapshot: "HD-1",
    primaryEquipmentCategorySnapshot: "DRAGLINE",
    primaryMineNameSnapshot: "Historic Mine",
    primaryCityNameSnapshot: "Historic City",
    primaryCityStateSnapshot: "WY",
    workScheduleDailyAssignmentId: null,
    notes: null,
    createdAt: new Date("2026-07-13T00:00:00.000Z"),
    updatedAt: new Date("2026-07-13T00:00:00.000Z"),
    weeklyTimesheet: {
      id: "timesheet-1",
      payrollWeekStartDate: new Date("2026-07-13T00:00:00.000Z"),
      payrollWeekEndDate: new Date("2026-07-19T00:00:00.000Z"),
      status: "DRAFT",
      primaryEmployeeDisplayName: "Alex Operator",
      primaryEmployeeKey: "alex operator",
      workedMinutesTotal: 690,
      regularMinutesTotal: 690,
      overtimeMinutesTotal: 0,
      createdAt: new Date("2026-07-13T00:00:00.000Z"),
      updatedAt: new Date("2026-07-13T00:00:00.000Z"),
    },
    allocations: [allocation()],
    ...overrides,
  };
}

function allocation(overrides: Partial<ContextEntry["allocations"][number]> = {}) {
  return {
    id: "allocation-1",
    dailyTimeEntryId: "entry-1",
    sequence: 1,
    workCodeId: "code-1",
    workCodeSnapshot: "P-137",
    workCodeDescriptionSnapshot: "Production",
    workOrderId: null,
    workOrderSnapshot: null,
    workOrderDescriptionSnapshot: null,
    allocatedMinutes: 690,
    notes: null,
    createdAt: new Date("2026-07-13T00:00:00.000Z"),
    updatedAt: new Date("2026-07-13T00:00:00.000Z"),
    supportPersonnel: [],
    ...overrides,
  };
}

function supportPerson(displayName: string, index: number) {
  return {
    id: `link-${index}`,
    workAllocationId: "allocation-2",
    supportPersonId: `person-${index}`,
    supportPersonDisplayNameSnapshot: displayName,
    supportPersonTradeOrRoleSnapshot: "Mechanic",
    supportPersonCompanySnapshot: null,
    createdAt: new Date("2026-07-13T00:00:00.000Z"),
    updatedAt: new Date("2026-07-13T00:00:00.000Z"),
  };
}

describe("Timesheet Day View context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no contexts when no Daily Time Entry matches", () => {
    expect(timesheetContextsFromEntries([])).toEqual([]);
  });

  it("uses authoritative stored minutes and historical Equipment snapshots", () => {
    const context = timesheetContextFromEntry(entry());

    expect(context).toMatchObject({
      status: "Draft",
      workDate: "2026-07-13",
      workedMinutes: 690,
      workedTime: "11:30",
      regularTime: "11:30",
      overtimeTime: "0:00",
      allocationStatus: "Balanced",
      equipment: "Historic Dragline #HD-1 (Historic Mine - Historic City, WY)",
      detailHref: "/timesheets/timesheet-1",
    });
  });

  it.each([
    [600, "Underallocated", "1:30 remaining"],
    [750, "Overallocated", "1:00 overallocated"],
  ] as const)("interprets Draft allocation reconciliation", (minutes, status, label) => {
    const context = timesheetContextFromEntry(
      entry({ allocations: [allocation({ allocatedMinutes: minutes })] }),
    );

    expect(context).toMatchObject({ allocationStatus: status, allocationStatusLabel: label });
  });

  it("represents Completed mixed regular and overtime values without recalculation", () => {
    const base = entry();
    const context = timesheetContextFromEntry(entry({
      regularMinutes: 300,
      overtimeMinutes: 390,
      weeklyTimesheet: { ...base.weeklyTimesheet, status: "COMPLETED" },
    }));

    expect(context).toMatchObject({
      status: "Completed",
      regularTime: "5:00",
      overtimeTime: "6:30",
    });
  });

  it("summarizes ordered production and maintenance allocations with support snapshots", () => {
    const context = timesheetContextFromEntry(entry({
      allocations: [
        allocation({ allocatedMinutes: 300 }),
        allocation({
          id: "allocation-2",
          sequence: 2,
          workCodeSnapshot: "OM-137",
          workCodeDescriptionSnapshot: "Maintenance",
          workOrderId: null,
          workOrderSnapshot: "WO-88",
          workOrderDescriptionSnapshot: "Boom repair",
          allocatedMinutes: 390,
          supportPersonnel: [supportPerson("Pat Smith", 1), supportPerson("Jo Lee", 2)],
        }),
      ],
    }));

    expect(context.allocations).toEqual([
      expect.objectContaining({ sequence: 1, workCode: "P-137 - Production", workOrder: undefined }),
      expect.objectContaining({
        sequence: 2,
        workCode: "OM-137 - Maintenance",
        workOrder: "WO-88 - Boom repair",
        supportPersonnel: ["Pat Smith", "Jo Lee"],
      }),
    ]);
  });

  it("queries the selected date and returns every owner deterministically", async () => {
    mocks.findMany.mockResolvedValue([entry()]);

    await expect(getTimesheetContextsForDate("2026-07-13")).resolves.toHaveLength(1);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workDate: new Date("2026-07-13T00:00:00.000Z") },
      orderBy: [
        { weeklyTimesheet: { primaryEmployeeDisplayName: "asc" } },
        { id: "asc" },
      ],
    }));
  });
});
