import { describe, expect, it } from "vitest";

import { lakeFormSchema } from "@/features/dragline-delay-reports/lake-validation";
import { filterDraglineLakesForMine } from "@/features/dragline-delay-reports/lakes";

describe("Dragline Lake references", () => {
  const lakes = [
    { id: "a", mineId: "mine-1", name: "Lake 1", status: "ACTIVE" as const },
    { id: "b", mineId: "mine-1", name: "Old Lake", status: "INACTIVE" as const },
    { id: "c", mineId: "mine-2", name: "Other Lake", status: "ACTIVE" as const },
  ];

  it("shows active Lakes only for the Equipment Mine and retains the selected historical Lake", () => {
    expect(filterDraglineLakesForMine(lakes, "mine-1").map((lake) => lake.id)).toEqual(["a"]);
    expect(
      filterDraglineLakesForMine(lakes, "mine-1", "b").map((lake) => lake.id),
    ).toEqual(["a", "b"]);
    expect(filterDraglineLakesForMine(lakes, "mine-2").map((lake) => lake.id)).toEqual(["c"]);
  });

  it("validates the smallest canonical Lake record", () => {
    expect(
      lakeFormSchema.parse({ mineId: "mine-1", name: " Lake 12 ", status: "ACTIVE", notes: "" }),
    ).toEqual({ mineId: "mine-1", name: "Lake 12", status: "ACTIVE", notes: undefined });
    expect(lakeFormSchema.safeParse({ mineId: "", name: "", status: "ACTIVE" }).success).toBe(false);
  });
});
