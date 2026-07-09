import { describe, expect, it } from "vitest";

import {
  dailyInspectionConditionValues,
  dailyInspectionStatusValues,
  shiftValues,
} from "@/features/daily-inspections/constants";
import { dailyInspectionFormSchema } from "@/features/daily-inspections/validation";

describe("dailyInspectionFormSchema", () => {
  it("accepts a minimal valid Daily Inspection", () => {
    const parsed = dailyInspectionFormSchema.safeParse({
      inspectionDate: "2026-07-09",
      shift: "DAY",
      mineId: "",
      equipmentId: "equipment-1",
      equipmentHours: "",
      condition: "SATISFACTORY",
      status: "COMPLETED",
      findings: "Pre-shift inspection completed with no issues found.",
      defectsIdentified: "",
      notes: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      equipmentId: "equipment-1",
      condition: "SATISFACTORY",
      status: "COMPLETED",
      defectsIdentified: false,
    });
  });

  it("normalizes optional fields and coerces equipment hours", () => {
    const parsed = dailyInspectionFormSchema.safeParse({
      inspectionDate: "2026-07-09",
      shift: "NIGHT",
      mineId: "  ",
      equipmentId: " equipment-1 ",
      equipmentHours: " 1234.5 ",
      condition: "NEEDS_ATTENTION",
      status: "FOLLOW_UP_NEEDED",
      findings: "  Guard needs follow-up.  ",
      defectsIdentified: "on",
      notes: "  Check again next shift.  ",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      mineId: undefined,
      equipmentId: "equipment-1",
      equipmentHours: 1234.5,
      findings: "Guard needs follow-up.",
      defectsIdentified: true,
      notes: "Check again next shift.",
    });
  });

  it("rejects missing required fields and negative equipment hours", () => {
    const parsed = dailyInspectionFormSchema.safeParse({
      inspectionDate: "2026-07-09",
      shift: "DAY",
      mineId: "",
      equipmentId: " ",
      equipmentHours: "-1",
      condition: "SATISFACTORY",
      status: "COMPLETED",
      findings: " ",
      defectsIdentified: "",
      notes: "",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.equipmentId).toContain(
      "Equipment is required.",
    );
    expect(parsed.error?.flatten().fieldErrors.equipmentHours).toContain(
      "Equipment hours cannot be negative.",
    );
    expect(parsed.error?.flatten().fieldErrors.findings).toContain(
      "Findings is required.",
    );
  });

  it("uses feature-owned shift, condition, and status values", () => {
    expect(shiftValues).toContain("UNKNOWN");
    expect(dailyInspectionConditionValues).toContain("UNSAFE");
    expect(dailyInspectionStatusValues).toContain("FOLLOW_UP_NEEDED");

    const parsed = dailyInspectionFormSchema.safeParse({
      inspectionDate: "2026-07-09",
      shift: "FIRST",
      mineId: "",
      equipmentId: "equipment-1",
      equipmentHours: "",
      condition: "BROKEN",
      status: "DONE",
      findings: "Inspection findings.",
      defectsIdentified: "",
      notes: "",
    });

    expect(parsed.success).toBe(false);
  });
});
