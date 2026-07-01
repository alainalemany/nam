export const equipmentCategoryOptions = [
  { value: "DRAGLINE", label: "Dragline" },
  { value: "TRACTOR", label: "Tractor" },
  { value: "FORKLIFT", label: "Forklift" },
  { value: "WORK_TRUCK", label: "Work truck" },
  { value: "CABLE_SYSTEM", label: "Cable system" },
  { value: "CABLE_POLE", label: "Cable pole" },
  { value: "CABLE_HANDLING_TOOL", label: "Cable handling tool" },
  { value: "SUPPORT_TOOL", label: "Support tool" },
  { value: "OTHER", label: "Other" },
] as const;

export const equipmentPowerTypeOptions = [
  { value: "ELECTRIC", label: "Electric" },
  { value: "DIESEL", label: "Diesel" },
  { value: "GASOLINE", label: "Gasoline" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "OTHER", label: "Other" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

export const equipmentInstrumentationTypeOptions = [
  { value: "DIGITAL_ALARM_SCREEN", label: "Digital alarm screen" },
  { value: "SENSOR_DISPLAY", label: "Sensor display" },
  { value: "PHYSICAL_GAUGES", label: "Physical gauges" },
  { value: "OPERATOR_OBSERVED", label: "Operator observed" },
  { value: "MIXED", label: "Mixed" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

export const recordStatusOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  return options.find((option) => option.value === value)?.label ?? "Not set";
}
