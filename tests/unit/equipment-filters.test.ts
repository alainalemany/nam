import { describe, expect, it } from "vitest";

import {
  buildEquipmentWhere,
  hasEquipmentFilters,
  parseEquipmentFilters,
} from "@/features/equipment/filters";

describe("Equipment filters", () => {
  it("parses and combines category, Mine, status, and search", () => {
    const filters = parseEquipmentFilters({
      category: "DRAGLINE",
      mineId: " mine-1 ",
      status: "ACTIVE",
      q: " 2100E ",
    });

    expect(filters).toEqual({
      category: "DRAGLINE",
      mineId: "mine-1",
      status: "ACTIVE",
      q: "2100E",
    });
    expect(hasEquipmentFilters(filters)).toBe(true);
    expect(buildEquipmentWhere(filters)).toEqual({
      AND: [
        {
          OR: [
            { displayName: { contains: "2100E", mode: "insensitive" } },
            { equipmentNumber: { contains: "2100E", mode: "insensitive" } },
          ],
        },
        { category: "DRAGLINE" },
        { mineId: "mine-1" },
        { status: "ACTIVE" },
      ],
    });
  });

  it("ignores unsupported filter values", () => {
    expect(
      parseEquipmentFilters({ category: "LOCOMOTIVE", status: "ARCHIVED" }),
    ).toEqual({
      category: undefined,
      mineId: undefined,
      q: undefined,
      status: undefined,
    });
    expect(hasEquipmentFilters({})).toBe(false);
    expect(buildEquipmentWhere({})).toEqual({});
  });

  it("uses the first value for repeated search parameters", () => {
    expect(
      parseEquipmentFilters({
        category: ["WORK_TRUCK", "DRAGLINE"],
        q: ["WT-12", "ignored"],
      }),
    ).toMatchObject({ category: "WORK_TRUCK", q: "WT-12" });
  });
});
