import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  scheduleRangeInitialValuesFromRecord,
} from "@/features/work-schedule/data";
import { buildDateRange, parseDateOnly } from "@/features/work-schedule/validation";

const mocks = vi.hoisted(() => ({
  assignmentFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dailyAssignment: { findMany: mocks.assignmentFindMany },
  },
}));

function assignment(assignmentDate: string, index: number) {
  const off = assignmentDate === "2026-09-01";
  return {
    id: `assignment-${assignmentDate}`,
    weeklyScheduleId: assignmentDate < "2026-09-07" ? "week-1" : "week-2",
    assignmentDate: parseDateOnly(assignmentDate),
    dayOfWeek: parseDateOnly(assignmentDate).getUTCDay() || 7,
    plannedStatus: off ? "NON_WORKING" : "SCHEDULED",
    plannedShift: off ? "UNKNOWN" : index === 0 ? "DAY" : "NIGHT",
    plannedEquipmentId: off ? null : "equipment-1",
    actualStatus: off ? "NON_WORKING" : "UNKNOWN",
    actualShift: "UNKNOWN",
    actualEquipmentId: null,
    changeReason: null,
    plannedNotes: null,
    actualNotes: null,
    plannedEquipment: null,
    actualEquipment: null,
    crewMembers: off ? [] : [
      {
        phase: "PLANNED",
        role: "PRIMARY_EMPLOYEE",
        employeeId: "employee-1",
        displayName: "Alex Operator",
        isUnknown: false,
      },
      {
        phase: "PLANNED",
        role: "PARTNER",
        employeeId: "partner-1",
        displayName: "Jordan Partner",
        isUnknown: false,
      },
    ],
  };
}

function schedule(assignments: ReturnType<typeof assignment>[]) {
  return {
    id: "week-1",
    weekStartDate: parseDateOnly("2026-08-31"),
    weekEndDate: parseDateOnly("2026-09-06"),
    status: "ACTIVE",
    primaryEmployeeId: "employee-1",
    primaryEmployeeDisplayName: "Alex Operator",
    primaryEmployeeKey: "alex operator",
    assignedByEmployeeId: "supervisor-1",
    assignedByDisplayName: "Sam Supervisor",
    receivedAt: null,
    sourceNote: null,
    scheduleNotes: null,
    assignments,
    primaryEmployee: null,
    assignedByEmployee: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Work Schedule edit range data", () => {
  it("initializes a selected cross-week range from all persisted assignments", async () => {
    const persisted = buildDateRange(parseDateOnly("2026-08-31"), parseDateOnly("2026-09-08"))
      .map((date, index) => assignment(date.assignmentDate, index));
    mocks.assignmentFindMany.mockResolvedValue(persisted);

    const values = await scheduleRangeInitialValuesFromRecord(
      schedule(persisted.slice(0, 7)) as never,
      { startDate: "2026-08-31", endDate: "2026-09-08" },
    );

    expect(values.assignments).toHaveLength(9);
    expect(values.assignments.map((item) => [item.assignmentDate, item.plannedShift]))
      .toEqual([
        ["2026-08-31", "DAY"],
        ["2026-09-01", "UNKNOWN"],
        ["2026-09-02", "NIGHT"],
        ["2026-09-03", "NIGHT"],
        ["2026-09-04", "NIGHT"],
        ["2026-09-05", "NIGHT"],
        ["2026-09-06", "NIGHT"],
        ["2026-09-07", "NIGHT"],
        ["2026-09-08", "NIGHT"],
      ]);
    expect(mocks.assignmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        weeklySchedule: { primaryEmployeeId: "employee-1" },
      }),
    }));
  });
});
