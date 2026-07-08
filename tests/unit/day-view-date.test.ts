import { describe, expect, it } from "vitest";

import {
  dayViewHref,
  parseDayViewDate,
  shiftDayViewDate,
  todayDayViewDate,
} from "@/features/day-view/date";

describe("Day View date helpers", () => {
  it("uses the selected date from query params", () => {
    const state = parseDayViewDate(
      {
        date: "2026-07-08",
      },
      new Date("2026-07-10T12:00:00.000Z"),
    );

    expect(state).toEqual({
      selectedDate: "2026-07-08",
      previousDate: "2026-07-07",
      nextDate: "2026-07-09",
      today: "2026-07-10",
    });
  });

  it("falls back to today when the selected date is missing or invalid", () => {
    expect(
      parseDayViewDate(
        {
          date: "not-a-date",
        },
        new Date("2026-07-10T12:00:00.000Z"),
      ).selectedDate,
    ).toBe("2026-07-10");
  });

  it("shifts dates with UTC date-only math", () => {
    expect(shiftDayViewDate("2026-07-01", -1)).toBe("2026-06-30");
    expect(shiftDayViewDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("builds today and route href values", () => {
    expect(todayDayViewDate(new Date("2026-07-08T23:59:00.000Z"))).toBe(
      "2026-07-08",
    );
    expect(dayViewHref("2026-07-08")).toBe("/day-view?date=2026-07-08");
  });
});
