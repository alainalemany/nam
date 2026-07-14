import { z } from "zod";

import {
  calculateGrossMinutes,
  calculateWorkedMinutes,
  endOfPayrollWeek,
  normalizeIdentityKey,
  normalizeReferenceKey,
  normalizeSupportPersonKey,
  parseDateOnly,
  startOfPayrollWeek,
} from "./calculations";
import { MAX_GROSS_SHIFT_MINUTES } from "./constants";

const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

const optionalText = (max = 1_000) =>
  z.string().trim().max(max, `Use ${max} characters or fewer.`).optional().or(z.literal(""));

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM time.");
const cuid = z.string().trim().min(1, "Select a valid record.").max(100);

export const allocationInputSchema = z.object({
  sequence: z.coerce.number().int().min(1),
  workCodeId: cuid,
  workOrderId: z.string().trim().max(100).optional().or(z.literal("")),
  allocatedMinutes: z.coerce.number().int().positive("Allocated minutes must be positive."),
  supportPersonIds: z.array(cuid).default([]),
  notes: optionalText(),
});

export const dailyTimeEntryInputSchema = z
  .object({
    workDate: dateOnly,
    clockIn: clockTime,
    clockOut: clockTime,
    unpaidBreakMinutes: z.coerce.number().int().min(0, "Break minutes cannot be negative."),
    primaryEquipmentId: z.string().trim().max(100),
    workScheduleDailyAssignmentId: z.string().trim().max(100).optional().or(z.literal("")),
    notes: optionalText(),
    allocations: z.array(allocationInputSchema).max(20, "Use 20 allocations or fewer per day."),
  })
  .superRefine((entry, context) => {
    const grossMinutes = calculateGrossMinutes(entry.clockIn, entry.clockOut);
    if (grossMinutes <= 0 || grossMinutes > MAX_GROSS_SHIFT_MINUTES) {
      context.addIssue({
        code: "custom",
        path: ["clockOut"],
        message: "Gross shift duration must be greater than zero and no more than 24 hours.",
      });
    }
    if (entry.unpaidBreakMinutes >= grossMinutes) {
      context.addIssue({
        code: "custom",
        path: ["unpaidBreakMinutes"],
        message: "Break minutes must be less than the gross shift duration.",
      });
    }
    if (calculateWorkedMinutes(entry.clockIn, entry.clockOut, entry.unpaidBreakMinutes) <= 0) {
      context.addIssue({
        code: "custom",
        path: ["unpaidBreakMinutes"],
        message: "Worked minutes must be greater than zero.",
      });
    }
    const sequences = entry.allocations.map((allocation) => allocation.sequence);
    if (new Set(sequences).size !== sequences.length) {
      context.addIssue({
        code: "custom",
        path: ["allocations"],
        message: "Allocation sequence values must be unique for the day.",
      });
    }
    for (const [index, allocation] of entry.allocations.entries()) {
      if (new Set(allocation.supportPersonIds).size !== allocation.supportPersonIds.length) {
        context.addIssue({
          code: "custom",
          path: ["allocations", index, "supportPersonIds"],
          message: "A support person may appear only once per allocation.",
        });
      }
    }
  });

export const weeklyTimesheetInputSchema = z
  .object({
    payrollWeekStartDate: dateOnly,
    primaryEmployeeDisplayName: requiredText("Primary employee"),
    entries: z
      .array(dailyTimeEntryInputSchema)
      .min(1, "Add at least one Daily Time Entry before saving the payroll week.")
      .max(7, "A payroll week may contain seven daily entries."),
  })
  .superRefine((timesheet, context) => {
    const weekStart = parseDateOnly(timesheet.payrollWeekStartDate);
    if (startOfPayrollWeek(weekStart).getTime() !== weekStart.getTime()) {
      context.addIssue({ code: "custom", path: ["payrollWeekStartDate"], message: "Payroll week must start on Monday." });
    }
    const weekEnd = endOfPayrollWeek(weekStart);
    const dates = timesheet.entries.map((entry) => entry.workDate);
    if (new Set(dates).size !== dates.length) {
      context.addIssue({ code: "custom", path: ["entries"], message: "A payroll week cannot contain duplicate work dates." });
    }
    timesheet.entries.forEach((entry, index) => {
      const workDate = parseDateOnly(entry.workDate);
      if (workDate < weekStart || workDate > weekEnd) {
        context.addIssue({ code: "custom", path: ["entries", index, "workDate"], message: "Work date must belong to the selected payroll week." });
      }
    });
  });

export const workCodeSchema = z.object({
  code: requiredText("Work code", 60),
  description: requiredText("Description", 300),
  category: optionalText(100),
  equipmentId: z.string().trim().max(100).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const workOrderSchema = z.object({
  workOrderNumber: requiredText("Work order number", 80),
  description: requiredText("Description", 300),
  equipmentId: z.string().trim().max(100).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const supportPersonSchema = z.object({
  displayName: requiredText("Display name"),
  tradeOrRole: requiredText("Trade or role"),
  company: optionalText(200),
  active: z.boolean().default(true),
  notes: optionalText(),
});

export function validateCompletion(entries: Array<{
  workedMinutes: number;
  allocations: Array<{ allocatedMinutes: number }>;
}>) {
  const issues: string[] = [];
  if (entries.length === 0) issues.push("Add at least one Daily Time Entry before completion.");
  entries.forEach((entry, index) => {
    if (entry.allocations.length === 0) issues.push(`Entry ${index + 1} needs at least one Work Allocation.`);
    const total = entry.allocations.reduce((sum, allocation) => sum + allocation.allocatedMinutes, 0);
    if (total !== entry.workedMinutes) issues.push(`Entry ${index + 1} allocations must equal worked minutes.`);
  });
  return issues;
}

export {
  normalizeIdentityKey,
  normalizeReferenceKey,
  normalizeSupportPersonKey,
};
