import { describe, expect, it } from "vitest";

import {
  finalDraglineTimelineEntry,
  hasFinalShiftChangeEntry,
} from "@/features/dragline-delay-reports/lifecycle";

describe("Dragline Delay Report lifecycle chronology", () => {
  it("orders by normalized minute and then stable sequence", () => {
    const entries = [
      { startMinuteOffset: 1019, sequence: 3, delayCode: "13" },
      { startMinuteOffset: 1019, sequence: 2, delayCode: "34" },
      { startMinuteOffset: 900, sequence: 9, delayCode: "26" },
    ];
    expect(finalDraglineTimelineEntry(entries)).toEqual(entries[0]);
    expect(hasFinalShiftChangeEntry(entries)).toBe(true);
  });

  it("rejects empty timelines and a same-time non-Shift-Change final sequence", () => {
    expect(hasFinalShiftChangeEntry([])).toBe(false);
    expect(
      hasFinalShiftChangeEntry([
        { startMinuteOffset: 1739, sequence: 1, delayCode: "13" },
        { startMinuteOffset: 1739, sequence: 2, delayCode: "34" },
      ]),
    ).toBe(false);
  });
});
