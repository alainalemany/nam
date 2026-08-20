import { describe, expect, it } from "vitest";

import {
  formatEventStartMinute,
  getDraglineShiftWindow,
  localOperationalDateValue,
  normalizeEventStartTime,
  splitEventStartMinute,
  validateEventInterval,
  validateScheduledShiftStart,
} from "@/features/dragline-delay-reports/time";

describe("Dragline Delay Report time normalization", () => {
  it("formats the local operational date without UTC rollover", () => {
    expect(localOperationalDateValue(new Date(2026, 7, 18, 23, 30))).toBe("2026-08-18");
  });

  it("normalizes same-date and next-date clock times", () => {
    expect(normalizeEventStartTime("23:30", 0)).toBe(1410);
    expect(normalizeEventStartTime("00:20", 1)).toBe(1460);
    expect(normalizeEventStartTime("02:00", 1)).toBe(1560);
  });

  it("round-trips and labels overnight values", () => {
    expect(splitEventStartMinute(1460)).toEqual({ clockTime: "00:20", dayOffset: 1 });
    expect(formatEventStartMinute(1460)).toBe("12:20 AM (next day)");
    expect(formatEventStartMinute(690)).toBe("11:30 AM");
  });

  it("defines the confirmed 5-to-5 Day and Night windows", () => {
    expect(getDraglineShiftWindow("DAY")).toEqual({
      startMinuteOffset: 300,
      endMinuteOffset: 1020,
    });
    expect(getDraglineShiftWindow("NIGHT")).toEqual({
      startMinuteOffset: 1020,
      endMinuteOffset: 1740,
    });
  });

  it("accepts extended Day timeline entries but rejects starts before shift", () => {
    expect(() => validateEventInterval("DAY", 300)).not.toThrow();
    expect(() => validateEventInterval("DAY", 1019)).not.toThrow();
    expect(() => validateEventInterval("DAY", 1020)).not.toThrow();
    expect(() => validateEventInterval("DAY", 1040)).not.toThrow();
    expect(() => validateEventInterval("DAY", 1080)).not.toThrow();
    expect(() => validateEventInterval("DAY", 299)).toThrow(/at or after/);
    expect(() => validateEventInterval("DAY", 990, 30)).not.toThrow();
    expect(() => validateEventInterval("DAY", 991, 30)).not.toThrow();
  });

  it("accepts extended Night timeline entries on the next calendar day", () => {
    expect(() => validateEventInterval("NIGHT", 1020)).not.toThrow();
    expect(() => validateEventInterval("NIGHT", 1410)).not.toThrow();
    expect(() => validateEventInterval("NIGHT", 1739)).not.toThrow();
    expect(() => validateEventInterval("NIGHT", 1740)).not.toThrow();
    expect(() => validateEventInterval("NIGHT", 1760)).not.toThrow();
    expect(() => validateEventInterval("NIGHT", 1800)).not.toThrow();
    expect(() => validateEventInterval("NIGHT", 1710, 30)).not.toThrow();
    expect(() => validateEventInterval("NIGHT", 1711, 30)).not.toThrow();
    expect(() => validateEventInterval("NIGHT", 2879)).not.toThrow();
    expect(() => validateEventInterval("NIGHT", 2880)).toThrow(/two-calendar-day/);
    expect(() => validateEventInterval("NIGHT", 1019)).toThrow(/at or after/);
  });

  it("keeps scheduled-window validation available for Ground Checks", () => {
    expect(() => validateScheduledShiftStart("DAY", 300)).not.toThrow();
    expect(() => validateScheduledShiftStart("DAY", 1019)).not.toThrow();
    expect(() => validateScheduledShiftStart("DAY", 1020)).toThrow(/12-hour/);
    expect(() => validateScheduledShiftStart("NIGHT", 1739)).not.toThrow();
    expect(() => validateScheduledShiftStart("NIGHT", 1740)).toThrow(/12-hour/);
  });
});
