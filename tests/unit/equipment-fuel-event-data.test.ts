import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fillFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    equipmentFuelEventTankFill: { findMany: mocks.fillFindMany },
  },
}));

import { getTankLabelSuggestionsForEquipment } from "@/features/equipment-fuel-events/data";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fillFindMany.mockResolvedValue([]);
});

describe("Equipment Fuel Event scoped form lookups", () => {
  it("scopes tank-label history before limiting and deterministically preserves display labels when event timestamps tie", async () => {
    mocks.fillFindMany.mockResolvedValue([
      { tankLabel: "Main Tank" },
      { tankLabel: "main   tank" },
      { tankLabel: "Older Auxiliary" },
    ]);
    await expect(getTankLabelSuggestionsForEquipment("equipment-a")).resolves.toEqual(["Main Tank", "Older Auxiliary"]);
    expect(mocks.fillFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { equipmentFuelEvent: { equipmentId: "equipment-a" } },
      orderBy: [
        { equipmentFuelEvent: { operationalWorkDate: "desc" } },
        { equipmentFuelEvent: { createdAt: "desc" } },
        { equipmentFuelEvent: { id: "desc" } },
        { sequence: "asc" },
        { id: "asc" },
      ],
      take: 250,
    }));
  });

  it("returns no cross-Equipment labels and an empty result for empty history", async () => {
    mocks.fillFindMany.mockResolvedValueOnce([{ tankLabel: "Equipment A Tank" }]);
    expect(await getTankLabelSuggestionsForEquipment("equipment-a")).toEqual(["Equipment A Tank"]);
    expect(mocks.fillFindMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { equipmentFuelEvent: { equipmentId: "equipment-a" } } }));
    mocks.fillFindMany.mockResolvedValueOnce([]);
    await expect(getTankLabelSuggestionsForEquipment("equipment-b")).resolves.toEqual([]);
  });

  it("does not query history without Equipment context", async () => {
    await expect(getTankLabelSuggestionsForEquipment(" ")).resolves.toEqual([]);
    expect(mocks.fillFindMany).not.toHaveBeenCalled();
  });
});
