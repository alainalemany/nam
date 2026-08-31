import { describe, expect, it } from "vitest";

import {
  MAX_SCHEDULE_RANGE_DAYS,
  scheduleRangeFormSchema,
  scheduleWeekStarts,
} from "@/features/work-schedule/range-validation";
import { buildDateRange, parseDateOnly } from "@/features/work-schedule/validation";

function rangeInput(startDate: string, endDate: string) {
  return {
    startDate,
    endDate,
    status: "ACTIVE",
    primaryEmployeeId: "employee-1",
    assignedByEmployeeId: "supervisor-1",
    receivedAt: "",
    sourceNote: "",
    scheduleNotes: "",
    overwriteConflicts: false,
    assignments: buildDateRange(parseDateOnly(startDate), parseDateOnly(endDate)).map((date) => ({
      ...date,
      plannedStatus: "SCHEDULED",
      plannedShift: "DAY",
      plannedEquipmentId: "equipment-1",
      actualStatus: "UNKNOWN",
      actualShift: "UNKNOWN",
      actualEquipmentId: "",
      plannedPrimaryEmployeeId: "employee-1",
      plannedPartnerEmployeeId: "",
      plannedPartnerUnknown: false,
      actualPrimaryEmployeeId: "",
      actualPartnerEmployeeId: "",
      actualPartnerUnknown: false,
      changeReason: "",
      plannedNotes: "",
      actualNotes: "",
    })),
  };
}

describe("Work Schedule range validation", () => {
  it("accepts a single-week continuous range", () => {
    const parsed = scheduleRangeFormSchema.safeParse(rangeInput("2026-08-31", "2026-09-06"));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.assignments).toHaveLength(7);
    expect(scheduleWeekStarts(parsed.data!)).toEqual(["2026-08-31"]);
  });

  it("splits the August 31-September 8 example into two Monday buckets", () => {
    const input = rangeInput("2026-08-31", "2026-09-08");
    input.assignments[0].plannedShift = "DAY";
    Object.assign(input.assignments[1], {
      plannedStatus: "NON_WORKING",
      plannedShift: "UNKNOWN",
      plannedEquipmentId: "",
      plannedPrimaryEmployeeId: "",
    });
    input.assignments.slice(2).forEach((assignment) => {
      assignment.plannedShift = "NIGHT";
    });

    const parsed = scheduleRangeFormSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.assignments.map((assignment) => [
      assignment.assignmentDate,
      assignment.plannedStatus,
      assignment.plannedShift,
    ])).toEqual([
      ["2026-08-31", "SCHEDULED", "DAY"],
      ["2026-09-01", "NON_WORKING", "UNKNOWN"],
      ["2026-09-02", "SCHEDULED", "NIGHT"],
      ["2026-09-03", "SCHEDULED", "NIGHT"],
      ["2026-09-04", "SCHEDULED", "NIGHT"],
      ["2026-09-05", "SCHEDULED", "NIGHT"],
      ["2026-09-06", "SCHEDULED", "NIGHT"],
      ["2026-09-07", "SCHEDULED", "NIGHT"],
      ["2026-09-08", "SCHEDULED", "NIGHT"],
    ]);
    expect(scheduleWeekStarts(parsed.data!)).toEqual(["2026-08-31", "2026-09-07"]);
  });

  it("keeps a night shift on its submitted start date", () => {
    const input = rangeInput("2026-09-02", "2026-09-02");
    input.assignments[0].plannedShift = "NIGHT";
    const parsed = scheduleRangeFormSchema.parse(input);
    expect(parsed.assignments).toHaveLength(1);
    expect(parsed.assignments[0]).toMatchObject({
      assignmentDate: "2026-09-02",
      plannedShift: "NIGHT",
    });
  });

  it("rejects reversed, impossible, oversized, missing, and discontinuous ranges", () => {
    expect(scheduleRangeFormSchema.safeParse(rangeInput("2026-09-08", "2026-08-31")).success).toBe(false);
    expect(scheduleRangeFormSchema.safeParse({ ...rangeInput("2026-08-31", "2026-09-01"), endDate: "2026-02-30" }).success).toBe(false);
    const oversizedEnd = new Date(Date.UTC(2026, 7, 31 + MAX_SCHEDULE_RANGE_DAYS));
    const oversized = rangeInput("2026-08-31", oversizedEnd.toISOString().slice(0, 10));
    expect(scheduleRangeFormSchema.safeParse(oversized).success).toBe(false);
    const missing = rangeInput("2026-08-31", "2026-09-02");
    missing.assignments.splice(1, 1);
    expect(scheduleRangeFormSchema.safeParse(missing).success).toBe(false);
  });
});
