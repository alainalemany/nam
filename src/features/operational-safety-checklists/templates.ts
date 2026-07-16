import type { EquipmentCategory } from "@prisma/client";

export const safetyChecklistTemplateKeys = [
  "DRAGLINE_INSPECTION",
  "MOBILE_INSPECTION",
] as const;

export const safetyChecklistResponseSetValues = [
  "CONDITION_FOUR",
  "CONDITION_THREE",
  "YES_NO",
  "PRESENCE_THREE",
] as const;

export const safetyChecklistResponseCodeValues = [
  "OK",
  "NEEDS_REPAIR",
  "PREVIOUSLY_NOTED",
  "NOT_APPLICABLE",
  "YES",
  "NO",
  "PRESENT",
  "NOT_PRESENT",
] as const;

export type SafetyChecklistTemplateKey = (typeof safetyChecklistTemplateKeys)[number];
export type SafetyChecklistResponseSet =
  (typeof safetyChecklistResponseSetValues)[number];
export type SafetyChecklistResponseCode =
  (typeof safetyChecklistResponseCodeValues)[number];
export type SafetyChecklistItemSection = "METADATA" | "INSPECTION";

export type SafetyChecklistTemplateField = {
  key: string;
  label: string;
  order: number;
  section: SafetyChecklistItemSection;
  marker: string | null;
  responseSet: SafetyChecklistResponseSet;
};

export type SafetyChecklistTemplateDefinition = {
  key: SafetyChecklistTemplateKey;
  version: number;
  name: string;
  compatibleCategories: readonly EquipmentCategory[];
  fields: readonly SafetyChecklistTemplateField[];
};

export const responseOptionsBySet: Record<
  SafetyChecklistResponseSet,
  readonly { value: SafetyChecklistResponseCode; label: string }[]
> = {
  CONDITION_FOUR: [
    { value: "OK", label: "OK" },
    { value: "NEEDS_REPAIR", label: "Needs Repair" },
    { value: "PREVIOUSLY_NOTED", label: "Previously Noted" },
    { value: "NOT_APPLICABLE", label: "N/A" },
  ],
  CONDITION_THREE: [
    { value: "OK", label: "OK" },
    { value: "NEEDS_REPAIR", label: "Needs Repair" },
    { value: "NOT_APPLICABLE", label: "N/A" },
  ],
  YES_NO: [
    { value: "YES", label: "Yes" },
    { value: "NO", label: "No" },
  ],
  PRESENCE_THREE: [
    { value: "PRESENT", label: "Present" },
    { value: "NOT_PRESENT", label: "Not Present" },
    { value: "NOT_APPLICABLE", label: "N/A" },
  ],
};

const draglineFields: readonly SafetyChecklistTemplateField[] = [
  { key: "bench_condition", label: "Bench Condition", order: 6, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "lights_working", label: "Lights Working", order: 7, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "flammables_safely_stored", label: "Flammables Safely Stored", order: 8, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "tools_stored_working", label: "Tools Stored, Working", order: 9, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "electrical_cords_current", label: "Electrical Cords Current", order: 10, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "fire_extinguishers_current", label: "Fire Extinguishers Current", order: 11, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "guarding_sufficient", label: "Guarding Sufficient", order: 12, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "walkways_clean_clear", label: "Walkways Clean & Clear", order: 13, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "handrails_steps_usable", label: "Handrails & Steps Usable", order: 14, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "trash_removed_daily", label: "Trash Removed Daily", order: 15, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "bench_grinder_adjusted", label: "Bench Grinder Adjusted", order: 16, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "all_gauges_functional", label: "All Gauges Functional", order: 17, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "horn_functional", label: "Horn Functional", order: 18, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "radios_functional", label: "Radios Functional", order: 19, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "cab_is_clean", label: "Cab Is Clean", order: 20, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "cab_glass_wipers", label: "Cab Glass & Wipers", order: 21, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "brakes_working_properly", label: "Brakes Working Properly", order: 22, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "hydraulic_level", label: "Hydraulic Level", order: 23, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "oil_level", label: "Oil Level", order: 24, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "coolant_level", label: "Coolant Level", order: 25, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "spill_containment", label: "Spill Containment", order: 26, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "limits", label: "Limits", order: 27, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "spare_air_tanks_present_charged", label: "Spare Air Tank(s) Present And Charged", order: 28, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "two_life_jackets_in_cabin", label: "Two Life Jackets In Cabin", order: 29, section: "INSPECTION", marker: null, responseSet: "YES_NO" },
];

