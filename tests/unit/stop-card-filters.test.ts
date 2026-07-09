import { describe, expect, it } from "vitest";

import {
  buildStopCardWhere,
  hasStopCardFilters,
  parseStopCardFilters,
  stopCardFilterHref,
} from "@/features/stop-cards/filters";

describe("parseStopCardFilters", () => {
  it("normalizes supported STOP Card filter values", () => {
    const filters = parseStopCardFilters({
      q: "  barricade  ",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      mineId: " mine-1 ",
      equipmentId: "equipment-1",
      category: "NEAR_MISS",
      severity: "HIGH",
      status: "IN_PROGRESS",
    });

    expect(filters).toEqual({
      q: "barricade",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      mineId: "mine-1",
      equipmentId: "equipment-1",
      category: "NEAR_MISS",
      severity: "HIGH",
      status: "IN_PROGRESS",
    });
    expect(hasStopCardFilters(filters)).toBe(true);
  });

  it("drops unsupported enum values and malformed dates", () => {
    const filters = parseStopCardFilters({
      dateFrom: "07/01/2026",
      dateTo: "not-a-date",
      category: "SAFETY",
      severity: "URGENT",
      status: "DONE",
    });

    expect(filters).toEqual({
      q: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      mineId: undefined,
      equipmentId: undefined,
      category: undefined,
      severity: undefined,
      status: undefined,
    });
    expect(hasStopCardFilters(filters)).toBe(false);
  });
});

describe("stopCardFilterHref", () => {
  it("builds STOP Card filter links while preserving active filters", () => {
    const href = stopCardFilterHref(
      {
        q: "hazard",
        dateFrom: "2026-07-08",
        dateTo: "2026-07-08",
        status: "OPEN",
      },
      {
        status: "CLOSED",
        severity: "HIGH",
      },
    );

    expect(href).toBe(
      "/stop-cards?q=hazard&dateFrom=2026-07-08&dateTo=2026-07-08&status=CLOSED&severity=HIGH",
    );
  });
});

describe("buildStopCardWhere", () => {
  it("builds server-side filters for date, mine, equipment, category, severity, and status", () => {
    const where = buildStopCardWhere({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      mineId: "mine-1",
      equipmentId: "equipment-1",
      category: "NEAR_MISS",
      severity: "HIGH",
      status: "OPEN",
    });

    expect(where).toMatchObject({
      AND: [
        {
          observationDate: {
            gte: new Date("2026-07-01T00:00:00.000Z"),
            lte: new Date("2026-07-08T00:00:00.000Z"),
          },
        },
        { category: "NEAR_MISS" },
        { severity: "HIGH" },
        { status: "OPEN" },
        { mineId: "mine-1" },
        { equipmentId: "equipment-1" },
      ],
    });
  });

  it("searches text across STOP Card narrative and reference fields", () => {
    const where = buildStopCardWhere({
      q: "contractor",
    });

    expect(where).toMatchObject({
      AND: [
        {
          OR: expect.arrayContaining([
            { description: { contains: "contractor", mode: "insensitive" } },
            { correctiveAction: { contains: "contractor", mode: "insensitive" } },
            { location: { contains: "contractor", mode: "insensitive" } },
            { createdBy: { contains: "contractor", mode: "insensitive" } },
            { equipment: { displayName: { contains: "contractor", mode: "insensitive" } } },
          ]),
        },
      ],
    });
  });
});
