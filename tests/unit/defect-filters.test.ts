import { describe, expect, it } from "vitest";

import {
  buildDefectWhere,
  hasDefectFilters,
  parseDefectFilters,
} from "@/features/defect-tracking/filters";

describe("parseDefectFilters", () => {
  it("normalizes supported Defect filter values", () => {
    const filters = parseDefectFilters({
      q: "  wire rope  ",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: " equipment-1 ",
      status: "IN_PROGRESS",
      severity: "HIGH",
      priority: "URGENT",
    });

    expect(filters).toEqual({
      q: "wire rope",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: "equipment-1",
      status: "IN_PROGRESS",
      severity: "HIGH",
      priority: "URGENT",
    });
    expect(hasDefectFilters(filters)).toBe(true);
  });

  it("drops unsupported enum values, malformed dates, and empty text", () => {
    const filters = parseDefectFilters({
      q: "   ",
      dateFrom: "07/01/2026",
      dateTo: "not-a-date",
      status: "STARTED",
      severity: "URGENT",
      priority: "CRITICAL",
    });

    expect(filters).toEqual({
      q: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      equipmentId: undefined,
      status: undefined,
      severity: undefined,
      priority: undefined,
    });
    expect(hasDefectFilters(filters)).toBe(false);
  });
});

describe("buildDefectWhere", () => {
  it("builds server-side filters for date, equipment, status, severity, and priority", () => {
    const where = buildDefectWhere({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: "equipment-1",
      status: "OPEN",
      severity: "CRITICAL",
      priority: "HIGH",
    });

    expect(where).toMatchObject({
      AND: [
        {
          reportedDate: {
            gte: new Date("2026-07-01T00:00:00.000Z"),
            lte: new Date("2026-07-08T00:00:00.000Z"),
          },
        },
        { equipmentId: "equipment-1" },
        { status: "OPEN" },
        { severity: "CRITICAL" },
        { priority: "HIGH" },
      ],
    });
  });

  it("supports one-sided date filters", () => {
    expect(buildDefectWhere({ dateFrom: "2026-07-01" })).toMatchObject({
      AND: [{ reportedDate: { gte: new Date("2026-07-01T00:00:00.000Z") } }],
    });
    expect(buildDefectWhere({ dateTo: "2026-07-08" })).toMatchObject({
      AND: [{ reportedDate: { lte: new Date("2026-07-08T00:00:00.000Z") } }],
    });
  });

  it("searches text across Defect narrative and equipment fields", () => {
    const where = buildDefectWhere({ q: "bearing" });

    expect(where).toMatchObject({
      AND: [
        {
          OR: expect.arrayContaining([
            { title: { contains: "bearing", mode: "insensitive" } },
            { description: { contains: "bearing", mode: "insensitive" } },
            { correctiveAction: { contains: "bearing", mode: "insensitive" } },
            { resolutionSummary: { contains: "bearing", mode: "insensitive" } },
            { equipment: { displayName: { contains: "bearing", mode: "insensitive" } } },
          ]),
        },
      ],
    });
  });
});
