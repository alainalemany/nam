import type {
  EquipmentCategory,
  OperationalSafetyChecklistMeterKind,
} from "@prisma/client";

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

export const safetyChecklistMeterKindValues = ["HOURS", "MILES"] as const;

export const safetyChecklistMeterKindOptions = [
  { value: "HOURS", label: "Hours" },
  { value: "MILES", label: "Miles" },
] as const;

export function safetyChecklistMeterKindSuggestion(
  category: EquipmentCategory,
): OperationalSafetyChecklistMeterKind | null {
  if (category === "DRAGLINE") return "HOURS";
  if (category === "WORK_TRUCK") return "MILES";
  return null;
}

export function safetyChecklistMeterMismatchMessage(
  category: EquipmentCategory,
  meterKind: OperationalSafetyChecklistMeterKind,
) {
  if (category === "DRAGLINE" && meterKind === "MILES") {
    return "Draglines normally use Hours. Confirm that Miles is correct for this inspection.";
  }
  if (category === "WORK_TRUCK" && meterKind === "HOURS") {
    return "Work trucks normally use Miles. Confirm that Hours is correct for this inspection.";
  }
  return null;
}

export function safetyChecklistOptionLabel(
  options: readonly { value: string; label: string }[],
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}
