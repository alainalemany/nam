import { describe, expect, it } from "vitest";

import { selectCurrentOrNextShift } from "@/features/work-schedule/home-summary";

type Assignment = Parameters<typeof selectCurrentOrNextShift>[0][number];

function assignment(date: string, shift: "DAY" | "NIGHT", id = date): Assignment {
  return {
    id,
    weeklyScheduleId: `schedule-${id}`,
    assignmentDate: new Date(`${date}T00:00:00.000Z`),
    plannedStatus: "SCHEDULED",
    plannedShift: shift,
    plannedEquipmentDisplayName: "MTECK 2100E",
    plannedEquipmentNumber: "101151",
    plannedEquipmentId: "equipment-101151",
    plannedMineName: "Martin Marietta",
    actualStatus: "UNKNOWN",
    actualShift: "UNKNOWN",
    actualEquipmentDisplayName: null,
    actualEquipmentNumber: null,
    actualEquipmentId: null,
    actualMineName: null,
    crewMembers: [{ phase: "PLANNED", role: "PARTNER", displayName: "Ernesto Gonzalez", isUnknown: false }],
  };
}

describe("Home Current / Next Shift selection", () => {
  it("selects an active day shift", () => {
    const result = selectCurrentOrNextShift(
      [assignment("2026-09-30", "DAY")],
      new Date("2026-09-30T14:00:00.000Z"),
    );
    expect(result).toMatchObject({ kind: "CURRENT", shiftLabel: "Day Shift", relativeLabel: "In Progress", equipmentId: "equipment-101151" });
  });

  it("keeps an overnight night shift active on the following calendar day", () => {
    const result = selectCurrentOrNextShift(
      [assignment("2026-09-30", "NIGHT")],
      new Date("2026-10-01T06:00:00.000Z"),
    );
    expect(result).toMatchObject({ kind: "CURRENT", assignmentDate: "2026-09-30", timeLabel: "5:00 PM – 5:00 AM" });
  });

  it("prioritizes a current shift over a future assignment", () => {
    const result = selectCurrentOrNextShift(
      [assignment("2026-09-30", "DAY", "current"), assignment("2026-10-02", "NIGHT", "future")],
      new Date("2026-09-30T14:00:00.000Z"),
    );
    expect(result?.assignmentId).toBe("current");
  });

  it("selects the next future assignment", () => {
    const result = selectCurrentOrNextShift(
      [assignment("2026-10-02", "NIGHT")],
      new Date("2026-09-30T16:00:00.000Z"),
    );
    expect(result).toMatchObject({ kind: "NEXT", assignmentDate: "2026-10-02", relativeLabel: "Starts in 2 days" });
  });

  it("returns an empty result when no assignment is current or upcoming", () => {
    expect(selectCurrentOrNextShift(
      [assignment("2026-09-28", "DAY")],
      new Date("2026-09-30T16:00:00.000Z"),
    )).toBeUndefined();
  });

  it("handles an overnight shift across a Sunday-to-Monday week boundary", () => {
    const result = selectCurrentOrNextShift(
      [assignment("2026-10-04", "NIGHT")],
      new Date("2026-10-05T06:00:00.000Z"),
    );
    expect(result).toMatchObject({ kind: "CURRENT", assignmentDate: "2026-10-04" });
  });

  it("uses recorded actual assignment data instead of the plan", () => {
    const source = assignment("2026-09-30", "NIGHT");
    source.actualStatus = "SCHEDULED";
    source.actualShift = "DAY";
    source.actualEquipmentDisplayName = "Replacement Dragline";
    source.actualEquipmentNumber = "101133";
    source.actualEquipmentId = "equipment-101133";
    source.actualMineName = "SDI Martin Marietta";
    source.crewMembers.push({ phase: "ACTUAL", role: "PARTNER", displayName: "Actual Partner", isUnknown: false });
    const result = selectCurrentOrNextShift([source], new Date("2026-09-30T14:00:00.000Z"));
    expect(result).toMatchObject({ shift: "DAY", equipmentId: "equipment-101133", equipmentLabel: "Replacement Dragline #101133", partnerLabel: "Actual Partner" });
  });
});
