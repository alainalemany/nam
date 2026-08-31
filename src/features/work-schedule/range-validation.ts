import { z } from "zod";

import {
  dailyAssignmentStatusValues,
  shiftValues,
  weeklyScheduleStatusValues,
} from "./constants";
import {
  addDays,
  buildDateRange,
  dateInputValue,
  isValidDateOnlyString,
  parseDateOnly,
} from "./validation";

export const MAX_SCHEDULE_RANGE_DAYS = 31;

const optionalText = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(max, `Use ${max} characters or fewer.`).optional(),
  );

const optionalDateTime = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().refine(
    (value) => !Number.isNaN(new Date(value).getTime()),
    "Use a valid date and time.",
  ).optional(),
);

const checkboxBoolean = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

const dateOnlyString = z.string().refine(isValidDateOnlyString, "Use a valid date.");

export const scheduleRangeAssignmentSchema = z.object({
  assignmentDate: dateOnlyString,
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  plannedStatus: z.enum(dailyAssignmentStatusValues),
  plannedShift: z.enum(shiftValues),
  plannedEquipmentId: optionalText(120),
  actualStatus: z.enum(dailyAssignmentStatusValues),
  actualShift: z.enum(shiftValues),
  actualEquipmentId: optionalText(120),
  plannedPrimaryEmployeeId: optionalText(120),
  plannedPartnerEmployeeId: optionalText(120),
  plannedPartnerUnknown: checkboxBoolean.default(false),
  actualPrimaryEmployeeId: optionalText(120),
  actualPartnerEmployeeId: optionalText(120),
  actualPartnerUnknown: checkboxBoolean.default(false),
  changeReason: optionalText(500),
  plannedNotes: optionalText(1000),
  actualNotes: optionalText(1000),
});

