export const shiftReportStatusValues = ["DRAFT", "COMPLETED", "ARCHIVED"] as const;

export const shiftValues = ["DAY", "NIGHT", "SWING", "OTHER", "UNKNOWN"] as const;

export const shiftReportStatusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ARCHIVED", label: "Archived" },
] as const satisfies ReadonlyArray<{
  value: (typeof shiftReportStatusValues)[number];
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
