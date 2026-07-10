export const workAuthorizationStatusValues = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "ARCHIVED",
] as const;

export const workAuthorizationWorkTypeValues = [
  "MAINTENANCE",
  "ELECTRICAL",
  "MECHANICAL",
  "PREVENTIVE_MAINTENANCE",
  "BREAKDOWN",
  "HOT_WORK",
  "WORKING_AT_HEIGHTS",
  "LOCKOUT_TAGOUT",
  "OTHER",
] as const;

export const workAuthorizationStatusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "ARCHIVED", label: "Archived" },
] as const satisfies ReadonlyArray<{
  value: (typeof workAuthorizationStatusValues)[number];
  label: string;
}>;

export const workAuthorizationWorkTypeOptions = [
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "MECHANICAL", label: "Mechanical" },
  { value: "PREVENTIVE_MAINTENANCE", label: "Preventive maintenance" },
  { value: "BREAKDOWN", label: "Breakdown" },
  { value: "HOT_WORK", label: "Hot work" },
  { value: "WORKING_AT_HEIGHTS", label: "Working at heights" },
  { value: "LOCKOUT_TAGOUT", label: "Lockout / tagout" },
  { value: "OTHER", label: "Other" },
] as const satisfies ReadonlyArray<{
  value: (typeof workAuthorizationWorkTypeValues)[number];
  label: string;
}>;

export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  return options.find((option) => option.value === value)?.label ?? "Not set";
}
