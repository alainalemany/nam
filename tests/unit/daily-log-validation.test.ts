import { describe, expect, it } from "vitest";

import { dailyLogFormSchema } from "@/features/daily-logs/validation";

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
