import { describe, expect, it } from "vitest";

import {
  buildDailyLogWhere,
  dailyLogFilterHref,
  hasDailyLogFilters,
  parseDailyLogFilters,
  selectedDailyLogDate,
  shiftDailyLogDate,
  todayDateValue,
} from "@/features/daily-logs/filters";

describe("parseDailyLogFilters", () => {
  it("normalizes supported Daily Log filter values", () => {
    const filters = parseDailyLogFilters({
      q: "  dragline move  ",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      mineId: " mine-1 ",
      equipmentId: "equipment-1",
      shift: "DAY",
      activityType: "DRAGLINE_MOVE",
    });

    expect(filters).toEqual({
      q: "dragline move",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      mineId: "mine-1",
      equipmentId: "equipment-1",
      shift: "DAY",
      activityType: "DRAGLINE_MOVE",
    });
    expect(hasDailyLogFilters(filters)).toBe(true);
  });

  it("drops unsupported enum values and malformed dates", () => {
    const filters = parseDailyLogFilters({
      dateFrom: "07/01/2026",
      dateTo: "not-a-date",
      shift: "FIRST",
      activityType: "UNKNOWN_ACTIVITY",
    });

    expect(filters).toEqual({
      q: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      mineId: undefined,
      equipmentId: undefined,
      shift: undefined,
      activityType: undefined,
    });
    expect(hasDailyLogFilters(filters)).toBe(false);
  });
});

describe("Daily Log date navigation helpers", () => {
  it("uses an exact date range as the selected date", () => {
    expect(
      selectedDailyLogDate(
        {
          dateFrom: "2026-07-08",
          dateTo: "2026-07-08",
        },
        "2026-07-10",
      ),
    ).toBe("2026-07-08");
  });

  it("falls back to today when the active range is not one selected date", () => {
    expect(
      selectedDailyLogDate(
        {
          dateFrom: "2026-07-01",
          dateTo: "2026-07-08",
        },
        "2026-07-10",
      ),
    ).toBe("2026-07-10");
  });

  it("builds previous and next date values using UTC date-only math", () => {
    expect(shiftDailyLogDate("2026-07-01", -1)).toBe("2026-06-30");
    expect(shiftDailyLogDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("builds a today value from the provided Date", () => {
    expect(todayDateValue(new Date("2026-07-08T12:00:00.000Z"))).toBe(
      "2026-07-08",
    );
  });

  it("builds Daily Log filter links while preserving active filters", () => {
    const href = dailyLogFilterHref(
      {
        q: "dragline",
        dateFrom: "2026-07-08",
        dateTo: "2026-07-08",
        equipmentId: "equipment-1",
        shift: "DAY",
      },
      {
        dateFrom: "2026-07-09",
        dateTo: "2026-07-09",
      },
    );

    expect(href).toBe(
      "/daily-logs?q=dragline&dateFrom=2026-07-09&dateTo=2026-07-09&equipmentId=equipment-1&shift=DAY",
    );
  });
});

describe("buildDailyLogWhere", () => {
  it("builds server-side filters for date, mine, equipment, shift, and activity type", () => {
    const where = buildDailyLogWhere({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      mineId: "mine-1",
      equipmentId: "equipment-1",
      shift: "NIGHT",
      activityType: "GENERAL_NOTE",
    });

    expect(where).toMatchObject({
      AND: [
        {
          logDate: {
            gte: new Date("2026-07-01T00:00:00.000Z"),
            lte: new Date("2026-07-08T00:00:00.000Z"),
          },
        },
        { shift: "NIGHT" },
        { mineId: "mine-1" },
        {
          OR: [
            { primaryEquipmentId: "equipment-1" },
            { activities: { some: { equipmentId: "equipment-1" } } },
          ],
        },
        { activities: { some: { activityType: "GENERAL_NOTE" } } },
      ],
    });
  });

  it("searches text across Daily Log and activity narrative fields", () => {
    const where = buildDailyLogWhere({
      q: "contractor",
    });

    expect(where).toMatchObject({
      AND: [
        {
          OR: expect.arrayContaining([
            { summary: { contains: "contractor", mode: "insensitive" } },
            { generalNotes: { contains: "contractor", mode: "insensitive" } },
            {
              activities: {
                some: {
                  OR: expect.arrayContaining([
                    {
                      contractorCompany: {
                        contains: "contractor",
                        mode: "insensitive",
                      },
                    },
                  ]),
                },
              },
            },
          ]),
        },
      ],
    });
  });
});
