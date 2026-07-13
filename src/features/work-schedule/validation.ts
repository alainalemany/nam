import { z } from "zod";

import {
  dailyAssignmentStatusValues,
  shiftValues,
  weeklyScheduleStatusValues,
} from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

const optionalText = (max = 500) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(max, `Use ${max} characters or fewer.`).optional(),
  );

const optionalDateTime = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Use a valid date and time.")
    .optional(),
);

const requiredText = (label: string, max = 200) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1, `${label} is required.`).max(max, `${label} is too long.`),
  );

const checkboxBoolean = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

const dateOnlyString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

export function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function toDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

export function isMonday(value: Date) {
  return value.getUTCDay() === 1;
}

export function startOfOperationalWeek(value: Date) {
  const date = toDateOnly(value);
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return addDays(date, -daysSinceMonday);
}

export function endOfOperationalWeek(weekStartDate: Date) {
  return addDays(toDateOnly(weekStartDate), 6);
}

export function buildWeekDates(weekStartDate: Date) {
  const start = toDateOnly(weekStartDate);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return {
      assignmentDate: dateInputValue(date),
      dayOfWeek: index + 1,
    };
  });
}

export function nextMonday(from = new Date()) {
  const today = toDateOnly(from);
  const day = today.getUTCDay();
  const daysUntilNextMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  return addDays(today, daysUntilNextMonday);
}

export function normalizePrimaryEmployeeKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export const assignmentFormSchema = z.object({
  assignmentDate: dateOnlyString,
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  plannedStatus: z.enum(dailyAssignmentStatusValues),
  plannedShift: z.enum(shiftValues),
  plannedEquipmentId: optionalText(120),
  actualStatus: z.enum(dailyAssignmentStatusValues),
  actualShift: z.enum(shiftValues),
  actualEquipmentId: optionalText(120),
  plannedPrimaryDisplayName: optionalText(160),
  plannedPartnerDisplayName: optionalText(160),
  plannedPartnerUnknown: checkboxBoolean.default(false),
  actualPrimaryDisplayName: optionalText(160),
  actualPartnerDisplayName: optionalText(160),
  actualPartnerUnknown: checkboxBoolean.default(false),
  changeReason: optionalText(500),
  plannedNotes: optionalText(1000),
  actualNotes: optionalText(1000),
});

