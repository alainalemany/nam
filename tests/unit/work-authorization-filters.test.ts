import { describe, expect, it } from "vitest";

import {
  buildWorkAuthorizationWhere,
  hasWorkAuthorizationFilters,
  parseWorkAuthorizationFilters,
} from "@/features/work-authorizations/filters";

describe("parseWorkAuthorizationFilters", () => {
  it("normalizes supported Work Authorization filter values", () => {
    const filters = parseWorkAuthorizationFilters({
      q: "  lockout  ",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: " equipment-1 ",
      status: "OPEN",
      workType: "LOCKOUT_TAGOUT",
    });

    expect(filters).toEqual({
      q: "lockout",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: "equipment-1",
      status: "OPEN",
      workType: "LOCKOUT_TAGOUT",
    });
    expect(hasWorkAuthorizationFilters(filters)).toBe(true);
  });

  it("drops unsupported enum values, malformed dates, and empty text", () => {
    const filters = parseWorkAuthorizationFilters({
      q: " ",
      dateFrom: "07/01/2026",
      dateTo: "not-a-date",
      status: "RESOLVED",
      workType: "INSPECTION",
    });

    expect(filters).toEqual({
      q: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      equipmentId: undefined,
      status: undefined,
      workType: undefined,
    });
    expect(hasWorkAuthorizationFilters(filters)).toBe(false);
  });
});

describe("buildWorkAuthorizationWhere", () => {
  it("builds server-side filters for date through Shift Report, equipment, status, and work type", () => {
    const where = buildWorkAuthorizationWhere({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-08",
      equipmentId: "equipment-1",
      status: "CLOSED",
      workType: "HOT_WORK",
    });

    expect(where).toMatchObject({
      AND: [
        {
          shiftReport: {
            reportDate: {
              gte: new Date("2026-07-01T00:00:00.000Z"),
              lte: new Date("2026-07-08T00:00:00.000Z"),
            },
          },
        },
        { equipmentId: "equipment-1" },
        { status: "CLOSED" },
        { workType: "HOT_WORK" },
      ],
    });
  });

  it("supports one-sided parent Shift Report date filters", () => {
    expect(buildWorkAuthorizationWhere({ dateFrom: "2026-07-01" })).toMatchObject({
      AND: [
        {
          shiftReport: {
            reportDate: { gte: new Date("2026-07-01T00:00:00.000Z") },
          },
        },
      ],
    });
    expect(buildWorkAuthorizationWhere({ dateTo: "2026-07-08" })).toMatchObject({
      AND: [
        {
          shiftReport: {
            reportDate: { lte: new Date("2026-07-08T00:00:00.000Z") },
          },
        },
      ],
    });
  });

  it("searches text across Work Authorization narrative and equipment fields", () => {
    const where = buildWorkAuthorizationWhere({ q: "guard" });

    expect(where).toMatchObject({
      AND: [
        {
          OR: expect.arrayContaining([
            { workDescription: { contains: "guard", mode: "insensitive" } },
            { jobLocation: { contains: "guard", mode: "insensitive" } },
            { contactName: { contains: "guard", mode: "insensitive" } },
            { equipmentRequired: { contains: "guard", mode: "insensitive" } },
            { personInChargeName: { contains: "guard", mode: "insensitive" } },
            { completionNotes: { contains: "guard", mode: "insensitive" } },
            { equipment: { displayName: { contains: "guard", mode: "insensitive" } } },
          ]),
        },
      ],
    });
  });
});
