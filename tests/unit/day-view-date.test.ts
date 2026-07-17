import { afterEach, describe, expect, it } from "vitest";

import {
  dayViewHref,
  parseDayViewDate,
  parseDayViewDateKey,
  shiftDayViewDate,
  todayDayViewDate,
} from "@/features/day-view/date";

describe("Day View date helpers", () => {
  const originalTimezone = process.env.TZ;

  afterEach(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  });

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

  it("uses America/New_York calendar components when the UTC container date is tomorrow", () => {
    process.env.TZ = "UTC";

    expect(todayDayViewDate(new Date("2026-07-18T01:00:00.000Z"))).toBe("2026-07-17");
    expect(todayDayViewDate(new Date("2026-12-18T01:00:00.000Z"))).toBe("2026-12-17");
  });

  it("changes the local date only at America/New_York midnight", () => {
    process.env.TZ = "UTC";

    expect(todayDayViewDate(new Date("2026-07-18T03:59:59.999Z"))).toBe("2026-07-17");
    expect(todayDayViewDate(new Date("2026-07-18T04:00:00.000Z"))).toBe("2026-07-18");
    expect(todayDayViewDate(new Date("2026-12-18T04:59:59.999Z"))).toBe("2026-12-17");
    expect(todayDayViewDate(new Date("2026-12-18T05:00:00.000Z"))).toBe("2026-12-18");
  });

  it.each(["2026-01-01", "2024-02-29", "2026-12-31"])(
    "accepts canonical calendar date %s",
    (value) => {
      expect(parseDayViewDateKey(value)).toBe(value);
    },
  );

  it.each([
    "2026-02-29",
    "2026-02-30",
    "2026-02-31",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "26-01-01",
    "2026-1-1",
    " 2026-01-01 ",
    "2026-01-01T00:00:00Z",
  ])("rejects invalid calendar date %s", (value) => {
    expect(parseDayViewDateKey(value)).toBeUndefined();
  });

  it("rejects duplicate date query values", () => {
    expect(parseDayViewDateKey(["2026-07-08", "2026-07-09"])).toBeUndefined();
  });

  it("falls back to the local default for malformed, impossible, or duplicate dates", () => {
    process.env.TZ = "UTC";
    const now = new Date("2026-07-18T01:00:00.000Z");

    expect(parseDayViewDate({ date: "not-a-date" }, now).selectedDate).toBe("2026-07-17");
    expect(parseDayViewDate({ date: "2026-02-31" }, now).selectedDate).toBe("2026-07-17");
    expect(
      parseDayViewDate({ date: ["2026-07-08", "2026-07-09"] }, now).selectedDate,
    ).toBe("2026-07-17");
  });

  it("navigates across month, year, and leap-day boundaries", () => {
    expect(shiftDayViewDate("2026-07-01", -1)).toBe("2026-06-30");
    expect(shiftDayViewDate("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftDayViewDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDayViewDate("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftDayViewDate("2024-02-29", 1)).toBe("2024-03-01");
  });

  it("navigates through daylight-saving transition dates without drift", () => {
    process.env.TZ = "UTC";

    expect(shiftDayViewDate("2026-03-07", 1)).toBe("2026-03-08");
    expect(shiftDayViewDate("2026-03-08", 1)).toBe("2026-03-09");
    expect(shiftDayViewDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDayViewDate("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("rejects invalid navigation inputs and builds canonical route hrefs", () => {
    expect(() => shiftDayViewDate("2026-02-31", 1)).toThrow(RangeError);
    expect(dayViewHref("2026-07-08")).toBe("/day-view?date=2026-07-08");
  });
});
