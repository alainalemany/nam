import { describe, expect, it } from "vitest";

import {
  buildDailyInspectionWhere,
  hasDailyInspectionFilters,
  parseDailyInspectionFilters,
} from "@/features/daily-inspections/filters";

describe("parseDailyInspectionFilters", () => {
  it("normalizes supported Daily Inspection filter values", () => {
    const filters = parseDailyInspectionFilters({
      q: "  hydraulic leak  ",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: " equipment-1 ",
      status: "FOLLOW_UP_NEEDED",
    });

    expect(filters).toEqual({
      q: "hydraulic leak",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: "equipment-1",
      status: "FOLLOW_UP_NEEDED",
    });
    expect(hasDailyInspectionFilters(filters)).toBe(true);
  });

  it("drops unsupported enum values, malformed dates, and empty text", () => {
    const filters = parseDailyInspectionFilters({
      q: "",
      dateFrom: "07/01/2026",
      dateTo: "not-a-date",
      status: "OPEN",
    });

    expect(filters).toEqual({
      q: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      equipmentId: undefined,
      status: undefined,
    });
    expect(hasDailyInspectionFilters(filters)).toBe(false);
  });
});

describe("buildDailyInspectionWhere", () => {
  it("builds server-side filters for date, equipment, and status", () => {
    const where = buildDailyInspectionWhere({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: "equipment-1",
      status: "COMPLETED",
    });

    expect(where).toMatchObject({
      AND: [
        {
          inspectionDate: {
            gte: new Date("2026-07-01T00:00:00.000Z"),
            lte: new Date("2026-07-08T00:00:00.000Z"),
          },
        },
        { equipmentId: "equipment-1" },
        { status: "COMPLETED" },
      ],
    });
  });

  it("supports one-sided date filters", () => {
    expect(buildDailyInspectionWhere({ dateFrom: "2026-07-01" })).toMatchObject({
      AND: [{ inspectionDate: { gte: new Date("2026-07-01T00:00:00.000Z") } }],
    });
    expect(buildDailyInspectionWhere({ dateTo: "2026-07-08" })).toMatchObject({
      AND: [{ inspectionDate: { lte: new Date("2026-07-08T00:00:00.000Z") } }],
    });
  });

  it("searches text across Daily Inspection findings, notes, and equipment fields", () => {
    const where = buildDailyInspectionWhere({ q: "cable" });

    expect(where).toMatchObject({
      AND: [
        {
          OR: expect.arrayContaining([
            { findings: { contains: "cable", mode: "insensitive" } },
            { notes: { contains: "cable", mode: "insensitive" } },
            { equipment: { displayName: { contains: "cable", mode: "insensitive" } } },
          ]),
        },
      ],
    });
  });
});
