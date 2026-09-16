import { describe, expect, it } from "vitest";

import {
  getDefaultGroundChecksForShift,
  isDefaultGroundCheckSetForShift,
} from "@/features/dragline-delay-reports/ground-check-defaults";

describe("Dragline Delay Report new-form Ground Check defaults", () => {
  it("returns the exact ordered Day defaults", () => {
    expect(getDefaultGroundChecksForShift("DAY")).toEqual([
      { sequence: 1, startTime: "06:20", dayOffset: 0 },
      { sequence: 2, startTime: "09:30", dayOffset: 0 },
      { sequence: 3, startTime: "12:30", dayOffset: 0 },
      { sequence: 4, startTime: "16:00", dayOffset: 0 },
    ]);
  });

  it("returns the exact ordered Night defaults with next-day offsets", () => {
    expect(getDefaultGroundChecksForShift("NIGHT")).toEqual([
      { sequence: 1, startTime: "18:20", dayOffset: 0 },
      { sequence: 2, startTime: "21:30", dayOffset: 0 },
      { sequence: 3, startTime: "00:30", dayOffset: 1 },
      { sequence: 4, startTime: "04:00", dayOffset: 1 },
    ]);
  });

  it("recognizes only an unpersisted, exact default set", () => {
    const day = getDefaultGroundChecksForShift("DAY");
    expect(isDefaultGroundCheckSetForShift(day, "DAY")).toBe(true);
    expect(
      isDefaultGroundCheckSetForShift(
        day.map((groundCheck, index) =>
          index === 0 ? { ...groundCheck, startTime: "06:21" } : groundCheck,
        ),
        "DAY",
      ),
    ).toBe(false);
    expect(
      isDefaultGroundCheckSetForShift(
        day.map((groundCheck, index) =>
          index === 0 ? { ...groundCheck, id: "persisted-row" } : groundCheck,
        ),
        "DAY",
      ),
    ).toBe(false);
  });
});