export const scheduleRangeFormSchema = z
  .object({
    startDate: dateOnlyString,
    endDate: dateOnlyString,
    status: z.enum(weeklyScheduleStatusValues),
    primaryEmployeeId: optionalText(120),
    assignedByEmployeeId: optionalText(120),
    receivedAt: optionalDateTime,
    sourceNote: optionalText(2000),
    scheduleNotes: optionalText(2000),
    overwriteConflicts: checkboxBoolean.default(false),
    assignments: z.array(scheduleRangeAssignmentSchema).min(1, "Add at least one schedule date."),
  })
  .superRefine((value, context) => {
    const start = parseDateOnly(value.startDate);
    const end = parseDateOnly(value.endDate);

    if (end < start) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after start date.",
      });
      return;
    }

    const expectedDates = buildDateRange(start, end);
    if (expectedDates.length > MAX_SCHEDULE_RANGE_DAYS) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: `Schedule ranges may include up to ${MAX_SCHEDULE_RANGE_DAYS} days.`,
      });
    }

    if (value.assignments.length !== expectedDates.length) {
      context.addIssue({
        code: "custom",
        path: ["assignments"],
        message: "Include one assignment for every date in the selected range.",
      });
    }

    const seenDates = new Set<string>();
    value.assignments.forEach((assignment, index) => {
      const expected = expectedDates[index];
      if (!expected || assignment.assignmentDate !== expected.assignmentDate) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "assignmentDate"],
          message: `Date ${index + 1} does not match the selected range.`,
        });
      }
      if (expected && assignment.dayOfWeek !== expected.dayOfWeek) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "dayOfWeek"],
          message: `Date ${index + 1} has an invalid day of week.`,
        });
      }
      if (seenDates.has(assignment.assignmentDate)) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "assignmentDate"],
          message: "A schedule range cannot contain duplicate dates.",
        });
      }
      seenDates.add(assignment.assignmentDate);

      const off = assignment.plannedStatus === "NON_WORKING";
      const cancelled = assignment.plannedStatus === "CANCELLED";
      if (assignment.plannedStatus === "SCHEDULED") {
        if (assignment.plannedShift === "UNKNOWN") {
          context.addIssue({
            code: "custom",
            path: ["assignments", index, "plannedShift"],
            message: `Date ${index + 1} needs a planned shift.`,
          });
        }
        if (!assignment.plannedEquipmentId) {
          context.addIssue({
            code: "custom",
            path: ["assignments", index, "plannedEquipmentId"],
            message: `Date ${index + 1} needs planned equipment.`,
          });
        }
      }

      if (!off && !cancelled && assignment.actualStatus === "SCHEDULED") {
        if (assignment.actualShift === "UNKNOWN") {
          context.addIssue({
            code: "custom",
            path: ["assignments", index, "actualShift"],
            message: `Date ${index + 1} needs an actual shift.`,
          });
        }
        if (!assignment.actualEquipmentId) {
          context.addIssue({
            code: "custom",
            path: ["assignments", index, "actualEquipmentId"],
            message: `Date ${index + 1} needs actual equipment.`,
          });
        }
      }

      const plannedPrimary = assignment.plannedPrimaryEmployeeId ?? value.primaryEmployeeId;
      const actualPrimary = assignment.actualPrimaryEmployeeId ?? plannedPrimary;
      if (!off && !cancelled && assignment.plannedPartnerEmployeeId &&
        assignment.plannedPartnerEmployeeId === plannedPrimary) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "plannedPartnerEmployeeId"],
          message: `Date ${index + 1} has the same planned person twice.`,
        });
      }
      if (assignment.plannedPartnerUnknown && assignment.plannedPartnerEmployeeId) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "plannedPartnerEmployeeId"],
          message: `Date ${index + 1} cannot select a planned partner and mark the partner unknown.`,
        });
      }
      if (!off && !cancelled && assignment.actualPartnerEmployeeId &&
        assignment.actualPartnerEmployeeId === actualPrimary) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "actualPartnerEmployeeId"],
          message: `Date ${index + 1} has the same actual person twice.`,
        });
      }
      if (assignment.actualPartnerUnknown && assignment.actualPartnerEmployeeId) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "actualPartnerEmployeeId"],
          message: `Date ${index + 1} cannot select an actual partner and mark the partner unknown.`,
        });
      }

      const actualDiffers = assignment.actualStatus !== "UNKNOWN" &&
        (assignment.actualStatus !== assignment.plannedStatus ||
          assignment.actualShift !== assignment.plannedShift ||
          (assignment.actualEquipmentId ?? "") !== (assignment.plannedEquipmentId ?? "") ||
          actualPrimary !== plannedPrimary ||
          (assignment.actualPartnerEmployeeId ?? "") !==
            (assignment.plannedPartnerEmployeeId ?? "") ||
          assignment.actualPartnerUnknown !== assignment.plannedPartnerUnknown);
      if (!off && !cancelled && actualDiffers && !assignment.changeReason && !assignment.actualNotes) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "changeReason"],
          message: `Date ${index + 1} needs a change reason or actual note when actual work differs from the plan.`,
        });
      }
    });
  })
  .transform((value) => ({
    ...value,
    assignments: value.assignments.map((assignment) => {
      if (assignment.plannedStatus === "NON_WORKING") {
        return {
          ...assignment,
          actualStatus: "NON_WORKING" as const,
          plannedShift: "UNKNOWN" as const,
          actualShift: "UNKNOWN" as const,
          plannedEquipmentId: undefined,
          actualEquipmentId: undefined,
          plannedPrimaryEmployeeId: undefined,
          plannedPartnerEmployeeId: undefined,
          plannedPartnerUnknown: false,
          actualPrimaryEmployeeId: undefined,
          actualPartnerEmployeeId: undefined,
          actualPartnerUnknown: false,
          changeReason: undefined,
          plannedNotes: undefined,
          actualNotes: undefined,
        };
      }
      if (assignment.plannedStatus === "CANCELLED") {
        return {
          ...assignment,
          actualStatus: "CANCELLED" as const,
          actualShift: "UNKNOWN" as const,
          actualEquipmentId: undefined,
          actualPrimaryEmployeeId: undefined,
          actualPartnerEmployeeId: undefined,
          actualPartnerUnknown: false,
          actualNotes: undefined,
        };
      }
      return assignment;
    }),
  }));

export type ScheduleRangeFormInput = z.infer<typeof scheduleRangeFormSchema>;
export type ScheduleRangeAssignmentInput = ScheduleRangeFormInput["assignments"][number];

export function scheduleWeekStarts(input: ScheduleRangeFormInput) {
  const starts = new Set(
    input.assignments.map((assignment) => {
      const date = parseDateOnly(assignment.assignmentDate);
      const day = date.getUTCDay();
      const daysSinceMonday = day === 0 ? 6 : day - 1;
      return dateInputValue(addDays(date, -daysSinceMonday));
    }),
  );
  return [...starts].sort();
}
