import { describe, expect, it } from "vitest";

import {
  equipmentEditFormSchema,
  equipmentFormSchema,
} from "@/features/equipment/validation";

const baseInput = {
  mineId: "mine-1",
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

describe("Equipment validation", () => {
  it("accepts a canonical Mine ID for create and edit", () => {
    expect(equipmentFormSchema.safeParse(baseInput).success).toBe(true);
    expect(equipmentEditFormSchema.safeParse(baseInput).success).toBe(true);
  });

  it("requires a Mine selection", () => {
    const result = equipmentFormSchema.safeParse({ ...baseInput, mineId: "  " });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.mineId).toEqual([
        "Mine is required.",
      ]);
    }
  });

  it("rejects invalid bounded Equipment values", () => {
    const result = equipmentFormSchema.safeParse({
      ...baseInput,
      category: "LOCOMOTIVE",
      status: "RETIRED",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.category).toBeDefined();
      expect(result.error.flatten().fieldErrors.status).toBeDefined();
    }
  });
});
