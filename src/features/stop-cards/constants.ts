export const stopCardCategoryValues = [
  "HAZARD_OBSERVATION",
  "UNSAFE_CONDITION",
  "UNSAFE_ACT",
  "NEAR_MISS",
  "POSITIVE_OBSERVATION",
  "CORRECTIVE_ACTION",
  "GENERAL_SAFETY",
] as const;

export const stopCardSeverityValues = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const stopCardStatusValues = ["OPEN", "IN_PROGRESS", "CLOSED", "ARCHIVED"] as const;

export const stopCardCategoryOptions = [
  { value: "HAZARD_OBSERVATION", label: "Hazard observation" },
  { value: "UNSAFE_CONDITION", label: "Unsafe condition" },
  { value: "UNSAFE_ACT", label: "Unsafe act" },
  { value: "NEAR_MISS", label: "Near miss" },
  { value: "POSITIVE_OBSERVATION", label: "Positive observation" },
  { value: "CORRECTIVE_ACTION", label: "Corrective action" },
  { value: "GENERAL_SAFETY", label: "General safety" },
] as const satisfies ReadonlyArray<{
  value: (typeof stopCardCategoryValues)[number];
  label: string;
}>;

export const stopCardSeverityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const satisfies ReadonlyArray<{
  value: (typeof stopCardSeverityValues)[number];
  label: string;
}>;

export const stopCardStatusOptions = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "CLOSED", label: "Closed" },
  { value: "ARCHIVED", label: "Archived" },
] as const satisfies ReadonlyArray<{
  value: (typeof stopCardStatusValues)[number];
  label: string;
}>;

export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  return options.find((option) => option.value === value)?.label ?? "Not set";
}
