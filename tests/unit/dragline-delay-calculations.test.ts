import { describe, expect, it } from "vitest";

import {
  DRAGLINE_GROUND_CHECK_DOWNTIME_MINUTES,
  calculateDraglineDowntime,
  calculateDraglineRuntime,
  calculateDraglineShiftTotals,
} from "@/features/dragline-delay-reports/calculations";
import { getDefaultGroundChecksForShift } from "@/features/dragline-delay-reports/ground-check-defaults";
import { normalizeEventStartTime } from "@/features/dragline-delay-reports/time";

const delay = (
  startMinuteOffset: number,
  durationMinutes: number,
  delayCode = "26",
) => ({
  startMinuteOffset,
  durationMinutes,
  causesDowntime: true,
  delayCode,
});

const shiftChange = (startMinuteOffset: number, durationMinutes = 15) =>
  delay(startMinuteOffset, durationMinutes, "13");

describe("Dragline downtime interval union", () => {
  it.each([
    ["one delay", [delay(510, 30)], 30],
    ["disjoint", [delay(510, 30), delay(570, 15)], 45],
    ["overlapping", [delay(510, 30), delay(525, 30)], 45],
    ["nested", [delay(510, 60), delay(525, 15)], 60],
    ["identical", [delay(510, 30), delay(510, 30)], 30],
    ["adjacent", [delay(510, 30), delay(540, 30)], 60],
    ["equal start", [delay(510, 20), delay(510, 45)], 45],
  ])("calculates %s intervals", (_label, entries, expected) => {
    expect(calculateDraglineDowntime("DAY", entries)).toBe(expected);
  });

  it("ignores concurrent non-downtime work", () => {
    expect(
      calculateDraglineDowntime("DAY", [
        delay(510, 20),
        { startMinuteOffset: 510, durationMinutes: 20, causesDowntime: false },
      ]),
    ).toBe(20);
  });

  it("supports overnight intervals and duration crossing midnight", () => {
    const totals = calculateDraglineShiftTotals("NIGHT", [delay(1430, 60), delay(1480, 20)]);
    expect(totals).toEqual({ downTimeMinutes: 70, runTimeMinutes: 650 });
  });

  it.each([
    ["at 4:50 PM", "DAY" as const, 1010, 20],
    ["at 5:00 PM", "DAY" as const, 1020, 15],
    ["at 5:20 PM", "DAY" as const, 1040, 10],
    ["at 5:30 PM", "DAY" as const, 1050, 15],
    ["after the Night scheduled end", "NIGHT" as const, 1760, 15],
  ])("counts the full Code 13 duration %s", (_label, shift, start, duration) => {
    expect(calculateDraglineShiftTotals(shift, [shiftChange(start, duration)])).toEqual({
      downTimeMinutes: duration,
      runTimeMinutes: 720 - duration,
    });
  });

  it("unions Code 13 with overlapping ordinary downtime", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [
        delay(1030, 20),
        shiftChange(1040),
      ]),
    ).toEqual({ downTimeMinutes: 25, runTimeMinutes: 695 });
  });

  it("requires a duration when Code 13 is marked as downtime", () => {
    expect(() =>
      calculateDraglineShiftTotals("DAY", [
        {
          startMinuteOffset: 1010,
          causesDowntime: true,
          delayCode: "13",
        },
      ]),
    ).toThrow(/requires a positive duration/);
  });

  it("continues to count ordinary non-Code-13 downtime", () => {
    expect(calculateDraglineShiftTotals("DAY", [delay(1010, 15)])).toEqual({
      downTimeMinutes: 15,
      runTimeMinutes: 705,
    });
  });

  it("subtracts post-shift downtime from the fixed 720-minute budget", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [
        delay(600, 90),
        shiftChange(1040, 10),
      ]),
    ).toEqual({ downTimeMinutes: 100, runTimeMinutes: 620 });
  });

  it("unions two overlapping post-shift downtime intervals", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [
        delay(1040, 15),
        delay(1045, 15),
      ]),
    ).toEqual({ downTimeMinutes: 20, runTimeMinutes: 700 });
  });

  it.each(["DAY", "NIGHT"] as const)(
    "counts the four non-overlapping %s defaults as 40 minutes",
    (shift) => {
      expect(DRAGLINE_GROUND_CHECK_DOWNTIME_MINUTES).toBe(10);
      const groundChecks = getDefaultGroundChecksForShift(shift).map(
        (groundCheck) => ({
          startMinuteOffset: normalizeEventStartTime(
            groundCheck.startTime,
            groundCheck.dayOffset,
          ),
        }),
      );
      expect(
        calculateDraglineShiftTotals(shift, [], groundChecks),
      ).toEqual({ downTimeMinutes: 40, runTimeMinutes: 680 });
    },
  );

  it("unions the Day defaults once with overlapping timeline downtime", () => {
    const groundChecks = getDefaultGroundChecksForShift("DAY").map(
      (groundCheck) => ({
        startMinuteOffset: normalizeEventStartTime(
          groundCheck.startTime,
          groundCheck.dayOffset,
        ),
      }),
    );

    expect(
      calculateDraglineShiftTotals("DAY", [delay(375, 20)], groundChecks),
    ).toEqual({ downTimeMinutes: 50, runTimeMinutes: 670 });
  });

  it("reproduces the August 27 contained Ground Check acceptance case", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [delay(370, 30)], [
        { startMinuteOffset: 380 },
      ]),
    ).toEqual({ downTimeMinutes: 30, runTimeMinutes: 690 });
  });

  it("adds no unique time for a Ground Check fully inside timeline downtime", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [delay(360, 60)], [
        { startMinuteOffset: 380 },
      ]),
    ).toEqual({ downTimeMinutes: 60, runTimeMinutes: 660 });
  });

  it("counts one Shared Downtime Block exactly once regardless of child activities", () => {
    const activities = ["35", "36", "52"];
    expect(activities).toHaveLength(3);
    expect(
      calculateDraglineShiftTotals("DAY", [], [], [
        { startMinuteOffset: 310, durationMinutes: 400 },
      ]),
    ).toEqual({ downTimeMinutes: 400, runTimeMinutes: 320 });
  });

  it("unions a fully contained Ground Check with a Shared Downtime Block", () => {
    expect(
      calculateDraglineShiftTotals(
        "DAY",
        [],
        [{ startMinuteOffset: 380 }],
        [{ startMinuteOffset: 310, durationMinutes: 400 }],
      ),
    ).toEqual({ downTimeMinutes: 400, runTimeMinutes: 320 });
  });

  it("adds only the unique Ground Check portion beyond a Shared Downtime Block", () => {
    expect(
      calculateDraglineShiftTotals(
        "DAY",
        [],
        [{ startMinuteOffset: 705 }],
        [{ startMinuteOffset: 310, durationMinutes: 400 }],
      ),
    ).toEqual({ downTimeMinutes: 405, runTimeMinutes: 315 });
  });

  it("unions ordinary timeline downtime with a Shared Downtime Block", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [delay(700, 20)], [], [
        { startMinuteOffset: 310, durationMinutes: 400 },
      ]),
    ).toEqual({ downTimeMinutes: 410, runTimeMinutes: 310 });
  });

  it("unions overlapping Shared Downtime Blocks", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [], [], [
        { startMinuteOffset: 310, durationMinutes: 400 },
        { startMinuteOffset: 690, durationMinutes: 60 },
      ]),
    ).toEqual({ downTimeMinutes: 440, runTimeMinutes: 280 });
  });

  it("counts full Shared Downtime Blocks beyond the nominal shift end", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [], [], [
        { startMinuteOffset: 1000, durationMinutes: 60 },
      ]),
    ).toEqual({ downTimeMinutes: 60, runTimeMinutes: 660 });
    expect(
      calculateDraglineShiftTotals("NIGHT", [], [], [
        { startMinuteOffset: 1730, durationMinutes: 60 },
      ]),
    ).toEqual({ downTimeMinutes: 60, runTimeMinutes: 660 });
  });

  it("unions Code 13 with a post-shift Shared Downtime Block", () => {
    expect(
      calculateDraglineShiftTotals(
        "DAY",
        [shiftChange(1040, 10)],
        [],
        [{ startMinuteOffset: 1035, durationMinutes: 10 }],
      ),
    ).toEqual({ downTimeMinutes: 15, runTimeMinutes: 705 });
  });

  it("unions a partially overlapping Ground Check with timeline downtime", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [delay(370, 15)], [
        { startMinuteOffset: 380 },
      ]),
    ).toEqual({ downTimeMinutes: 20, runTimeMinutes: 700 });
  });

  it("unions a Ground Check immediately following timeline downtime", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [delay(370, 10)], [
        { startMinuteOffset: 380 },
      ]),
    ).toEqual({ downTimeMinutes: 20, runTimeMinutes: 700 });
  });

  it("unions overlapping Ground Checks", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [], [
        { startMinuteOffset: 380 },
        { startMinuteOffset: 385 },
      ]),
    ).toEqual({ downTimeMinutes: 15, runTimeMinutes: 705 });
  });

  it("adds ten minutes for a non-overlapping Ground Check", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [delay(370, 30)], [
        { startMinuteOffset: 430 },
      ]),
    ).toEqual({ downTimeMinutes: 40, runTimeMinutes: 680 });
  });

  it("leaves timeline-only totals unchanged when no Ground Checks exist", () => {
    expect(calculateDraglineShiftTotals("DAY", [delay(370, 30)])).toEqual({
      downTimeMinutes: 30,
      runTimeMinutes: 690,
    });
  });

  it("clips Ground Checks to the scheduled shift calculation window", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [], [{ startMinuteOffset: 1015 }]),
    ).toEqual({ downTimeMinutes: 5, runTimeMinutes: 715 });
    expect(
      calculateDraglineShiftTotals("DAY", [], [{ startMinuteOffset: 1030 }]),
    ).toEqual({ downTimeMinutes: 0, runTimeMinutes: 720 });
  });

  it("rejects incomplete, nonpositive, and pre-shift downtime", () => {
    expect(() =>
      calculateDraglineDowntime("DAY", [
        { startMinuteOffset: 500, causesDowntime: true },
      ]),
    ).toThrow(/requires a positive duration/);
    expect(() => calculateDraglineDowntime("DAY", [delay(510, 0)])).toThrow(/positive/);
    expect(() => calculateDraglineDowntime("DAY", [delay(510, -1)])).toThrow(/positive/);
    expect(() => calculateDraglineDowntime("DAY", [delay(299, 10)])).toThrow(/at or after/);
  });

  it("allows downtime to end exactly at the corrected shift boundaries", () => {
    expect(calculateDraglineDowntime("DAY", [delay(990, 30)])).toBe(30);
    expect(calculateDraglineDowntime("NIGHT", [delay(1710, 30)])).toBe(30);
  });

  it("counts full downtime crossing or following the nominal scheduled end", () => {
    expect(calculateDraglineDowntime("DAY", [delay(1010, 30)])).toBe(30);
    expect(calculateDraglineDowntime("DAY", [delay(1030, 20)])).toBe(20);
  });

  it("unions overlapping downtime across the nominal scheduled end", () => {
    expect(
      calculateDraglineDowntime("DAY", [delay(1000, 40), delay(1010, 30)]),
    ).toBe(40);
  });

  it("keeps runtime based on 720 minutes when the factual timeline runs late", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [
        delay(600, 60),
        shiftChange(1040, 10),
      ]),
    ).toEqual({ downTimeMinutes: 70, runTimeMinutes: 650 });
  });

  it("rejects unique qualifying downtime above 720 instead of producing negative runtime", () => {
    expect(() =>
      calculateDraglineShiftTotals("DAY", [delay(300, 721)]),
    ).toThrow(/cannot exceed the 12-hour shift/);
  });

  it("derives runtime from a normal 720-minute shift and rejects impossible totals", () => {
    expect(calculateDraglineRuntime(45)).toBe(675);
    expect(calculateDraglineRuntime(720)).toBe(0);
    expect(() => calculateDraglineRuntime(721)).toThrow(/between 0 and 720/);
  });
});
