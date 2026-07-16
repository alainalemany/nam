import { describe, expect, it } from "vitest";

import {
  buildSafetyChecklistWhere,
  parseSafetyChecklistFilters,
} from "@/features/operational-safety-checklists/filters";

describe("Operational Safety Checklist filters", () => {
  it("normalizes supported URL filters and ignores invalid values", () => {
    expect(parseSafetyChecklistFilters({
      dateFrom: "2026-07-01",
      dateTo: "bad",
      equipmentId: " equipment-1 ",
      template: "DRAGLINE_INSPECTION",
      shift: "DAY",
      condition: "NEEDS_REPAIR",
      operator: " Alex ",
    })).toEqual({
      dateFrom: "2026-07-01",
      dateTo: undefined,
      equipmentId: "equipment-1",
      template: "DRAGLINE_INSPECTION",
      shift: "DAY",
      condition: "NEEDS_REPAIR",
      operator: "Alex",
      supervisor: undefined,
    });
  });

  it.each([
    ["2026-07-15", "2026-07-15"],
    ["bad", undefined],
    ["2026-02-31", undefined],
    ["2028-02-29", "2028-02-29"],
    ["2026-02-29", undefined],
  ])("normalizes filter date %s safely", (dateFrom, expected) => {
    expect(parseSafetyChecklistFilters({ dateFrom }).dateFrom).toBe(expected);
  });

  it("combines structured filters with AND and response child ownership", () => {
    expect(buildSafetyChecklistWhere({
      equipmentId: "equipment-1",
      condition: "PREVIOUSLY_NOTED",
      supervisor: "Morgan",
    })).toEqual({
      AND: [
        { equipmentId: "equipment-1" },
        { supervisorDisplayName: { contains: "Morgan", mode: "insensitive" } },
        { responses: { some: { responseCode: "PREVIOUSLY_NOTED" } } },
      ],
    });
  });
});
