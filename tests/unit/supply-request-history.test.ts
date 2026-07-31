import { describe, expect, it } from "vitest";

import {
  buildSupplyRequestHistoryWhere,
  parseSupplyRequestHistoryFilters,
  supplyRequestHistoryPageHref,
} from "@/features/supply-requests/history-filters";

describe("Supply Request history filters", () => {
  it("normalizes every supported filter and keeps the first repeated value", () => {
    const parsed = parseSupplyRequestHistoryFilters({
      dateFrom: [" 2026-07-01 ", "2020-01-01"],
      dateTo: ["2026-07-31", "2030-01-01"],
      status: ["FULFILLED", "CANCELLED"],
      equipmentId: [" equipment-1 ", "equipment-2"],
      supervisorId: [" supervisor-1 ", "supervisor-2"],
      reference: [" sr-2026-0001 ", "SR-OTHER"],
      item: [" Pump / seal ", "other"],
      notes: [" urgent work ", "other"],
      page: ["2", "3"],
    });
    expect(parsed).toEqual({
      filters: {
        dateFrom: "2026-07-01",
        dateTo: "2026-07-31",
        status: "FULFILLED",
        equipmentId: "equipment-1",
        supervisorId: "supervisor-1",
        reference: "SR-2026-0001",
        item: "Pump / seal",
        notes: "urgent work",
        page: 2,
      },
      invalidParameters: [],
    });
  });

  it("treats blanks as absent and reports bounded invalid or unsupported parameters", () => {
    const parsed = parseSupplyRequestHistoryFilters({
      dateFrom: "2026-02-30",
      dateTo: "2026-7-01",
      status: "fulfilled",
      equipmentId: "x".repeat(101),
      supervisorId: "x".repeat(101),
      reference: "x".repeat(51),
      item: "x".repeat(201),
      notes: "x".repeat(201),
      page: "1.5",
      sort: "newest",
      ignoredBlank: "",
    });
    expect(parsed.filters).toEqual({ page: 1 });
    expect(parsed.invalidParameters).toEqual([
      "unsupported parameters",
      "dateFrom",
      "dateTo",
      "status",
      "equipmentId",
      "supervisorId",
      "reference",
      "item",
      "notes",
      "page",
    ]);
  });

  it("handles empty arrays and runtime non-string values without throwing or reflecting them", () => {
    expect(
      parseSupplyRequestHistoryFilters({
        dateFrom: [] as unknown as string[],
        status: 42 as unknown as string,
        equipmentId: { unsafe: true } as unknown as string,
        page: true as unknown as string,
      }),
    ).toEqual({
      filters: { page: 1 },
      invalidParameters: ["status", "equipmentId", "page"],
    });
  });

  it("accepts exact bounds, leap dates, reversed ranges, unknown bounded IDs, and huge safe pages", () => {
    const parsed = parseSupplyRequestHistoryFilters({
      dateFrom: "2028-02-29",
      dateTo: "2026-01-01",
      equipmentId: "e".repeat(100),
      supervisorId: "s".repeat(100),
      reference: "r".repeat(50),
      item: "i".repeat(200),
      notes: "n".repeat(200),
      page: String(Number.MAX_SAFE_INTEGER),
    });
    expect(parsed.invalidParameters).toEqual([]);
    expect(parsed.filters.dateFrom).toBe("2028-02-29");
    expect(parsed.filters.dateTo).toBe("2026-01-01");
    expect(parsed.filters.reference).toBe("R".repeat(50));
    expect(parsed.filters.page).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each(["0", "-1", "1e2", "NaN", "9007199254740992"])(
    "defaults invalid page %s to one",
    (page) => {
      expect(parseSupplyRequestHistoryFilters({ page })).toEqual({
        filters: { page: 1 },
        invalidParameters: ["page"],
      });
    },
  );

  it("builds one pointer-owned current-version predicate with AND semantics", () => {
    const where = buildSupplyRequestHistoryWhere({
      page: 1,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      status: "REQUESTED",
      equipmentId: "equipment-1",
      supervisorId: "supervisor-1",
      reference: "SR-2026-0001",
      item: "pump",
      notes: "urgent",
    });
    expect(where).toEqual({
      AND: [
        {
          currentVersion: {
            is: {
              operationalWorkDate: {
                gte: new Date("2026-07-01T00:00:00.000Z"),
                lte: new Date("2026-07-31T00:00:00.000Z"),
              },
              status: "REQUESTED",
              equipmentId: "equipment-1",
              supervisorId: "supervisor-1",
              notes: { contains: "urgent", mode: "insensitive" },
              items: {
                some: {
                  OR: [
                    { normalizedItemNumberSnapshot: { contains: "PUMP" } },
                    {
                      descriptionSnapshot: {
                        contains: "pump",
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        { namReference: "SR-2026-0001" },
      ],
    });
  });

  it("uses standard URL encoding and preserves only normalized filters", () => {
    expect(
      supplyRequestHistoryPageHref(
        {
          page: 1,
          dateFrom: "2026-12-31",
          dateTo: "2026-01-01",
          equipmentId: "unknown/equipment",
          item: "Pump & seal",
          notes: "needs #4",
        },
        3,
      ),
    ).toBe(
      "/supply-requests?dateFrom=2026-12-31&dateTo=2026-01-01&equipmentId=unknown%2Fequipment&item=Pump+%26+seal&notes=needs+%234&page=3",
    );
    expect(supplyRequestHistoryPageHref({ page: 1 }, 1)).toBe(
      "/supply-requests?page=1",
    );
  });
});
