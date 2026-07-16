import { describe, expect, it } from "vitest";

import {
  isSafetyChecklistDateOnly,
  localSafetyChecklistDateValue,
} from "@/features/operational-safety-checklists/date";
import {
  getSafetyChecklistTemplate,
  safetyChecklistTemplates,
} from "@/features/operational-safety-checklists/templates";
import { safetyChecklistSubmissionSchema } from "@/features/operational-safety-checklists/validation";

const draglineCatalog = [
  ["bench_condition", "Bench Condition", 6, null, "CONDITION_FOUR"],
  ["lights_working", "Lights Working", 7, null, "CONDITION_FOUR"],
  ["flammables_safely_stored", "Flammables Safely Stored", 8, null, "CONDITION_FOUR"],
  ["tools_stored_working", "Tools Stored, Working", 9, null, "CONDITION_FOUR"],
  ["electrical_cords_current", "Electrical Cords Current", 10, null, "CONDITION_FOUR"],
  ["fire_extinguishers_current", "Fire Extinguishers Current", 11, null, "CONDITION_FOUR"],
  ["guarding_sufficient", "Guarding Sufficient", 12, null, "CONDITION_FOUR"],
  ["walkways_clean_clear", "Walkways Clean & Clear", 13, null, "CONDITION_FOUR"],
  ["handrails_steps_usable", "Handrails & Steps Usable", 14, null, "CONDITION_FOUR"],
  ["trash_removed_daily", "Trash Removed Daily", 15, null, "CONDITION_FOUR"],
  ["bench_grinder_adjusted", "Bench Grinder Adjusted", 16, null, "CONDITION_FOUR"],
  ["all_gauges_functional", "All Gauges Functional", 17, null, "CONDITION_FOUR"],
  ["horn_functional", "Horn Functional", 18, null, "CONDITION_FOUR"],
  ["radios_functional", "Radios Functional", 19, null, "CONDITION_FOUR"],
  ["cab_is_clean", "Cab Is Clean", 20, null, "CONDITION_FOUR"],
  ["cab_glass_wipers", "Cab Glass & Wipers", 21, null, "CONDITION_FOUR"],
  ["brakes_working_properly", "Brakes Working Properly", 22, null, "CONDITION_FOUR"],
  ["hydraulic_level", "Hydraulic Level", 23, null, "CONDITION_FOUR"],
  ["oil_level", "Oil Level", 24, null, "CONDITION_FOUR"],
  ["coolant_level", "Coolant Level", 25, null, "CONDITION_FOUR"],
  ["spill_containment", "Spill Containment", 26, null, "CONDITION_FOUR"],
  ["limits", "Limits", 27, null, "CONDITION_FOUR"],
  ["spare_air_tanks_present_charged", "Spare Air Tank(s) Present And Charged", 28, null, "CONDITION_FOUR"],
  ["two_life_jackets_in_cabin", "Two Life Jackets In Cabin", 29, null, "YES_NO"],
] as const;

