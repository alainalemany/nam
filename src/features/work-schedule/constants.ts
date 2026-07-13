export const weeklyScheduleStatusValues = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

export const dailyAssignmentStatusValues = [
  "SCHEDULED",
  "NON_WORKING",
  "UNKNOWN",
  "CANCELLED",
] as const;

export const assignmentCrewPhaseValues = ["PLANNED", "ACTUAL"] as const;
export const assignmentCrewRoleValues = ["PRIMARY_EMPLOYEE", "PARTNER"] as const;

export const shiftValues = ["DAY", "NIGHT", "SWING", "OTHER", "UNKNOWN"] as const;

export type WeeklyScheduleStatusValue = (typeof weeklyScheduleStatusValues)[number];
export type DailyAssignmentStatusValue = (typeof dailyAssignmentStatusValues)[number];
export type AssignmentCrewPhaseValue = (typeof assignmentCrewPhaseValues)[number];
export type AssignmentCrewRoleValue = (typeof assignmentCrewRoleValues)[number];
export type ShiftValue = (typeof shiftValues)[number];

export const weeklyScheduleStatusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

export const dailyAssignmentStatusOptions = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "NON_WORKING", label: "Non-working" },
  { value: "UNKNOWN", label: "Unknown" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export const shiftOptions = [
  { value: "DAY", label: "Day" },
  { value: "NIGHT", label: "Night" },
  { value: "SWING", label: "Swing" },
  { value: "OTHER", label: "Other" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

export const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function optionLabel<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}