export const weeklyScheduleFormSchema = z
  .object({
    weekStartDate: dateOnlyString,
    status: z.enum(weeklyScheduleStatusValues),
    primaryEmployeeDisplayName: requiredText("Primary employee", 160),
    assignedByDisplayName: requiredText("Assigned By", 160),
    receivedAt: optionalDateTime,
    sourceNote: optionalText(2000),
    scheduleNotes: optionalText(2000),
    assignments: z.array(assignmentFormSchema).length(7, "A weekly schedule needs seven days."),
  })
  .superRefine((value, context) => {
    const weekStart = parseDateOnly(value.weekStartDate);
    const weekEnd = endOfOperationalWeek(weekStart);

    if (!isMonday(weekStart)) {
      context.addIssue({
        code: "custom",
        path: ["weekStartDate"],
        message: "Week must start on Monday.",
      });
    }

    const seenDates = new Set<string>();

    value.assignments.forEach((assignment, index) => {
      const assignmentDate = parseDateOnly(assignment.assignmentDate);
      const expectedDate = addDays(weekStart, index);

      if (assignmentDate < weekStart || assignmentDate > weekEnd) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "assignmentDate"],
          message: `Assignment ${index + 1} must be inside the selected week.`,
        });
      }

      if (assignment.assignmentDate !== dateInputValue(expectedDate)) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "assignmentDate"],
          message: `Assignment ${index + 1} date does not match the weekly grid.`,
        });
      }

      if (seenDates.has(assignment.assignmentDate)) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "assignmentDate"],
          message: "A week cannot contain duplicate assignment dates.",
        });
      }
      seenDates.add(assignment.assignmentDate);

      if (assignment.plannedStatus === "SCHEDULED") {
        if (assignment.plannedShift === "UNKNOWN") {
          context.addIssue({
            code: "custom",
            path: ["assignments", index, "plannedShift"],
            message: `Assignment ${index + 1} needs a planned shift.`,
          });
        }

        if (!assignment.plannedEquipmentId) {
          context.addIssue({
            code: "custom",
            path: ["assignments", index, "plannedEquipmentId"],
            message: `Assignment ${index + 1} needs planned equipment.`,
          });
        }
      }

      if (assignment.actualStatus === "SCHEDULED") {
        if (assignment.actualShift === "UNKNOWN") {
          context.addIssue({
            code: "custom",
            path: ["assignments", index, "actualShift"],
            message: `Assignment ${index + 1} needs an actual shift.`,
          });
        }

        if (!assignment.actualEquipmentId) {
          context.addIssue({
            code: "custom",
            path: ["assignments", index, "actualEquipmentId"],
            message: `Assignment ${index + 1} needs actual equipment.`,
          });
        }
      }

      const plannedPrimary =
        assignment.plannedPrimaryDisplayName ?? value.primaryEmployeeDisplayName;
      const actualPrimary =
        assignment.actualPrimaryDisplayName ?? value.primaryEmployeeDisplayName;

      if (
        assignment.plannedPartnerDisplayName &&
        assignment.plannedPartnerDisplayName.toLocaleLowerCase() ===
          plannedPrimary.toLocaleLowerCase()
      ) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "plannedPartnerDisplayName"],
          message: `Assignment ${index + 1} has the same planned person twice.`,
        });
      }

      if (assignment.plannedPartnerUnknown && assignment.plannedPartnerDisplayName) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "plannedPartnerDisplayName"],
          message: `Assignment ${index + 1} cannot have a planned partner name when planned partner is unknown.`,
        });
      }

      if (
        assignment.actualPartnerDisplayName &&
        assignment.actualPartnerDisplayName.toLocaleLowerCase() ===
          actualPrimary.toLocaleLowerCase()
      ) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "actualPartnerDisplayName"],
          message: `Assignment ${index + 1} has the same actual person twice.`,
        });
      }

      if (assignment.actualPartnerUnknown && assignment.actualPartnerDisplayName) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "actualPartnerDisplayName"],
          message: `Assignment ${index + 1} cannot have an actual partner name when actual partner is unknown.`,
        });
      }

      const actualDiffers =
        assignment.actualStatus !== "UNKNOWN" &&
        (assignment.actualStatus !== assignment.plannedStatus ||
          assignment.actualShift !== assignment.plannedShift ||
          (assignment.actualEquipmentId ?? "") !== (assignment.plannedEquipmentId ?? "") ||
          (assignment.actualPartnerDisplayName ?? "") !==
            (assignment.plannedPartnerDisplayName ?? "") ||
          assignment.actualPartnerUnknown !== assignment.plannedPartnerUnknown);

      if (actualDiffers && !assignment.changeReason && !assignment.actualNotes) {
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "changeReason"],
          message: `Assignment ${index + 1} needs a change reason or actual note when actual work differs from the plan.`,
        });
        context.addIssue({
          code: "custom",
          path: ["assignments", index, "actualNotes"],
          message: `Assignment ${index + 1} needs a change reason or actual note when actual work differs from the plan.`,
        });
      }
    });
  });

export type AssignmentFormInput = z.infer<typeof assignmentFormSchema>;
export type WeeklyScheduleFormInput = z.infer<typeof weeklyScheduleFormSchema>;

export type WeeklyScheduleFormField =
  | keyof Omit<WeeklyScheduleFormInput, "assignments">
  | "assignments";

export type AssignmentFormField = keyof AssignmentFormInput;

export type WeeklyScheduleFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<WeeklyScheduleFormField, string[]>>;
  assignmentErrors: Record<number, Partial<Record<AssignmentFormField, string[]>>>;
};

export const emptyWeeklyScheduleFormState: WeeklyScheduleFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  assignmentErrors: {},
};
