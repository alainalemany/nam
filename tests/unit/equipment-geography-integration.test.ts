import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ equipmentFindMany: vi.fn(), mineFindMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    equipment: { findMany: mocks.equipmentFindMany },
    mine: { findMany: mocks.mineFindMany },
  },
}));

import { getEquipment, getEquipmentMineOptions } from "@/features/equipment/data";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.equipmentFindMany.mockResolvedValue([]);
  mocks.mineFindMany.mockResolvedValue([
    {
      id: "mine-1",
      name: "White Rock",
      type: "Quarry",
      status: "ACTIVE",
      city: {
        id: "hialeah",
        name: "Hialeah",
        state: "legacy-value",
        stateReference: { abbreviation: "FL" },
      },
    },
  ]);
});

describe("Mine and Equipment canonical geography integration", () => {
  it("keeps Mine selectors working and prefers canonical State context", async () => {
    const options = await getEquipmentMineOptions();
    expect(options[0]).toMatchObject({
      id: "mine-1",
      label: "White Rock (Hialeah, FL)",
      cityLabel: "Hialeah, FL",
    });
    expect(mocks.mineFindMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { city: { include: { stateReference: true } } },
    }));
  });

  it("loads Equipment with the same canonical City/State relation", async () => {
    await getEquipment();
    expect(mocks.equipmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { mine: { include: { city: { include: { stateReference: true } } } } },
    }));
  });
});
