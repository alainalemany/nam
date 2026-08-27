import { describe, expect, it } from "vitest";

import {
  DRAGLINE_GROUND_CHECK_DOWNTIME_MINUTES,
  calculateDraglineDowntime,
  calculateDraglineRuntime,
  calculateDraglineShiftTotals,
} from "@/features/dragline-delay-reports/calculations";

const delay = (startMinuteOffset: number, durationMinutes: number) => ({
  startMinuteOffset,
  durationMinutes,
  causesDowntime: true,
});

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

  it("counts every non-overlapping Ground Check as ten minutes of downtime", () => {
    expect(DRAGLINE_GROUND_CHECK_DOWNTIME_MINUTES).toBe(10);
    expect(
      calculateDraglineShiftTotals("DAY", [], [
        { startMinuteOffset: 600 },
        { startMinuteOffset: 720 },
        { startMinuteOffset: 840 },
        { startMinuteOffset: 960 },
      ]),
    ).toEqual({ downTimeMinutes: 40, runTimeMinutes: 680 });
  });

  it("unions Ground Checks with timeline downtime instead of double-counting", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [delay(600, 30)], [
        { startMinuteOffset: 605 },
      ]),
    ).toEqual({ downTimeMinutes: 30, runTimeMinutes: 690 });
    expect(
      calculateDraglineShiftTotals("DAY", [delay(595, 10)], [
        { startMinuteOffset: 600 },
      ]),
    ).toEqual({ downTimeMinutes: 15, runTimeMinutes: 705 });
    expect(
      calculateDraglineShiftTotals("DAY", [], [
        { startMinuteOffset: 600 },
        { startMinuteOffset: 605 },
      ]),
    ).toEqual({ downTimeMinutes: 15, runTimeMinutes: 705 });
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

  it("clips downtime crossing the scheduled end and ignores post-shift downtime", () => {
    expect(calculateDraglineDowntime("DAY", [delay(1010, 30)])).toBe(10);
    expect(calculateDraglineDowntime("DAY", [delay(1030, 20)])).toBe(0);
  });

  it("unions overlapping downtime only within the scheduled calculation window", () => {
    expect(
      calculateDraglineDowntime("DAY", [delay(1000, 40), delay(1010, 30)]),
    ).toBe(20);
  });

  it("keeps runtime based on 720 minutes when the factual timeline runs late", () => {
    expect(
      calculateDraglineShiftTotals("DAY", [
        delay(600, 60),
        { startMinuteOffset: 1080, causesDowntime: false },
      ]),
    ).toEqual({ downTimeMinutes: 60, runTimeMinutes: 660 });
  });

  it("derives runtime from a normal 720-minute shift and rejects impossible totals", () => {
    expect(calculateDraglineRuntime(45)).toBe(675);
    expect(calculateDraglineRuntime(720)).toBe(0);
    expect(() => calculateDraglineRuntime(721)).toThrow(/between 0 and 720/);
  });
});
