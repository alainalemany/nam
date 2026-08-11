export const cityStateOptions = [
  { value: "AL", label: "AL" },
  { value: "AK", label: "AK" },
  { value: "AZ", label: "AZ" },
  { value: "AR", label: "AR" },
  { value: "CA", label: "CA" },
  { value: "CO", label: "CO" },
  { value: "CT", label: "CT" },
  { value: "DE", label: "DE" },
  { value: "DC", label: "DC" },
  { value: "FL", label: "FL" },
  { value: "GA", label: "GA" },
  { value: "HI", label: "HI" },
  { value: "ID", label: "ID" },
  { value: "IL", label: "IL" },
  { value: "IN", label: "IN" },
  { value: "IA", label: "IA" },
  { value: "KS", label: "KS" },
  { value: "KY", label: "KY" },
  { value: "LA", label: "LA" },
  { value: "ME", label: "ME" },
  { value: "MD", label: "MD" },
  { value: "MA", label: "MA" },
  { value: "MI", label: "MI" },
  { value: "MN", label: "MN" },
  { value: "MS", label: "MS" },
  { value: "MO", label: "MO" },
  { value: "MT", label: "MT" },
  { value: "NE", label: "NE" },
  { value: "NV", label: "NV" },
  { value: "NH", label: "NH" },
  { value: "NJ", label: "NJ" },
  { value: "NM", label: "NM" },
  { value: "NY", label: "NY" },
  { value: "NC", label: "NC" },
  { value: "ND", label: "ND" },
  { value: "OH", label: "OH" },
  { value: "OK", label: "OK" },
  { value: "OR", label: "OR" },
  { value: "PA", label: "PA" },
  { value: "RI", label: "RI" },
  { value: "SC", label: "SC" },
  { value: "SD", label: "SD" },
  { value: "TN", label: "TN" },
  { value: "TX", label: "TX" },
  { value: "UT", label: "UT" },
  { value: "VT", label: "VT" },
  { value: "VA", label: "VA" },
  { value: "WA", label: "WA" },
  { value: "WV", label: "WV" },
  { value: "WI", label: "WI" },
  { value: "WY", label: "WY" },
] as const;

export const mineTypeOptions = [
  { value: "Quarry", label: "Quarry" },
  { value: "Open-Pit Mine", label: "Open-Pit Mine" },
  { value: "Strip Mine", label: "Strip Mine" },
  { value: "Underground Mine", label: "Underground Mine" },
  { value: "Placer Mine", label: "Placer Mine" },
  { value: "Dredging Operation", label: "Dredging Operation" },
  { value: "In-Situ/Solution Mine", label: "In-Situ/Solution Mine" },
  { value: "Other", label: "Other" },
] as const;

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
