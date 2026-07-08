export const shiftValues = ["DAY", "NIGHT", "SWING", "OTHER", "UNKNOWN"] as const;

export type ShiftValue = (typeof shiftValues)[number];

export const shiftOptions = [
  { value: "DAY", label: "Day" },
  { value: "NIGHT", label: "Night" },
  { value: "SWING", label: "Swing" },
  { value: "OTHER", label: "Other" },
  { value: "UNKNOWN", label: "Unknown" },
] as const satisfies ReadonlyArray<{
  value: (typeof shiftValues)[number];
  label: string;
}>;

export const dailyLogActivityTypeValues = [
  "DRAGLINE_MOVE",
  "CUT",
  "GREASING",
  "SCHEDULED_PM",
  "EQUIPMENT_ALARM",
  "SENSOR_OBSERVATION",
  "EQUIPMENT_OBSERVATION",
  "WORK_ORDER",
  "WORK_AUTHORIZATION",
  "LOCKOUT_TAGOUT",
  "HOT_WORK",
  "WORKING_AT_HEIGHTS",
  "CONTRACTOR_ESCORT",
  "MAINTENANCE_OBSERVATION",
  "FUEL_SERVICE",
  "DELAY",
  "PRODUCTION_NOTE",
  "SAFETY_OBSERVATION",
  "GENERAL_NOTE",
] as const;

export type DailyLogActivityTypeValue = (typeof dailyLogActivityTypeValues)[number];

export const dailyLogActivityTypeOptions = [
  { value: "DRAGLINE_MOVE", label: "Dragline move" },
  { value: "CUT", label: "Cut" },
  { value: "GREASING", label: "Greasing" },
  { value: "SCHEDULED_PM", label: "Scheduled PM" },
  { value: "EQUIPMENT_ALARM", label: "Equipment alarm" },
  { value: "SENSOR_OBSERVATION", label: "Sensor observation" },
  { value: "EQUIPMENT_OBSERVATION", label: "Equipment observation" },
  { value: "WORK_ORDER", label: "Work order" },
  { value: "WORK_AUTHORIZATION", label: "Work authorization" },
  { value: "LOCKOUT_TAGOUT", label: "Lockout / tagout" },
  { value: "HOT_WORK", label: "Hot work" },
  { value: "WORKING_AT_HEIGHTS", label: "Working at heights" },
  { value: "CONTRACTOR_ESCORT", label: "Contractor escort" },
  { value: "MAINTENANCE_OBSERVATION", label: "Maintenance observation" },
  { value: "FUEL_SERVICE", label: "Fuel service" },
  { value: "DELAY", label: "Delay" },
  { value: "PRODUCTION_NOTE", label: "Production note" },
  { value: "SAFETY_OBSERVATION", label: "Safety observation" },
  { value: "GENERAL_NOTE", label: "General note" },
] as const satisfies ReadonlyArray<{
  value: (typeof dailyLogActivityTypeValues)[number];
  label: string;
}>;

export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  return options.find((option) => option.value === value)?.label ?? "Not set";
}
