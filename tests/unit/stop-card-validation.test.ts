import { describe, expect, it } from "vitest";

import {
  stopCardCategoryValues,
  stopCardSeverityValues,
  stopCardStatusValues,
} from "@/features/stop-cards/constants";
import { stopCardFormSchema } from "@/features/stop-cards/validation";

describe("stopCardFormSchema", () => {
  it("accepts a minimal valid STOP Card", () => {
    const parsed = stopCardFormSchema.safeParse({
      observationDate: "2026-07-08",
      category: "HAZARD_OBSERVATION",
      severity: "MEDIUM",
      status: "OPEN",
      mineId: "",
      equipmentId: "",
      location: "",
      description: "Observed a trip hazard near the work area.",
      correctiveAction: "",
      createdBy: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      category: "HAZARD_OBSERVATION",
      severity: "MEDIUM",
      status: "OPEN",
      description: "Observed a trip hazard near the work area.",
    });
  });

  it("normalizes optional blank fields while trimming required text", () => {
    const parsed = stopCardFormSchema.safeParse({
      observationDate: "2026-07-08",
      category: "NEAR_MISS",
      severity: "HIGH",
      status: "IN_PROGRESS",
      mineId: "  ",
      equipmentId: "",
      location: "  West ramp  ",
      description: "  Truck crossed too close to the barricade.  ",
      correctiveAction: "  Reviewed the hazard with the operator.  ",
      createdBy: "  Alain  ",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      mineId: undefined,
      equipmentId: undefined,
      location: "West ramp",
      description: "Truck crossed too close to the barricade.",
      correctiveAction: "Reviewed the hazard with the operator.",
      createdBy: "Alain",
    });
  });

  it("rejects missing required fields", () => {
    const parsed = stopCardFormSchema.safeParse({
      observationDate: "",
      category: "HAZARD_OBSERVATION",
      severity: "MEDIUM",
      status: "OPEN",
      mineId: "",
      equipmentId: "",
      location: "",
      description: " ",
      correctiveAction: "",
      createdBy: "",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.description).toContain(
      "Description is required.",
    );
  });

  it("uses feature-owned category, severity, and status values", () => {
    expect(stopCardCategoryValues).toContain("NEAR_MISS");
    expect(stopCardSeverityValues).toContain("CRITICAL");
    expect(stopCardStatusValues).toContain("CLOSED");

    const parsed = stopCardFormSchema.safeParse({
      observationDate: "2026-07-08",
      category: "NOT_A_REAL_CATEGORY",
      severity: "MEDIUM",
      status: "OPEN",
      mineId: "",
      equipmentId: "",
      location: "",
      description: "Observed a safety issue.",
      correctiveAction: "",
      createdBy: "",
    });

    expect(parsed.success).toBe(false);
  });
});
