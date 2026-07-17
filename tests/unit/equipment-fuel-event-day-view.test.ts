import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    equipmentFuelEvent: { findMany: mocks.findMany },
  },
}));

import { getEquipmentFuelEventDayViewItems } from "@/features/equipment-fuel-events/data";

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    eventTime: "08:15",
    equipmentDisplayName: "Historic Dragline",
    equipmentNumber: "133",
    fuelType: "OFF_ROAD_DIESEL",
    totalGallons: 725,
    fuelServicePersonDisplayNameSnapshot: "Historic Fueler",
    tankFills: [
      { sequence: 1, tankLabel: "Main Tank", gallons: 700 },
      { sequence: 2, tankLabel: "Auxiliary Tank", gallons: 25 },
    ],
    ...overrides,
  };
}

describe("Equipment Fuel Event Day View query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
  });

  it("returns no records for an invalid operational date", async () => {
    await expect(getEquipmentFuelEventDayViewItems("invalid")).resolves.toEqual([]);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("filters by exact work date before deterministic chronological ordering and bounds", async () => {
    await getEquipmentFuelEventDayViewItems("2026-07-16");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { operationalWorkDate: new Date("2026-07-16T00:00:00.000Z") },
      select: {
        id: true,
        eventTime: true,
        equipmentDisplayName: true,
        equipmentNumber: true,
        fuelType: true,
        totalGallons: true,
        fuelServicePersonDisplayNameSnapshot: true,
        tankFills: {
          select: { sequence: true, tankLabel: true, gallons: true },
          orderBy: [{ sequence: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ eventTime: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: 100,
    });
  });

  it("keeps repeated identical-time events distinct and uses historical snapshots", async () => {
    mocks.findMany.mockResolvedValue([
      event(),
      event({
        id: "event-2",
        equipmentDisplayName: "Deleted Work Truck",
        equipmentNumber: "WT-9",
        fuelType: "GASOLINE",
        totalGallons: 20,
        fuelServicePersonDisplayNameSnapshot: null,
        tankFills: [{ sequence: 1, tankLabel: "Vehicle Tank", gallons: 20 }],
      }),
    ]);

    await expect(getEquipmentFuelEventDayViewItems("2026-07-16")).resolves.toEqual([
      {
        id: "event-1",
        eventTime: "08:15 local",
        equipmentIdentity: "Historic Dragline #133",
        fuelType: "Off-road Diesel",
        totalGallons: "725 gal",
        tankFills: [
          { sequence: 1, summary: "Main Tank: 700 gal" },
          { sequence: 2, summary: "Auxiliary Tank: 25 gal" },
        ],
        fuelServicePerson: "Historic Fueler",
        detailHref: "/equipment-fuel-events/event-1",
      },
      expect.objectContaining({
        id: "event-2",
        eventTime: "08:15 local",
        equipmentIdentity: "Deleted Work Truck #WT-9",
        fuelServicePerson: "Not recorded",
        detailHref: "/equipment-fuel-events/event-2",
      }),
    ]);
  });

  it("returns an empty contribution for a date without fuel events", async () => {
    await expect(getEquipmentFuelEventDayViewItems("2026-07-17")).resolves.toEqual([]);
  });
});
