import { describe, expect, it } from "vitest";

import {
  buildDailyLogWhere,
  hasDailyLogFilters,
  parseDailyLogFilters,
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
