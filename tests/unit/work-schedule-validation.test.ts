import { describe, expect, it } from "vitest";

import {
  buildAssignmentCrewMembers,
  buildDailyAssignmentWriteData,
  equipmentSnapshot,
  type ExistingAssignmentSnapshot,
  type EquipmentSnapshotSource,
} from "@/features/work-schedule/persistence";
import {
  buildWeekDates,
  dateInputValue,
  nextMonday,
  normalizePrimaryEmployeeKey,
  parseDateOnly,
  weeklyScheduleFormSchema,
} from "@/features/work-schedule/validation";

const equipment: EquipmentSnapshotSource = {
  id: "equipment-1",
  displayName: "Dragline 7",
  equipmentNumber: "DL-7",
  category: "DRAGLINE",
  mine: {
    name: "North Mine",
    city: {
      name: "Gillette",
      state: "WY",
    },
  },
};

const replacementEquipment: EquipmentSnapshotSource = {
  id: "equipment-2",
  displayName: "Dragline 9",
  equipmentNumber: "DL-9",
  category: "DRAGLINE",
  mine: {
    name: "South Mine",
    city: {
      name: "Casper",
      state: "WY",
    },
  },
};

const existingAssignment: ExistingAssignmentSnapshot = {
  plannedEquipmentId: "equipment-1",
  plannedEquipmentDisplayName: "Historic Planned Dragline",
  plannedEquipmentNumber: "HP-1",
  plannedEquipmentCategory: "DRAGLINE",
  plannedMineName: "Historic Planned Mine",
  plannedCityName: "Historic Planned City",
  plannedCityState: "WY",
  actualEquipmentId: "equipment-1",
  actualEquipmentDisplayName: "Historic Actual Dragline",
  actualEquipmentNumber: "HA-1",
  actualEquipmentCategory: "DRAGLINE",
  actualMineName: "Historic Actual Mine",
  actualCityName: "Historic Actual City",
  actualCityState: "WY",
};

function assignment(date: string, index: number) {
  return {
    assignmentDate: date,
    dayOfWeek: index + 1,
    plannedStatus: "UNKNOWN",
    plannedShift: "UNKNOWN",
    plannedEquipmentId: "",
    actualStatus: "UNKNOWN",
    actualShift: "UNKNOWN",
    actualEquipmentId: "",
    plannedPrimaryDisplayName: "",
    plannedPartnerDisplayName: "",
    plannedPartnerUnknown: false,
    actualPrimaryDisplayName: "",
    actualPartnerDisplayName: "",
    actualPartnerUnknown: false,
    changeReason: "",
    plannedNotes: "",
    actualNotes: "",
  };
}

function validSchedule(overrides = {}) {
  const weekStartDate = "2026-07-13";

  return {
    weekStartDate,
    status: "ACTIVE",
    primaryEmployeeDisplayName: "Alex Operator",
    assignedByDisplayName: "Sam Supervisor",
    receivedAt: "2026-07-10T16:30",
    sourceNote: "",
    scheduleNotes: "",
    assignments: buildWeekDates(parseDateOnly(weekStartDate)).map((day, index) =>
      assignment(day.assignmentDate, index),
    ),
    ...overrides,
  };
}

describe("Work Schedule date helpers", () => {
  it("builds a Monday-Sunday operational week", () => {
    expect(buildWeekDates(parseDateOnly("2026-07-13"))).toEqual([
      { assignmentDate: "2026-07-13", dayOfWeek: 1 },
      { assignmentDate: "2026-07-14", dayOfWeek: 2 },
      { assignmentDate: "2026-07-15", dayOfWeek: 3 },
      { assignmentDate: "2026-07-16", dayOfWeek: 4 },
      { assignmentDate: "2026-07-17", dayOfWeek: 5 },
      { assignmentDate: "2026-07-18", dayOfWeek: 6 },
      { assignmentDate: "2026-07-19", dayOfWeek: 7 },
    ]);
  });

  it("chooses the next Monday instead of reusing the current Monday", () => {
    expect(dateInputValue(nextMonday(new Date("2026-07-13T12:00:00.000Z")))).toBe(
      "2026-07-20",
    );
  });
});

describe("normalizePrimaryEmployeeKey", () => {
  it("normalizes whitespace and capitalization for owner identity", () => {
    expect(normalizePrimaryEmployeeKey("  Alex   Operator  ")).toBe("alex operator");
    expect(normalizePrimaryEmployeeKey("ALEX Operator")).toBe("alex operator");
  });
});