const mobileFields: readonly SafetyChecklistTemplateField[] = [
  { key: "rental_status", label: "Rental", order: 3, section: "METADATA", marker: null, responseSet: "YES_NO" },
  { key: "seat_belt", label: "Seat Belt", order: 6, section: "INSPECTION", marker: "*", responseSet: "CONDITION_THREE" },
  { key: "backup_up_alarm", label: "Backup-Up Alarm", order: 7, section: "INSPECTION", marker: "*", responseSet: "CONDITION_THREE" },
  { key: "park_service_brake", label: "Park & Service Brake", order: 8, section: "INSPECTION", marker: "*", responseSet: "CONDITION_THREE" },
  { key: "fire_extinguisher_tag_seal", label: "Fire Extinguisher (Tag & Seal)", order: 9, section: "INSPECTION", marker: "*", responseSet: "CONDITION_THREE" },
  { key: "horn", label: "Horn", order: 10, section: "INSPECTION", marker: "*", responseSet: "CONDITION_THREE" },
  { key: "steering", label: "Steering", order: 11, section: "INSPECTION", marker: "**", responseSet: "CONDITION_FOUR" },
  { key: "two_way_radio", label: "Two-Way Radio", order: 12, section: "INSPECTION", marker: "**", responseSet: "CONDITION_FOUR" },
  { key: "oil_grease_accumulation", label: "Oil & Grease Accumulation", order: 13, section: "INSPECTION", marker: "**", responseSet: "CONDITION_FOUR" },
  { key: "working_lights", label: "Working Lights", order: 14, section: "INSPECTION", marker: "**", responseSet: "CONDITION_FOUR" },
  { key: "tail_lights", label: "Tail Lights", order: 15, section: "INSPECTION", marker: "**", responseSet: "CONDITION_FOUR" },
  { key: "fire_suppression_system", label: "Fire Supression System", order: 16, section: "INSPECTION", marker: "**", responseSet: "CONDITION_FOUR" },
  { key: "hydraulic_level", label: "Hydraulic Level", order: 17, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "oil_level", label: "Oil Level", order: 18, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "coolant_level", label: "Coolant Level", order: 19, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "oil_water_leaks", label: "Oil & Water Leaks", order: 20, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "tires_rims_lugs_or_tracks", label: "Tires, Rims, & Lugs or Tracks", order: 21, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "pins_connections", label: "Pins & Connections", order: 22, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "cab_condition", label: "Cab Condition", order: 23, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "glass_wipers", label: "Glass & Wipers", order: 24, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "instrument_panel", label: "Instrument Panel", order: 25, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "area_around_equipment", label: "Area Around Equipment", order: 26, section: "INSPECTION", marker: null, responseSet: "CONDITION_FOUR" },
  { key: "fuel_card", label: "Fuel Card", order: 27, section: "INSPECTION", marker: null, responseSet: "PRESENCE_THREE" },
];

export const safetyChecklistTemplates: readonly SafetyChecklistTemplateDefinition[] = [
  {
    key: "DRAGLINE_INSPECTION",
    version: 1,
    name: "Dragline Inspection",
    compatibleCategories: ["DRAGLINE"],
    fields: draglineFields,
  },
  {
    key: "MOBILE_INSPECTION",
    version: 1,
    name: "Mobile Inspection",
    compatibleCategories: ["WORK_TRUCK", "TRACTOR", "FORKLIFT"],
    fields: mobileFields,
  },
];

export function getSafetyChecklistTemplate(
  key: string,
  version: number,
): SafetyChecklistTemplateDefinition | undefined {
  return safetyChecklistTemplates.find(
    (template) => template.key === key && template.version === version,
  );
}

export function resolveSafetyChecklistTemplate(
  category: EquipmentCategory,
): SafetyChecklistTemplateDefinition | undefined {
  return safetyChecklistTemplates
    .filter((template) => template.compatibleCategories.includes(category))
    .reduce<SafetyChecklistTemplateDefinition | undefined>(
      (latest, template) =>
        !latest || template.version > latest.version ? template : latest,
      undefined,
    );
}

export function getResponseOption(
  responseSet: SafetyChecklistResponseSet,
  responseCode: string,
) {
  return responseOptionsBySet[responseSet].find(
    (option) => option.value === responseCode,
  );
}
