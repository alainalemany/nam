import { describe, expect, it } from "vitest";

import {
  buildShiftReportWhere,
  hasShiftReportFilters,
  parseShiftReportFilters,
} from "@/features/shift-reports/filters";

describe("parseShiftReportFilters", () => {
  it("normalizes supported Shift Report filter values", () => {
    const filters = parseShiftReportFilters({
      q: "  west ramp  ",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: " equipment-1 ",
      shift: "NIGHT",
      status: "COMPLETED",
    });

    expect(filters).toEqual({
      q: "west ramp",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: "equipment-1",
      shift: "NIGHT",
      status: "COMPLETED",
    });
    expect(hasShiftReportFilters(filters)).toBe(true);
  });

  it("drops unsupported enum values, malformed dates, and empty text", () => {
    const filters = parseShiftReportFilters({
      q: "   ",
      dateFrom: "07/01/2026",
      dateTo: "not-a-date",
      shift: "FIRST",
      status: "OPEN",
    });

    expect(filters).toEqual({
      q: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      equipmentId: undefined,
      shift: undefined,
      status: undefined,
    });
    expect(hasShiftReportFilters(filters)).toBe(false);
  });
});

describe("buildShiftReportWhere", () => {
  it("builds server-side filters for date, shift, equipment, and status", () => {
    const where = buildShiftReportWhere({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: "equipment-1",
      shift: "DAY",
      status: "DRAFT",
    });

    expect(where).toMatchObject({
      AND: [
        {
          reportDate: {
            gte: new Date("2026-07-01T00:00:00.000Z"),
            lte: new Date("2026-07-08T00:00:00.000Z"),
          },
        },
        { shift: "DAY" },
        { equipmentId: "equipment-1" },
        { status: "DRAFT" },
      ],
    });
  });

  it("supports one-sided date filters", () => {
    expect(buildShiftReportWhere({ dateFrom: "2026-07-01" })).toMatchObject({
      AND: [{ reportDate: { gte: new Date("2026-07-01T00:00:00.000Z") } }],
    });
    expect(buildShiftReportWhere({ dateTo: "2026-07-08" })).toMatchObject({
      AND: [{ reportDate: { lte: new Date("2026-07-08T00:00:00.000Z") } }],
    });
  });

  it("searches text across Shift Report narrative and equipment fields", () => {
    const where = buildShiftReportWhere({ q: "delay" });

    expect(where).toMatchObject({
      AND: [
        {
          OR: expect.arrayContaining([
            { summary: { contains: "delay", mode: "insensitive" } },
            { operationalNotes: { contains: "delay", mode: "insensitive" } },
            { location: { contains: "delay", mode: "insensitive" } },
            { equipment: { displayName: { contains: "delay", mode: "insensitive" } } },
          ]),
        },
      ],
    });
  });
});