describe("weeklyScheduleFormSchema", () => {
  it("accepts a valid weekly schedule and normalizes optional text", () => {
    const parsed = weeklyScheduleFormSchema.safeParse(
      validSchedule({
        sourceNote: "  ",
        scheduleNotes: "  Crew may change midweek.  ",
      }),
    );

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      sourceNote: undefined,
      scheduleNotes: "Crew may change midweek.",
    });
  });

  it("requires a Monday week start and seven matching assignment dates", () => {
    const parsed = weeklyScheduleFormSchema.safeParse(
      validSchedule({ weekStartDate: "2026-07-14" }),
    );

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.weekStartDate).toContain(
      "Week must start on Monday.",
    );
    expect(parsed.error?.flatten().fieldErrors.assignments?.length).toBeGreaterThan(0);
  });

  it("prevents duplicate assignment dates", () => {
    const schedule = validSchedule();
    schedule.assignments[1] = { ...schedule.assignments[1], assignmentDate: "2026-07-13" };
    const parsed = weeklyScheduleFormSchema.safeParse(schedule);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.assignments).toContain(
      "A week cannot contain duplicate assignment dates.",
    );
  });

  it("requires planned and actual shift and equipment when a day is scheduled", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedStatus: "SCHEDULED",
      actualStatus: "SCHEDULED",
    };
    const parsed = weeklyScheduleFormSchema.safeParse(schedule);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.assignments).toEqual(
      expect.arrayContaining([
        "Assignment 1 needs a planned shift.",
        "Assignment 1 needs planned equipment.",
        "Assignment 1 needs an actual shift.",
        "Assignment 1 needs actual equipment.",
      ]),
    );
  });

  it("preserves planned versus actual differences with a change reason", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedStatus: "SCHEDULED",
      plannedShift: "DAY",
      plannedEquipmentId: "equipment-1",
      actualStatus: "SCHEDULED",
      actualShift: "NIGHT",
      actualEquipmentId: "equipment-1",
    };
    const missingReason = weeklyScheduleFormSchema.safeParse(schedule);

    expect(missingReason.success).toBe(false);
    expect(missingReason.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["assignments", 0, "changeReason"] }),
        expect.objectContaining({ path: ["assignments", 0, "actualNotes"] }),
      ]),
    );

    schedule.assignments[0].changeReason = "Shift changed after startup.";
    expect(weeklyScheduleFormSchema.safeParse(schedule).success).toBe(true);
  });

  it("allows actual notes to explain planned-versus-actual differences", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedStatus: "SCHEDULED",
      plannedShift: "DAY",
      plannedEquipmentId: "equipment-1",
      actualStatus: "SCHEDULED",
      actualShift: "NIGHT",
      actualEquipmentId: "equipment-1",
      actualNotes: "Changed by dispatch.",
    };

    expect(weeklyScheduleFormSchema.safeParse(schedule).success).toBe(true);
  });

  it("prevents the same person from appearing twice in the same crew", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedPartnerDisplayName: "alex operator",
    };
    const parsed = weeklyScheduleFormSchema.safeParse(schedule);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ["assignments", 0, "plannedPartnerDisplayName"],
        message: "Assignment 1 has the same planned person twice.",
      }),
    );
  });

  it("rejects unknown partner flags when a partner name is populated", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedPartnerUnknown: true,
      plannedPartnerDisplayName: "Jordan Partner",
      actualPartnerUnknown: true,
      actualPartnerDisplayName: "Casey Partner",
    };
    const parsed = weeklyScheduleFormSchema.safeParse(schedule);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["assignments", 0, "plannedPartnerDisplayName"] }),
        expect.objectContaining({ path: ["assignments", 0, "actualPartnerDisplayName"] }),
      ]),
    );
  });

  it("allows unknown partner without a name and known partner with a name", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedPartnerUnknown: true,
      actualPartnerDisplayName: "Jordan Partner",
    };

    expect(weeklyScheduleFormSchema.safeParse(schedule).success).toBe(true);
  });
});

