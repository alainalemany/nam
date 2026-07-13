import { describe, expect, it } from "vitest";

import {
  workScheduleContextFromAssignment,
  workScheduleContextsFromAssignments,
} from "@/features/work-schedule/data";

type ContextAssignment = Parameters<typeof workScheduleContextFromAssignment>[0];

function assignment(overrides: Partial<ContextAssignment> = {}): ContextAssignment {
  return {
    id: "assignment-1",
    weeklyScheduleId: "schedule-1",
    assignmentDate: new Date("2026-07-13T00:00:00.000Z"),
    dayOfWeek: 1,
    plannedStatus: "SCHEDULED",
    plannedShift: "DAY",
    plannedEquipmentId: "planned-equipment-1",
    plannedEquipmentDisplayName: "Historic Planned Dragline",
    plannedEquipmentNumber: "HP-1",
    plannedEquipmentCategory: "DRAGLINE",
    plannedMineName: "Historic Planned Mine",
    plannedCityName: "Historic Planned City",
    plannedCityState: "WY",
    actualStatus: "UNKNOWN",
    actualShift: "UNKNOWN",
    actualEquipmentId: null,
    actualEquipmentDisplayName: null,
    actualEquipmentNumber: null,
    actualEquipmentCategory: null,
    actualMineName: null,
    actualCityName: null,
    actualCityState: null,
    changeReason: null,
    plannedNotes: null,
    actualNotes: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    plannedEquipment: null,
    actualEquipment: null,
    weeklySchedule: {
      id: "schedule-1",
      weekStartDate: new Date("2026-07-13T00:00:00.000Z"),
      weekEndDate: new Date("2026-07-19T00:00:00.000Z"),
      status: "ACTIVE",
      primaryEmployeeDisplayName: "Alex Operator",
      primaryEmployeeKey: "alex operator",
      assignedByDisplayName: "Sam Supervisor",
      receivedAt: null,
      sourceNote: null,
      scheduleNotes: null,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
    crewMembers: [
      {
        id: "crew-planned-primary",
        dailyAssignmentId: "assignment-1",
        phase: "PLANNED",
        role: "PRIMARY_EMPLOYEE",
        displayName: "Alex Operator",
        isUnknown: false,
        notes: null,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ],
    ...overrides,
  };
}

function partner(
  phase: "PLANNED" | "ACTUAL",
  displayName: string | null,
  isUnknown = false,
) {
  return {
    id: `${phase}-${displayName ?? "unknown"}`,
    dailyAssignmentId: "assignment-1",
    phase,
    role: "PARTNER" as const,
    displayName,
    isUnknown,
    notes: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}

function actualPrimary() {
  return {
    id: "crew-actual-primary",
    dailyAssignmentId: "assignment-1",
    phase: "ACTUAL" as const,
    role: "PRIMARY_EMPLOYEE" as const,
    displayName: "Alex Operator",
    isUnknown: false,
    notes: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}

describe("Work Schedule Day View context", () => {
  it("returns no contexts when no schedule assignments match the selected date", () => {
    expect(workScheduleContextsFromAssignments([])).toEqual([]);
  });

  it("uses historical equipment snapshots and links to the weekly schedule", () => {
    const context = workScheduleContextFromAssignment(assignment());

    expect(context).toMatchObject({
      assignmentDate: "2026-07-13",
      detailHref: "/work-schedule/schedule-1",
      planned: {
        equipment: "Historic Planned Dragline #HP-1 (Historic Planned Mine - Historic Planned City, WY)",
      },
    });
  });

  it("marks non-working days without requiring actual records", () => {
    const context = workScheduleContextFromAssignment(
      assignment({
        plannedStatus: "NON_WORKING",
        plannedShift: "UNKNOWN",
        plannedEquipmentId: null,
        plannedEquipmentDisplayName: null,
      }),
    );

    expect(context.outcome).toBe("Non-Working");
    expect(context.actual.recorded).toBe(false);
  });

  it("marks planned scheduled work as actual not recorded when actual details are absent", () => {
    const context = workScheduleContextFromAssignment(assignment());

    expect(context.outcome).toBe("Actual Not Recorded");
    expect(context.actual).toMatchObject({
      equipment: "Not recorded",
      partner: { label: "Not recorded", state: "not_recorded" },
      recorded: false,
      shift: "Not recorded",
      status: "Not recorded",
    });
  });

  it("marks planned and actual assignments that match", () => {
    const context = workScheduleContextFromAssignment(
      assignment({
        actualStatus: "SCHEDULED",
        actualShift: "DAY",
        actualEquipmentId: "planned-equipment-1",
        actualEquipmentDisplayName: "Historic Actual Dragline",
        actualEquipmentNumber: "HA-1",
        actualMineName: "Historic Actual Mine",
        actualCityName: "Historic Actual City",
        actualCityState: "WY",
        crewMembers: [actualPrimary()],
      }),
    );

    expect(context.outcome).toBe("Matches Plan");
    expect(context.changed).toBe(false);
  });

  it("detects equipment changes inside Work Schedule", () => {
    const context = workScheduleContextFromAssignment(
      assignment({
        actualStatus: "SCHEDULED",
        actualShift: "DAY",
        actualEquipmentId: "actual-equipment-2",
        actualEquipmentDisplayName: "Actual Replacement Dragline",
        changeReason: "Equipment reassigned.",
        crewMembers: [actualPrimary()],
      }),
    );

    expect(context.outcome).toBe("Changed");
    expect(context.changed).toBe(true);
    expect(context.explanation).toBe("Equipment reassigned.");
  });

  it("detects shift changes inside Work Schedule", () => {
    const context = workScheduleContextFromAssignment(
      assignment({
        actualStatus: "SCHEDULED",
        actualShift: "NIGHT",
        actualEquipmentId: "planned-equipment-1",
        actualEquipmentDisplayName: "Historic Actual Dragline",
        actualNotes: "Moved to night shift.",
        crewMembers: [actualPrimary()],
      }),
    );

    expect(context.outcome).toBe("Changed");
    expect(context.explanation).toBe("Moved to night shift.");
  });

  it("detects partner changes inside Work Schedule", () => {
    const context = workScheduleContextFromAssignment(
      assignment({
        actualStatus: "SCHEDULED",
        actualShift: "DAY",
        actualEquipmentId: "planned-equipment-1",
        actualEquipmentDisplayName: "Historic Actual Dragline",
        crewMembers: [
          partner("PLANNED", "Planned Partner"),
          actualPrimary(),
          partner("ACTUAL", "Actual Partner"),
        ],
        changeReason: "Partner replaced.",
      }),
    );

    expect(context.outcome).toBe("Changed");
    expect(context.actual.partner.label).toBe("Actual Partner");
  });

  it("marks cancelled assignments", () => {
    const context = workScheduleContextFromAssignment(
      assignment({
        actualStatus: "CANCELLED",
        actualNotes: "No work performed.",
      }),
    );

    expect(context.outcome).toBe("Cancelled");
  });

  it("represents unknown planned and actual partners distinctly", () => {
    const context = workScheduleContextFromAssignment(
      assignment({
        actualStatus: "SCHEDULED",
        actualShift: "DAY",
        actualEquipmentId: "planned-equipment-1",
        actualEquipmentDisplayName: "Historic Actual Dragline",
        crewMembers: [
          partner("PLANNED", null, true),
          actualPrimary(),
          partner("ACTUAL", null, true),
        ],
      }),
    );

    expect(context.planned.partner).toEqual({
      label: "Unknown partner",
      state: "unknown",
    });
    expect(context.actual.partner).toEqual({
      label: "Unknown partner",
      state: "unknown",
    });
  });
});
