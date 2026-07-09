import { describe, expect, it } from "vitest";

import {
  shiftReportStatusValues,
  shiftValues,
} from "@/features/shift-reports/constants";
import { shiftReportFormSchema } from "@/features/shift-reports/validation";

describe("shiftReportFormSchema", () => {
  it("accepts a minimal valid Shift Report", () => {
    const parsed = shiftReportFormSchema.safeParse({
      reportDate: "2026-07-09",
      shift: "DAY",
      status: "DRAFT",
      mineId: "",
      equipmentId: "",
      location: "",
      summary: "Routine shift with no major exceptions.",
      operationalNotes: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      shift: "DAY",
      status: "DRAFT",
      summary: "Routine shift with no major exceptions.",
    });
  });

  it("normalizes optional blank fields while trimming text", () => {
    const parsed = shiftReportFormSchema.safeParse({
      reportDate: "2026-07-09",
      shift: "NIGHT",
      status: "COMPLETED",
      mineId: "  ",
      equipmentId: "",
      location: "  Dragline pad  ",
      summary: "  PM work completed during the shift.  ",
      operationalNotes: "  Watch the west ramp next shift.  ",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      mineId: undefined,
      equipmentId: undefined,
      location: "Dragline pad",
      summary: "PM work completed during the shift.",
      operationalNotes: "Watch the west ramp next shift.",
    });
  });

  it("rejects missing required fields", () => {
    const parsed = shiftReportFormSchema.safeParse({
      reportDate: "",
      shift: "DAY",
      status: "DRAFT",
      mineId: "",
      equipmentId: "",
      location: "",
      summary: " ",
      operationalNotes: "",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.reportDate).toBeDefined();
    expect(parsed.error?.flatten().fieldErrors.summary).toContain(
      "Shift summary is required.",
    );
  });

  it("uses feature-owned shift and status values", () => {
    expect(shiftValues).toContain("UNKNOWN");
    expect(shiftReportStatusValues).toContain("ARCHIVED");

    const parsed = shiftReportFormSchema.safeParse({
      reportDate: "2026-07-09",
      shift: "FIRST",
      status: "DONE",
      mineId: "",
      equipmentId: "",
      location: "",
      summary: "Shift summary.",
      operationalNotes: "",
    });

    expect(parsed.success).toBe(false);
  });
});
