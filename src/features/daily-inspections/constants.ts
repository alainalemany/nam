export const dailyInspectionConditionValues = [
  "SATISFACTORY",
  "NEEDS_ATTENTION",
  "UNSAFE",
  "NOT_APPLICABLE",
] as const;

export const dailyInspectionStatusValues = [
  "COMPLETED",
  "FOLLOW_UP_NEEDED",
  "ARCHIVED",
] as const;

export const shiftValues = ["DAY", "NIGHT", "SWING", "OTHER", "UNKNOWN"] as const;

export const dailyInspectionConditionOptions = [
  { value: "SATISFACTORY", label: "Satisfactory" },
  { value: "NEEDS_ATTENTION", label: "Needs attention" },
  { value: "UNSAFE", label: "Unsafe" },
  { value: "NOT_APPLICABLE", label: "Not applicable" },
] as const satisfies ReadonlyArray<{
  value: (typeof dailyInspectionConditionValues)[number];
  label: string;
}>;

export const dailyInspectionStatusOptions = [
  { value: "COMPLETED", label: "Completed" },
  { value: "FOLLOW_UP_NEEDED", label: "Follow-up needed" },
  { value: "ARCHIVED", label: "Archived" },
] as const satisfies ReadonlyArray<{
  value: (typeof dailyInspectionStatusValues)[number];
  label: string;
}>;

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

export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  return options.find((option) => option.value === value)?.label ?? "Not set";
}
