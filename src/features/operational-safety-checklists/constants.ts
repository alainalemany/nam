export const safetyChecklistShiftValues = [
  "DAY",
  "NIGHT",
  "SWING",
  "OTHER",
  "UNKNOWN",
] as const;

export const safetyChecklistShiftOptions = [
  { value: "DAY", label: "Day" },
  { value: "NIGHT", label: "Night" },
  { value: "SWING", label: "Swing" },
  { value: "OTHER", label: "Other" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

export const safetyChecklistTemplateLabels = {
  DRAGLINE_INSPECTION: "Dragline Inspection",
  MOBILE_INSPECTION: "Mobile Inspection",
} as const;

export const safetyChecklistResponseLabels = {
  OK: "OK",
  NEEDS_REPAIR: "Needs Repair",
  PREVIOUSLY_NOTED: "Previously Noted",
  NOT_APPLICABLE: "N/A",
  YES: "Yes",
  NO: "No",
  PRESENT: "Present",
  NOT_PRESENT: "Not Present",
} as const;

export function safetyChecklistOptionLabel(
  options: readonly { value: string; label: string }[],
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}