const mobileCatalog = [
  ["rental_status", "Rental", 3, null, "YES_NO"],
  ["seat_belt", "Seat Belt", 6, "*", "CONDITION_THREE"],
  ["backup_up_alarm", "Backup-Up Alarm", 7, "*", "CONDITION_THREE"],
  ["park_service_brake", "Park & Service Brake", 8, "*", "CONDITION_THREE"],
  ["fire_extinguisher_tag_seal", "Fire Extinguisher (Tag & Seal)", 9, "*", "CONDITION_THREE"],
  ["horn", "Horn", 10, "*", "CONDITION_THREE"],
  ["steering", "Steering", 11, "**", "CONDITION_FOUR"],
  ["two_way_radio", "Two-Way Radio", 12, "**", "CONDITION_FOUR"],
  ["oil_grease_accumulation", "Oil & Grease Accumulation", 13, "**", "CONDITION_FOUR"],
  ["working_lights", "Working Lights", 14, "**", "CONDITION_FOUR"],
  ["tail_lights", "Tail Lights", 15, "**", "CONDITION_FOUR"],
  ["fire_suppression_system", "Fire Supression System", 16, "**", "CONDITION_FOUR"],
  ["hydraulic_level", "Hydraulic Level", 17, null, "CONDITION_FOUR"],
  ["oil_level", "Oil Level", 18, null, "CONDITION_FOUR"],
  ["coolant_level", "Coolant Level", 19, null, "CONDITION_FOUR"],
  ["oil_water_leaks", "Oil & Water Leaks", 20, null, "CONDITION_FOUR"],
  ["tires_rims_lugs_or_tracks", "Tires, Rims, & Lugs or Tracks", 21, null, "CONDITION_FOUR"],
  ["pins_connections", "Pins & Connections", 22, null, "CONDITION_FOUR"],
  ["cab_condition", "Cab Condition", 23, null, "CONDITION_FOUR"],
  ["glass_wipers", "Glass & Wipers", 24, null, "CONDITION_FOUR"],
  ["instrument_panel", "Instrument Panel", 25, null, "CONDITION_FOUR"],
  ["area_around_equipment", "Area Around Equipment", 26, null, "CONDITION_FOUR"],
  ["fuel_card", "Fuel Card", 27, null, "PRESENCE_THREE"],
] as const;

function catalogFields(templateKey: "DRAGLINE_INSPECTION" | "MOBILE_INSPECTION") {
  return getSafetyChecklistTemplate(templateKey, 1)!.fields.map((field) => [
    field.key,
    field.label,
    field.order,
    field.marker,
    field.responseSet,
  ]);
}

function validInput(templateKey: "DRAGLINE_INSPECTION" | "MOBILE_INSPECTION") {
  const template = getSafetyChecklistTemplate(templateKey, 1)!;
  return {
    inspectionDate: "2026-07-15",
    shift: "DAY",
    equipmentId: "equipment-1",
    templateKey,
    templateVersion: 1,
    startingMeter: "12345",
    operatorDisplayName: "Alex Operator",
    supervisorDisplayName: "Sam Supervisor",
    problemDescription: "",
    responses: template.fields.map((field) => ({
      itemKey: field.key,
      responseCode:
        field.responseSet === "YES_NO"
          ? "YES"
          : field.responseSet === "PRESENCE_THREE"
            ? "PRESENT"
            : "OK",
    })),
  };
}

describe("Operational Safety Checklist templates", () => {
  it("matches every canonical Dragline item", () => {
    expect(catalogFields("DRAGLINE_INSPECTION")).toEqual(draglineCatalog);
  });

  it("matches Rental metadata and every canonical Mobile item", () => {
    expect(catalogFields("MOBILE_INSPECTION")).toEqual(mobileCatalog);
  });

  it("preserves the canonical Dragline catalog and response semantics", () => {
    const template = getSafetyChecklistTemplate("DRAGLINE_INSPECTION", 1)!;
    expect(template.fields).toHaveLength(24);
    expect(template.fields[0]).toMatchObject({ key: "bench_condition", label: "Bench Condition", order: 6 });
    expect(template.fields.at(-1)).toMatchObject({
      key: "two_life_jackets_in_cabin",
      label: "Two Life Jackets In Cabin",
      order: 29,
      responseSet: "YES_NO",
    });
  });

  it("preserves Mobile Rental metadata, source markers, source spelling, and Fuel Card", () => {
    const template = getSafetyChecklistTemplate("MOBILE_INSPECTION", 1)!;
    expect(template.fields).toHaveLength(23);
    expect(template.fields[0]).toMatchObject({ key: "rental_status", order: 3, section: "METADATA" });
    expect(template.fields.find((field) => field.key === "seat_belt")?.marker).toBe("*");
    expect(template.fields.find((field) => field.key === "steering")?.marker).toBe("**");
    expect(template.fields.find((field) => field.key === "fire_suppression_system")?.label).toBe("Fire Supression System");
    expect(template.fields.at(-1)).toMatchObject({ key: "fuel_card", responseSet: "PRESENCE_THREE" });
  });

  it("maps only approved Equipment categories", () => {
    expect(safetyChecklistTemplates[0].compatibleCategories).toEqual(["DRAGLINE"]);
    expect(safetyChecklistTemplates[1].compatibleCategories).toEqual([
      "WORK_TRUCK",
      "TRACTOR",
      "FORKLIFT",
    ]);
  });
});

