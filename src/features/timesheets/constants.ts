import type { TimesheetStatus } from "@prisma/client";

export const PAYROLL_WEEK_DAYS = 7;
export const WEEKLY_REGULAR_MINUTES = 2_400;
export const MAX_GROSS_SHIFT_MINUTES = 24 * 60;

export const timesheetStatusLabels = {
  DRAFT: "Draft",
  COMPLETED: "Completed",
} as const satisfies Record<TimesheetStatus, string>;

export const dayLabels = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
