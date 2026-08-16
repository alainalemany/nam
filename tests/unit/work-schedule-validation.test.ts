import { describe, expect, it } from "vitest";

import {
  buildAssignmentCrewMembers,
  buildDailyAssignmentWriteData,
  equipmentSnapshot,
  type EmployeeSnapshotSource,
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

const employees = new Map<string, EmployeeSnapshotSource>([
  ["employee-1", { id: "employee-1", employeeCode: "100", displayName: "Alex Operator", isActive: true, isSupervisor: false }],
  ["employee-2", { id: "employee-2", employeeCode: "200", displayName: "Jordan Partner", isActive: true, isSupervisor: false }],
  ["employee-3", { id: "employee-3", employeeCode: "300", displayName: "Casey Partner", isActive: true, isSupervisor: false }],
]);

const primaryEmployee = { employeeId: "employee-1", displayName: "Alex Operator" };

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
  crewMembers: [],
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
    plannedPrimaryEmployeeId: "employee-1",
    plannedPartnerEmployeeId: "",
    plannedPartnerUnknown: false,
    actualPrimaryEmployeeId: "employee-1",
    actualPartnerEmployeeId: "",
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
    primaryEmployeeId: "employee-1",
    assignedByEmployeeId: "supervisor-1",
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

  it("validates the effective Actual Primary against Planned Primary", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedPrimaryEmployeeId: "employee-2",
      actualPrimaryEmployeeId: "",
      actualPartnerEmployeeId: "employee-2",
    };

    const parsed = weeklyScheduleFormSchema.safeParse(schedule);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ["assignments", 0, "actualPartnerEmployeeId"],
        message: "Assignment 1 has the same actual person twice.",
      }),
    );
  });

  it("prevents the same person from appearing twice in the same crew", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedPartnerEmployeeId: "employee-1",
    };
    const parsed = weeklyScheduleFormSchema.safeParse(schedule);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ["assignments", 0, "plannedPartnerEmployeeId"],
        message: "Assignment 1 has the same planned person twice.",
      }),
    );
  });

  it("rejects unknown partner flags when a partner name is populated", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedPartnerUnknown: true,
      plannedPartnerEmployeeId: "employee-2",
      actualPartnerUnknown: true,
      actualPartnerEmployeeId: "employee-3",
    };
    const parsed = weeklyScheduleFormSchema.safeParse(schedule);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["assignments", 0, "plannedPartnerEmployeeId"] }),
        expect.objectContaining({ path: ["assignments", 0, "actualPartnerEmployeeId"] }),
      ]),
    );
  });

  it("allows unknown partner without a name and known partner with a name", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedPartnerUnknown: true,
      actualPartnerEmployeeId: "employee-2",
    };

    expect(weeklyScheduleFormSchema.safeParse(schedule).success).toBe(true);
  });

  it("normalizes NON_WORKING without requiring or retaining assignment fields", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedStatus: "NON_WORKING",
      plannedShift: "DAY",
      plannedEquipmentId: "equipment-1",
      actualStatus: "SCHEDULED",
      actualShift: "NIGHT",
      actualEquipmentId: "equipment-2",
      plannedPrimaryEmployeeId: "employee-1",
      plannedPartnerEmployeeId: "employee-1",
      plannedPartnerUnknown: true,
      actualPrimaryEmployeeId: "employee-1",
      actualPartnerEmployeeId: "employee-1",
      actualPartnerUnknown: true,
      changeReason: "Not applicable",
      plannedNotes: "Not applicable",
      actualNotes: "Not applicable",
    };

    const parsed = weeklyScheduleFormSchema.parse(schedule);
    expect(parsed.assignments[0]).toMatchObject({
      plannedStatus: "NON_WORKING",
      actualStatus: "NON_WORKING",
      plannedShift: "UNKNOWN",
      actualShift: "UNKNOWN",
      plannedPartnerUnknown: false,
      actualPartnerUnknown: false,
    });
    expect(parsed.assignments[0].plannedEquipmentId).toBeUndefined();
    expect(parsed.assignments[0].actualEquipmentId).toBeUndefined();
    expect(parsed.assignments[0].plannedPrimaryEmployeeId).toBeUndefined();
    expect(parsed.assignments[0].changeReason).toBeUndefined();
    expect(parsed.assignments[0].plannedNotes).toBeUndefined();
    expect(parsed.assignments[0].actualNotes).toBeUndefined();

    expect(buildAssignmentCrewMembers(
      parsed.assignments[0],
      primaryEmployee,
      employees,
    )).toEqual([]);
  });

  it("normalizes CANCELLED by preserving planned history and clearing actual execution", () => {
    const schedule = validSchedule();
    schedule.assignments[0] = {
      ...schedule.assignments[0],
      plannedStatus: "CANCELLED",
      plannedShift: "DAY",
      plannedEquipmentId: "equipment-1",
      plannedPrimaryEmployeeId: "employee-1",
      plannedPartnerEmployeeId: "employee-2",
      plannedNotes: "Originally scheduled",
      actualStatus: "SCHEDULED",
      actualShift: "NIGHT",
      actualEquipmentId: "equipment-2",
      actualPrimaryEmployeeId: "employee-3",
      actualPartnerEmployeeId: "employee-1",
      actualNotes: "Must be cleared",
      changeReason: "Weather cancellation",
    };

    const parsed = weeklyScheduleFormSchema.parse(schedule);
    expect(parsed.assignments[0]).toMatchObject({
      plannedStatus: "CANCELLED",
      plannedShift: "DAY",
      plannedEquipmentId: "equipment-1",
      plannedPrimaryEmployeeId: "employee-1",
      plannedPartnerEmployeeId: "employee-2",
      plannedNotes: "Originally scheduled",
      actualStatus: "CANCELLED",
      actualShift: "UNKNOWN",
      changeReason: "Weather cancellation",
    });
    expect(parsed.assignments[0].actualEquipmentId).toBeUndefined();
    expect(parsed.assignments[0].actualPrimaryEmployeeId).toBeUndefined();
    expect(parsed.assignments[0].actualPartnerEmployeeId).toBeUndefined();
    expect(parsed.assignments[0].actualNotes).toBeUndefined();
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
      primaryEmployee,
      new Map([["equipment-1", equipment]]),
      employees,
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
      primaryEmployee,
      new Map([["equipment-1", equipment]]),
      employees,
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
      primaryEmployee,
      new Map([
        ["equipment-1", equipment],
        ["equipment-2", replacementEquipment],
      ]),
      employees,
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
      primaryEmployee,
      new Map(),
      employees,
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
                actualPartnerEmployeeId: "employee-2",
              }
            : item,
        ),
      }),
    );

    expect(buildAssignmentCrewMembers(parsed.assignments[0], primaryEmployee, employees)).toEqual(
      expect.arrayContaining([
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
          employeeId: null,
          displayName: null,
          isUnknown: true,
        },
        {
          phase: "ACTUAL",
          role: "PARTNER",
          employeeId: "employee-2",
          displayName: "Jordan Partner",
          isUnknown: false,
        },
      ]),
    );
  });

  it("does not create actual crew rows while actual assignment is unknown", () => {
    const parsed = weeklyScheduleFormSchema.parse(validSchedule());

    parsed.assignments[0].actualStatus = "UNKNOWN";
    parsed.assignments[0].actualPrimaryEmployeeId = undefined;
    expect(buildAssignmentCrewMembers(parsed.assignments[0], primaryEmployee, employees)).not.toEqual(
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
                actualPartnerEmployeeId: "employee-2",
              }
            : item,
        ),
      }),
    );

    expect(buildAssignmentCrewMembers(parsed.assignments[0], primaryEmployee, employees)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "ACTUAL",
          role: "PRIMARY_EMPLOYEE",
          displayName: "Alex Operator",
          employeeId: "employee-1",
        }),
        expect.objectContaining({
          phase: "ACTUAL",
          role: "PARTNER",
          displayName: "Jordan Partner",
          employeeId: "employee-2",
        }),
      ]),
    );
  });

  it("does not reapply a planned partner when actual partner is explicitly blank", () => {
    const parsed = weeklyScheduleFormSchema.parse(
      validSchedule({
        assignments: validSchedule().assignments.map((item, index) =>
          index === 0
            ? {
                ...item,
                actualStatus: "SCHEDULED",
                actualShift: "DAY",
                actualEquipmentId: "equipment-1",
                plannedPartnerEmployeeId: "employee-2",
                actualPartnerEmployeeId: "",
                changeReason: "Worked without the planned partner.",
              }
            : item,
        ),
      }),
    );

    expect(buildAssignmentCrewMembers(parsed.assignments[0], primaryEmployee, employees)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: "ACTUAL", role: "PARTNER" }),
      ]),
    );
  });
});
