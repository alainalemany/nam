import { describe, expect, it } from "vitest";

import {
  cityStateOptions,
  mineTypeOptions,
} from "@/features/equipment/constants";
import {
  equipmentEditFormSchema,
  equipmentFormSchema,
} from "@/features/equipment/validation";

const expectedStateAbbreviations = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA",
  "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX",
  "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const baseInput = {
  cityName: "Fort Meade",
  cityState: "FL",
  mineName: "South Fort Meade",
  mineType: "Quarry",
  displayName: "Dragline 1",
  equipmentNumber: "DL-1",
  category: "DRAGLINE",
  make: "",
  model: "",
  powerType: "DIESEL",
  instrumentationType: "PHYSICAL_GAUGES",
  hasDigitalAlarmScreen: false,
  status: "ACTIVE",
  notes: "",
};

describe("Equipment reference-data controls", () => {
  it("defines exactly the 50 U.S. states plus DC with no duplicates", () => {
    const values = cityStateOptions.map((option) => option.value);

    expect(values).toEqual(expectedStateAbbreviations);
    expect(new Set(values).size).toBe(51);
  });

  it("defines the approved Mine type list exactly", () => {
    expect(mineTypeOptions.map((option) => option.value)).toEqual([
      "Quarry",
      "Open-Pit Mine",
      "Strip Mine",
      "Underground Mine",
      "Placer Mine",
      "Dredging Operation",
      "In-Situ/Solution Mine",
      "Other",
    ]);
  });

  it("accepts defaults and alternate controlled selections", () => {
    expect(equipmentFormSchema.safeParse(baseInput).success).toBe(true);
    expect(
      equipmentFormSchema.safeParse({
        ...baseInput,
        cityState: "WY",
        mineType: "Open-Pit Mine",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid State and Mine type values", () => {
    const result = equipmentFormSchema.safeParse({
      ...baseInput,
      cityState: "Florida",
      mineType: "Surface Mine",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.cityState).toBeDefined();
      expect(result.error.flatten().fieldErrors.mineType).toBeDefined();
    }
  });

  it("allows edit-only null sentinels for persisted-reference comparison", () => {
    const result = equipmentEditFormSchema.safeParse({
      ...baseInput,
      cityState: "",
      mineType: "",
    });

    expect(result.success).toBe(true);
  });

  it("retains exact edit-only legacy values for persisted-reference comparison", () => {
    const result = equipmentEditFormSchema.safeParse({
      ...baseInput,
      cityState: "Legacy State",
      mineType: "Legacy Mine Type",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cityState).toBe("Legacy State");
      expect(result.data.mineType).toBe("Legacy Mine Type");
    }
  });
});