describe("Operational Safety Checklist date-only behavior", () => {
  it("uses the local calendar date during an evening shift", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const evening = new Date("2026-07-16T03:30:00.000Z");
      expect(evening.toISOString().slice(0, 10)).toBe("2026-07-16");
      expect(localSafetyChecklistDateValue(evening)).toBe("2026-07-15");
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it("uses the new local date immediately after local midnight", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      expect(localSafetyChecklistDateValue(new Date("2026-07-16T04:05:00.000Z"))).toBe(
        "2026-07-16",
      );
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it.each([
    ["2026-07-15", true],
    ["2026-02-29", false],
    ["2028-02-29", true],
    ["2026-02-31", false],
    ["07/15/2026", false],
  ])("validates date-only value %s", (value, expected) => {
    expect(isSafetyChecklistDateOnly(value)).toBe(expected);
  });
});

describe("Operational Safety Checklist validation", () => {
  it.each(["0", "999999"])("accepts integer Hour Meter boundary %s", (startingMeter) => {
    expect(safetyChecklistSubmissionSchema.safeParse({
      ...validInput("DRAGLINE_INSPECTION"),
      startingMeter,
    }).success).toBe(true);
  });

  it.each(["-1", "1.5", "1000000", ""])("rejects invalid Hour Meter value %s", (startingMeter) => {
    expect(safetyChecklistSubmissionSchema.safeParse({
      ...validInput("DRAGLINE_INSPECTION"),
      startingMeter,
    }).success).toBe(false);
  });

  it("requires one response for every canonical item", () => {
    const input = validInput("DRAGLINE_INSPECTION");
    input.responses.pop();
    const result = safetyChecklistSubmissionSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["responses", "two_life_jackets_in_cabin"] }),
      );
    }
  });

  it("rejects duplicate and template-incompatible item responses", () => {
    const input = validInput("MOBILE_INSPECTION");
    input.responses.push({ ...input.responses[0] });
    input.responses.push({ itemKey: "invented_item", responseCode: "OK" });
    expect(safetyChecklistSubmissionSchema.safeParse(input).success).toBe(false);
  });

  it("enforces each item's approved response set", () => {
    const input = validInput("DRAGLINE_INSPECTION");
    input.responses.at(-1)!.responseCode = "OK";
    expect(safetyChecklistSubmissionSchema.safeParse(input).success).toBe(false);
  });

  it("requires overall problem context for Needs Repair", () => {
    const input = validInput("DRAGLINE_INSPECTION");
    input.responses[0].responseCode = "NEEDS_REPAIR";
    const result = safetyChecklistSubmissionSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["problemDescription"] }),
      );
    }
  });

  it("allows Previously Noted without repeated problem text", () => {
    const input = validInput("DRAGLINE_INSPECTION");
    input.responses[0].responseCode = "PREVIOUSLY_NOTED";
    expect(safetyChecklistSubmissionSchema.safeParse(input).success).toBe(true);
  });

  it("accepts Needs Repair with a Problem Description", () => {
    const input = validInput("MOBILE_INSPECTION");
    input.responses[2].responseCode = "NEEDS_REPAIR";
    input.problemDescription = "Seat belt latch does not hold.";
    expect(safetyChecklistSubmissionSchema.safeParse(input).success).toBe(true);
  });
});
