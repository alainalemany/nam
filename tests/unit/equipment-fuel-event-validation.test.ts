import { describe, expect, it } from "vitest";

import { compatibleFuelTypes, isFuelTypeCompatible } from "@/features/equipment-fuel-events/constants";
import { isEquipmentFuelDateOnly, isLocalEventTime, localEquipmentFuelDateValue, localEquipmentFuelTimeValue } from "@/features/equipment-fuel-events/date";
import { buildEquipmentFuelWhere, parseEquipmentFuelFilters } from "@/features/equipment-fuel-events/filters";
import { deduplicateTankLabelSuggestions, equipmentFuelEventCorrectionSchema, equipmentFuelEventSubmissionSchema, equipmentFuelSubmittedValues, normalizeFuelReference } from "@/features/equipment-fuel-events/validation";

function validInput() {
  return {
    operationalWorkDate: "2026-07-15",
    eventTime: "23:45",
    equipmentId: "equipment-1",
    fuelType: "OFF_ROAD_DIESEL",
    gasStationId: "station-1",
    pricePerGallon: "3.457",
    meterType: "HOURS",
    meterReading: "1204.5",
    receiptReference: "R-100",
    notes: "Fuel hose was repositioned.",
    tankFills: [
      { sequence: 1, tankLabel: "Main Tank", gallons: "390" },
      { sequence: 2, tankLabel: "Walking Engine", gallons: "79" },
    ],
  };
}

describe("Equipment Fuel Event date and time semantics", () => {
  it.each([["2026-07-15", true], ["2028-02-29", true], ["2026-02-29", false], ["2026-02-31", false], ["07/15/2026", false]])("validates date-only value %s", (value, expected) => expect(isEquipmentFuelDateOnly(value)).toBe(expected));
  it.each([["00:00", true], ["23:59", true], ["24:00", false], ["7:30", false], ["12:60", false], ["", false]])("validates local minute value %s", (value, expected) => expect(isLocalEventTime(value)).toBe(expected));

  it("uses local calendar and wall-clock components without UTC extraction", () => {
    const prior = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const evening = new Date("2026-07-16T03:45:00.000Z");
      expect(evening.toISOString().slice(0, 10)).toBe("2026-07-16");
      expect(localEquipmentFuelDateValue(evening)).toBe("2026-07-15");
      expect(localEquipmentFuelTimeValue(evening)).toBe("23:45");
    } finally {
      if (prior === undefined) delete process.env.TZ; else process.env.TZ = prior;
    }
  });
});

