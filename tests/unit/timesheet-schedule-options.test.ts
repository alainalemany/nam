import { beforeEach, describe, expect, it, vi } from "vitest";

import { getWorkScheduleAssignmentOptions } from "@/features/timesheets/data";

const mocks = vi.hoisted(() => ({ assignmentFindMany: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { dailyAssignment: { findMany: mocks.assignmentFindMany } },
}));

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assignment-oct-14",
    assignmentDate: new Date("2026-10-14T00:00:00.000Z"),
    plannedStatus: "SCHEDULED",
    actualStatus: "UNKNOWN",
    plannedShift: "NIGHT",
    actualShift: "UNKNOWN",
    plannedEquipmentDisplayName: "MTECK 2100E Dragline",
    plannedEquipmentId: "equipment-101151",
    plannedEquipmentNumber: "101151",
    actualEquipmentDisplayName: null,
    actualEquipmentId: null,
    actualEquipmentNumber: null,
    weeklySchedule: {
      primaryEmployeeId: "employee-1",
      status: "ACTIVE",
      sourceNote: "Synthetic October schedule",
    },
    crewMembers: [{ displayName: "Alex Operator", isUnknown: false }],
    ...overrides,
  };
}

describe("Timesheet Work Schedule discovery", () => {
  beforeEach(() => mocks.assignmentFindMany.mockReset());

  it("discovers the October 14 Night assignment by canonical employee and week", async () => {
    mocks.assignmentFindMany.mockResolvedValue([assignment()]);
    const result = await getWorkScheduleAssignmentOptions("employee-1", "2026-10-12");

    expect(mocks.assignmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{
        assignmentDate: {
          gte: new Date("2026-10-12T00:00:00.000Z"),
          lte: new Date("2026-10-18T00:00:00.000Z"),
        },
        weeklySchedule: { primaryEmployeeId: "employee-1" },
      }] },
    }));
    expect(result).toEqual([expect.objectContaining({
      id: "assignment-oct-14",
      workDate: "2026-10-14",
      selectable: true,
      scheduledEquipmentId: "equipment-101151",
    })]);
    expect(result[0].label).toContain("Night");
    expect(result[0].label).toContain("MTECK 2100E Dragline #101151");
  });

  it.each([
    ["Draft schedule", assignment({ weeklySchedule: { primaryEmployeeId: "employee-1", status: "DRAFT", sourceNote: null } })],
    ["Archived schedule", assignment({ weeklySchedule: { primaryEmployeeId: "employee-1", status: "ARCHIVED", sourceNote: null } })],
    ["Off assignment", assignment({ plannedStatus: "NON_WORKING" })],
    ["Cancelled actual assignment", assignment({ actualStatus: "CANCELLED" })],
    ["Unknown assignment", assignment({ plannedStatus: "UNKNOWN" })],
    ["Another employee", assignment({ weeklySchedule: { primaryEmployeeId: "employee-2", status: "ACTIVE", sourceNote: null } })],
  ])("retains %s as non-selectable historical context", async (_label, fixture) => {
    mocks.assignmentFindMany.mockResolvedValue([fixture]);
    const [result] = await getWorkScheduleAssignmentOptions(
      "employee-1",
      "2026-10-12",
      ["assignment-oct-14"],
    );
    expect(result.selectable).toBe(false);
    expect(result.warning).toBeTruthy();
  });
});
