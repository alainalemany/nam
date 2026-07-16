import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activityFindMany: vi.fn(),
  fillFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dailyLogActivity: { findMany: mocks.activityFindMany },
    equipmentFuelEventTankFill: { findMany: mocks.fillFindMany },
  },
}));

import {
  getEquipmentFuelFormContext,
  getFuelDailyLogActivityOptions,
  getTankLabelSuggestionsForEquipment,
} from "@/features/equipment-fuel-events/data";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activityFindMany.mockResolvedValue([]);
  mocks.fillFindMany.mockResolvedValue([]);
});

describe("Equipment Fuel Event scoped form lookups", () => {
  it("returns no Daily Log activities without valid date and Equipment context", async () => {
    await expect(getFuelDailyLogActivityOptions({ operationalWorkDate: "", equipmentId: "" })).resolves.toEqual([]);
    await expect(getFuelDailyLogActivityOptions({ operationalWorkDate: "2026-02-31", equipmentId: "equipment-a" })).resolves.toEqual([]);
    expect(mocks.activityFindMany).not.toHaveBeenCalled();
  });

  it("scopes matching unlinked activities by date and noncontradictory Equipment before limiting", async () => {
    mocks.activityFindMany.mockResolvedValue([
      { id: "matching", activityDate: new Date("2026-07-15T00:00:00Z"), startTime: "08:00", sequence: 2, title: "Fueling", equipmentId: "equipment-a", equipment: { displayName: "Dragline A" } },
      { id: "no-equipment", activityDate: new Date("2026-07-15T00:00:00Z"), startTime: "09:00", sequence: 3, title: "Fueling", equipmentId: null, equipment: null },
    ]);
    const result = await getFuelDailyLogActivityOptions({ operationalWorkDate: "2026-07-15", equipmentId: "equipment-a" });
    expect(result.map((item) => item.id)).toEqual(["matching", "no-equipment"]);
    expect(mocks.activityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        activityType: "FUEL_SERVICE",
        activityDate: new Date("2026-07-15T00:00:00.000Z"),
        AND: [
          { OR: [{ equipmentId: null }, { equipmentId: "equipment-a" }] },
          { OR: [{ equipmentFuelEvent: null }] },
        ],
      }),
      orderBy: [{ startTime: "asc" }, { sequence: "asc" }, { id: "asc" }],
      take: 100,
    }));
  });

  it("retains only the current event's linked activity during correction", async () => {
    await getFuelDailyLogActivityOptions({ operationalWorkDate: "2026-07-15", equipmentId: "equipment-a", currentEventId: "event-current" });
    expect(mocks.activityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { OR: [{ equipmentFuelEvent: null }, { equipmentFuelEvent: { id: "event-current" } }] },
        ]),
      }),
    }));
  });

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

  it("keeps older matching context discoverable because unrelated history is excluded before the bound", async () => {
    mocks.activityFindMany.mockResolvedValue([{ id: "older-match", activityDate: new Date("2025-01-01T00:00:00Z"), startTime: "07:00", sequence: 1, title: "Fueling", equipmentId: "equipment-a", equipment: null }]);
    expect((await getFuelDailyLogActivityOptions({ operationalWorkDate: "2025-01-01", equipmentId: "equipment-a" }))[0]?.id).toBe("older-match");
    expect(mocks.activityFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ activityDate: new Date("2025-01-01T00:00:00Z") }), take: 100 }));
  });

  it("loads both lookup groups only after Equipment context exists", async () => {
    await expect(getEquipmentFuelFormContext({ operationalWorkDate: "2026-07-15", equipmentId: "" })).resolves.toEqual({ dailyLogActivities: [], tankLabelSuggestions: [] });
    expect(mocks.activityFindMany).not.toHaveBeenCalled();
    expect(mocks.fillFindMany).not.toHaveBeenCalled();
  });
});