describe("Work Schedule persistence helpers", () => {
  it("snapshots only the approved equipment and location display fields", () => {
    expect(equipmentSnapshot(equipment)).toEqual({
      equipmentDisplayName: "Dragline 7",
      equipmentNumber: "DL-7",
      equipmentCategory: "DRAGLINE",
      mineName: "North Mine",
      cityName: "Gillette",
      cityState: "WY",
    });
  });

  it("builds assignment write data with independent planned and actual snapshots", () => {
    const parsed = weeklyScheduleFormSchema.parse(
      validSchedule({
        assignments: validSchedule().assignments.map((item, index) =>
          index === 0
            ? {
                ...item,
                plannedStatus: "SCHEDULED",
                plannedShift: "DAY",
                plannedEquipmentId: "equipment-1",
                actualStatus: "SCHEDULED",
                actualShift: "NIGHT",
                actualEquipmentId: "equipment-1",
                actualPartnerUnknown: true,
                changeReason: "Actual shift changed.",
              }
            : item,
        ),
      }),
    );

    const writeData = buildDailyAssignmentWriteData(
      parsed.assignments[0],
      parsed.primaryEmployeeDisplayName,
      new Map([["equipment-1", equipment]]),
    );

    expect(writeData).toMatchObject({
      plannedEquipmentId: "equipment-1",
      plannedEquipmentDisplayName: "Dragline 7",
      plannedMineName: "North Mine",
      actualEquipmentId: "equipment-1",
      actualEquipmentDisplayName: "Dragline 7",
      actualMineName: "North Mine",
      changeReason: "Actual shift changed.",
    });
  });

  it("preserves unchanged planned and actual snapshots on edit", () => {
    const parsed = weeklyScheduleFormSchema.parse(
      validSchedule({
        assignments: validSchedule().assignments.map((item, index) =>
          index === 0
            ? {
                ...item,
                plannedStatus: "SCHEDULED",
                plannedShift: "DAY",
                plannedEquipmentId: "equipment-1",
                actualStatus: "SCHEDULED",
                actualShift: "DAY",
                actualEquipmentId: "equipment-1",
              }
            : item,
        ),
      }),
    );

    const writeData = buildDailyAssignmentWriteData(
      parsed.assignments[0],
      parsed.primaryEmployeeDisplayName,
      new Map([["equipment-1", equipment]]),
      existingAssignment,
    );

    expect(writeData).toMatchObject({
      plannedEquipmentDisplayName: "Historic Planned Dragline",
      actualEquipmentDisplayName: "Historic Actual Dragline",
    });
  });

  it("refreshes only the snapshot group whose equipment changed", () => {
    const parsed = weeklyScheduleFormSchema.parse(
      validSchedule({
        assignments: validSchedule().assignments.map((item, index) =>
          index === 0
            ? {
                ...item,
                plannedStatus: "SCHEDULED",
                plannedShift: "DAY",
                plannedEquipmentId: "equipment-2",
                actualStatus: "SCHEDULED",
                actualShift: "DAY",
                actualEquipmentId: "equipment-1",
                changeReason: "Planned equipment changed before shift.",
              }
            : item,
        ),
      }),
    );

    const writeData = buildDailyAssignmentWriteData(
      parsed.assignments[0],
      parsed.primaryEmployeeDisplayName,
      new Map([
        ["equipment-1", equipment],
        ["equipment-2", replacementEquipment],
      ]),
      existingAssignment,
    );

    expect(writeData).toMatchObject({
      plannedEquipmentDisplayName: "Dragline 9",
      plannedMineName: "South Mine",
      actualEquipmentDisplayName: "Historic Actual Dragline",
      actualMineName: "Historic Actual Mine",
    });
  });

  it("preserves snapshots when the live Equipment relation is already null", () => {
    const existingWithDeletedEquipment = {
      ...existingAssignment,
      plannedEquipmentId: null,
      actualEquipmentId: null,
    };
    const parsed = weeklyScheduleFormSchema.parse(validSchedule());
    const writeData = buildDailyAssignmentWriteData(
      parsed.assignments[0],
      parsed.primaryEmployeeDisplayName,
      new Map(),
      existingWithDeletedEquipment,
    );

    expect(writeData).toMatchObject({
      plannedEquipmentDisplayName: "Historic Planned Dragline",
      actualEquipmentDisplayName: "Historic Actual Dragline",
    });
  });

  it("uses crew name snapshots and an explicit unknown-partner state", () => {
    const parsed = weeklyScheduleFormSchema.parse(
      validSchedule({
        assignments: validSchedule().assignments.map((item, index) =>
          index === 0
            ? {
                ...item,
                plannedPartnerUnknown: true,
                actualPartnerDisplayName: "Jordan Partner",
              }
            : item,
        ),
      }),
    );

    expect(buildAssignmentCrewMembers(parsed.assignments[0], "Alex Operator")).toEqual(
      expect.arrayContaining([
        {
          phase: "PLANNED",
          role: "PRIMARY_EMPLOYEE",
          displayName: "Alex Operator",
          isUnknown: false,
        },
        {
          phase: "PLANNED",
          role: "PARTNER",
          displayName: null,
          isUnknown: true,
        },
        {
          phase: "ACTUAL",
          role: "PARTNER",
          displayName: "Jordan Partner",
          isUnknown: false,
        },
      ]),
    );
  });

  it("does not create actual crew rows while actual assignment is unknown", () => {
    const parsed = weeklyScheduleFormSchema.parse(validSchedule());

    expect(buildAssignmentCrewMembers(parsed.assignments[0], "Alex Operator")).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: "ACTUAL", role: "PRIMARY_EMPLOYEE" }),
      ]),
    );
  });

  it("creates actual crew when actual assignment or actual crew is known", () => {
    const parsed = weeklyScheduleFormSchema.parse(
      validSchedule({
        assignments: validSchedule().assignments.map((item, index) =>
          index === 0
            ? {
                ...item,
                actualPartnerDisplayName: "Replacement Partner",
              }
            : item,
        ),
      }),
    );

    expect(buildAssignmentCrewMembers(parsed.assignments[0], "Alex Operator")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "ACTUAL",
          role: "PRIMARY_EMPLOYEE",
          displayName: "Alex Operator",
        }),
        expect.objectContaining({
          phase: "ACTUAL",
          role: "PARTNER",
          displayName: "Replacement Partner",
        }),
      ]),
    );
  });
});
