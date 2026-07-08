import { describe, expect, it } from "vitest";

import {
  dailyLogActivityTypeValues,
  shiftValues,
} from "@/features/daily-logs/constants";
import {
  dailyLogActivitySchema,
  dailyLogFormSchema,
} from "@/features/daily-logs/validation";

describe("dailyLogFormSchema", () => {
  it("accepts a minimal valid Daily Log with one activity", () => {
    const parsed = dailyLogFormSchema.safeParse({
      logDate: "2026-07-06",
      shift: "DAY",
      mineId: "",
      primaryEquipmentId: "",
      summary: "Moved dragline and recorded shift activity.",
      weatherConditions: "",
      generalNotes: "",
      activities: [
        {
          activityType: "GENERAL_NOTE",
          title: "Shift started",
          startTime: "",
          endTime: "",
          description: "",
          equipmentId: "",
          location: "",
          contractorCompany: "",
          personName: "",
          notes: "",
        },
      ],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.activities).toHaveLength(1);
  });

  it("normalizes optional blank fields while trimming required text", () => {
    const parsed = dailyLogFormSchema.safeParse({
      logDate: "2026-07-06",
      shift: "NIGHT",
      mineId: "  ",
      primaryEquipmentId: "",
      summary: "  Recorded shift activity.  ",
      weatherConditions: "  ",
      generalNotes: "",
      activities: [
        {
          activityType: "GENERAL_NOTE",
          title: "  Shift started  ",
          startTime: "",
          endTime: "  ",
          description: "",
          equipmentId: "equipment-1",
          location: "  Pit 1  ",
          contractorCompany: "",
          personName: "",
          notes: "",
        },
      ],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      mineId: undefined,
      primaryEquipmentId: undefined,
      summary: "Recorded shift activity.",
      weatherConditions: undefined,
      generalNotes: undefined,
      activities: [
        {
          title: "Shift started",
          startTime: undefined,
          endTime: undefined,
          equipmentId: "equipment-1",
          location: "Pit 1",
          contractorCompany: undefined,
          personName: undefined,
          notes: undefined,
        },
      ],
    });
  });

  it("rejects a Daily Log without activity entries", () => {
    const parsed = dailyLogFormSchema.safeParse({
      logDate: "2026-07-06",
      shift: "DAY",
      mineId: "",
      primaryEquipmentId: "",
      summary: "Moved dragline and recorded shift activity.",
      weatherConditions: "",
      generalNotes: "",
      activities: [],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("dailyLogActivitySchema", () => {
  it("uses the feature-owned activity type values", () => {
    expect(dailyLogActivityTypeValues).toContain("GENERAL_NOTE");
    expect(shiftValues).toContain("UNKNOWN");

    const parsed = dailyLogActivitySchema.safeParse({
      activityType: "NOT_A_REAL_ACTIVITY",
      title: "Invalid activity type",
      startTime: "",
      endTime: "",
      description: "",
      equipmentId: "",
      location: "",
      contractorCompany: "",
      personName: "",
      notes: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("requires a title for saved activity rows", () => {
    const parsed = dailyLogActivitySchema.safeParse({
      activityType: "GENERAL_NOTE",
      title: " ",
      startTime: "",
      endTime: "",
      description: "Activity row with details but no title.",
      equipmentId: "",
      location: "",
      contractorCompany: "",
      personName: "",
      notes: "",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.title).toContain(
      "Activity title is required.",
    );
  });
});
