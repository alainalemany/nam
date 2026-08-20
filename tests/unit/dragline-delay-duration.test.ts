import { describe, expect, it } from "vitest";

import { formatDraglineDurationMinutes } from "@/features/dragline-delay-reports/duration";

describe("Dragline duration presentation", () => {
  it.each([
    [0, "0 h"],
    [30, "30 min"],
    [60, "1 h"],
    [120, "2 h"],
    [135, "2 h 15 min"],
    [585, "9 h 45 min"],
    [660, "11 h"],
    [720, "12 h"],
  ])("formats %i integer minutes as %s", (minutes, expected) => {
    expect(formatDraglineDurationMinutes(minutes)).toBe(expected);
  });

  it.each([-1, 1.5])("rejects unsupported duration %s", (minutes) => {
    expect(() => formatDraglineDurationMinutes(minutes)).toThrow();
  });
});