describe("Equipment Fuel Event aggregate validation", () => {
  it("accepts ordered Decimal fills and derives normalized labels independently", () => {
    const parsed = equipmentFuelEventSubmissionSchema.parse(validInput());
    expect(parsed.tankFills.map((fill) => fill.gallons.toString())).toEqual(["390", "79"]);
    expect(normalizeFuelReference("  Walking   Engine ")).toBe("walking engine");
  });

  it("normalizes and deduplicates historical label suggestions without making them authoritative", () => {
    expect(deduplicateTankLabelSuggestions(["Main Tank", " main   tank ", "Walking Engine", ""])).toEqual(["Main Tank", "Walking Engine"]);
  });

  it.each(["0", "-1", "1.2345", "1000000", "abc", ""])("rejects invalid gallon value %s", (gallons) => {
    const input = validInput();
    input.tankFills[0].gallons = gallons;
    expect(equipmentFuelEventSubmissionSchema.safeParse(input).success).toBe(false);
  });

  it.each(["12", "12.5", "12.347"])("accepts precise gallon value %s", (gallons) => {
    const input = validInput();
    input.tankFills[0].gallons = gallons;
    const parsed = equipmentFuelEventSubmissionSchema.parse(input);
    expect(parsed.tankFills[0].gallons.toString()).toBe(gallons);
  });

  it("accepts gallon boundaries and ten fills", () => {
    const input = validInput();
    input.tankFills = Array.from({ length: 10 }, (_, index) => ({ sequence: index + 1, tankLabel: `Tank ${index + 1}`, gallons: "999999" }));
    expect(equipmentFuelEventSubmissionSchema.safeParse(input).success).toBe(true);
  });

  it("rejects more than ten fills and a total over the maximum", () => {
    const input = validInput();
    input.tankFills = Array.from({ length: 11 }, (_, index) => ({ sequence: index + 1, tankLabel: `Tank ${index + 1}`, gallons: "999999" }));
    expect(equipmentFuelEventSubmissionSchema.safeParse(input).success).toBe(false);
  });

  it("rejects missing, duplicate, or noncontiguous sequence", () => {
    const input = validInput();
    input.tankFills[1].sequence = 1;
    expect(equipmentFuelEventSubmissionSchema.safeParse(input).success).toBe(false);
    input.tankFills[1].sequence = 3;
    expect(equipmentFuelEventSubmissionSchema.safeParse(input).success).toBe(false);
  });

  it("rejects equivalent duplicate tank labels while preserving distinct manual labels", () => {
    const input = validInput();
    input.tankFills[1].tankLabel = " main   tank ";
    expect(equipmentFuelEventSubmissionSchema.safeParse(input).success).toBe(false);
    input.tankFills[1].tankLabel = "Auxiliary Tank";
    expect(equipmentFuelEventSubmissionSchema.safeParse(input).success).toBe(true);
  });

  it("enforces label and notes length guards", () => {
    expect(equipmentFuelEventSubmissionSchema.safeParse({ ...validInput(), notes: "x".repeat(2001) }).success).toBe(false);
    const input = validInput(); input.tankFills[0].tankLabel = "x".repeat(101);
    expect(equipmentFuelEventSubmissionSchema.safeParse(input).success).toBe(false);
  });

  it("requires station and price for new events but permits an untouched legacy correction", () => {
    const legacy = { ...validInput(), gasStationId: "", pricePerGallon: "", meterType: "", meterReading: "" };
    expect(equipmentFuelEventSubmissionSchema.safeParse(legacy).success).toBe(false);
    expect(equipmentFuelEventCorrectionSchema.safeParse(legacy).success).toBe(true);
  });

  it("validates price precision and meter cross-field combinations", () => {
    expect(equipmentFuelEventSubmissionSchema.safeParse({ ...validInput(), pricePerGallon: "3.4567" }).success).toBe(false);
    expect(equipmentFuelEventSubmissionSchema.safeParse({
      ...validInput(),
      pricePerGallon: "9999999.999",
      tankFills: [{ sequence: 1, tankLabel: "Main", gallons: "0.001" }],
    }).success).toBe(true);
    expect(equipmentFuelEventSubmissionSchema.safeParse({ ...validInput(), meterType: "HOURS", meterReading: "" }).success).toBe(false);
    expect(equipmentFuelEventSubmissionSchema.safeParse({ ...validInput(), meterType: "ODOMETER", meterReading: "0" }).success).toBe(true);
    expect(equipmentFuelEventSubmissionSchema.safeParse({ ...validInput(), meterType: "NOT_APPLICABLE", meterReading: "1" }).success).toBe(false);
    expect(equipmentFuelEventSubmissionSchema.safeParse({ ...validInput(), meterType: "NOT_APPLICABLE", meterReading: "" }).success).toBe(true);
    expect(equipmentFuelEventSubmissionSchema.safeParse({
      ...validInput(),
      pricePerGallon: "9999999.999",
      tankFills: [{ sequence: 1, tankLabel: "Main", gallons: "999999" }],
    }).success).toBe(false);
  });

  it("recovers raw submitted values, stable row IDs, and visible row order before transformations", () => {
    expect(equipmentFuelSubmittedValues({
      ...validInput(),
      notes: "  keep spacing  ",
      pricePerGallon: "3.45x",
      meterReading: "1204.x",
      tankFills: [
        { clientRowId: "row-b", sequence: 9, tankLabel: " Walking   Engine ", gallons: "079" },
        { clientRowId: "row-a", sequence: 4, tankLabel: "", gallons: "390x" },
      ],
    })).toEqual(expect.objectContaining({
      notes: "  keep spacing  ",
      gasStationId: "station-1",
      pricePerGallon: "3.45x",
      meterType: "HOURS",
      meterReading: "1204.x",
      receiptReference: "R-100",
      tankFills: [
        { clientRowId: "row-b", sequence: 1, tankLabel: " Walking   Engine ", gallons: "079" },
        { clientRowId: "row-a", sequence: 2, tankLabel: "", gallons: "390x" },
      ],
    }));
  });
});

describe("Equipment fuel compatibility", () => {
  it("rejects electric and enforces known diesel or gasoline context", () => {
    expect(compatibleFuelTypes("ELECTRIC")).toEqual([]);
    expect(isFuelTypeCompatible("DIESEL", "DIESEL")).toBe(true);
    expect(isFuelTypeCompatible("DIESEL", "OFF_ROAD_DIESEL")).toBe(true);
    expect(isFuelTypeCompatible("DIESEL", "GASOLINE")).toBe(false);
    expect(isFuelTypeCompatible("GASOLINE", "GASOLINE")).toBe(true);
    expect(isFuelTypeCompatible("GASOLINE", "DIESEL")).toBe(false);
  });

  it.each(["HYBRID", "OTHER", "UNKNOWN", null] as const)("allows explicit supported selection for %s context", (powerType) => {
    expect(compatibleFuelTypes(powerType)).toEqual(["DIESEL", "OFF_ROAD_DIESEL", "GASOLINE"]);
  });
});

describe("Equipment Fuel Event filters", () => {
  it("keeps valid URL filters and drops impossible dates or unknown fuel types", () => {
    expect(parseEquipmentFuelFilters({ dateFrom: "2028-02-29", dateTo: "2026-02-31", fuelType: "JET", equipmentId: " equipment-1 " })).toEqual({ dateFrom: "2028-02-29", dateTo: undefined, equipmentId: "equipment-1", fuelType: undefined, fuelServicePersonId: undefined });
  });

  it("builds a bounded structured Prisma filter", () => {
    expect(buildEquipmentFuelWhere({ dateFrom: "2026-07-15", fuelType: "DIESEL", fuelServicePersonId: "person-1" })).toMatchObject({ operationalWorkDate: { gte: new Date("2026-07-15T00:00:00.000Z") }, fuelType: "DIESEL", fuelServicePersonId: "person-1" });
  });
});
