import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  gasStation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  city: { findUnique: vi.fn() },
};

const mocks = vi.hoisted(() => ({
  gasStationFindMany: vi.fn(),
  gasStationUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
    gasStation: {
      findMany: mocks.gasStationFindMany,
      update: mocks.gasStationUpdate,
    },
  },
}));

import { getEquipmentFuelGasStationOptions } from "@/features/equipment-fuel-events/data";
import { getGasStationManagementList } from "@/features/equipment-fuel-events/gas-station-data";
import { GasStationPersistenceError, gasStationNormalizedKey, saveGasStation, setGasStationActive } from "@/features/equipment-fuel-events/gas-station-persistence";
import { gasStationSubmissionSchema } from "@/features/equipment-fuel-events/gas-station-validation";

const city = { id: "city-1", name: "Hialeah", state: "FL", status: "ACTIVE" };
const station = {
  id: "station-1", name: "Wawa", normalizedKey: "wawa|123 main st|city-1|33010",
  address: "123 Main St", cityId: "city-1", postalCode: "33010", isActive: true,
  city, _count: { fuelEvents: 4 }, createdAt: new Date(), updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.city.findUnique.mockResolvedValue(city);
  tx.gasStation.findUnique.mockResolvedValue(null);
  tx.gasStation.create.mockResolvedValue(station);
  tx.gasStation.update.mockResolvedValue(station);
  mocks.gasStationFindMany.mockResolvedValue([station]);
  mocks.gasStationUpdate.mockResolvedValue(station);
});

describe("Gas Station reference data", () => {
  it("normalizes name and full location so same-brand distinct locations remain possible", () => {
    expect(gasStationNormalizedKey({
      name: " WAWA ", address: " 123   MAIN St ", cityId: "city-1", postalCode: " 33010 ",
    })).toBe("wawa|123 main st|city-1|33010");
    expect(gasStationNormalizedKey({
      name: "Wawa", address: "500 West Ave", cityId: "city-1", postalCode: "33010",
    })).not.toBe(station.normalizedKey);
  });

  it("validates the minimal reference fields without pricing or business data", () => {
    const parsed = gasStationSubmissionSchema.parse({
      name: " Wawa ", address: " 123   Main St ", cityId: "city-1", postalCode: "33010",
    });
    expect(parsed).toEqual({ name: "Wawa", address: "123 Main St", cityId: "city-1", postalCode: "33010" });
    expect(gasStationSubmissionSchema.safeParse({ name: "", address: "", cityId: "", postalCode: "" }).success).toBe(false);
  });

  it("creates and edits against an existing active City", async () => {
    const input = gasStationSubmissionSchema.parse({ name: "Wawa", address: "123 Main St", cityId: "city-1", postalCode: "33010" });
    await saveGasStation(input);
    expect(tx.gasStation.create).toHaveBeenCalledWith({ data: expect.objectContaining({ normalizedKey: station.normalizedKey, isActive: true }) });
    tx.gasStation.findUnique.mockResolvedValue({ cityId: "city-1" });
    await saveGasStation(input, "station-1");
    expect(tx.gasStation.update).toHaveBeenCalledWith({ where: { id: "station-1" }, data: expect.objectContaining({ name: "Wawa" }) });
  });

  it("rejects a new station in an inactive City and maps normalized duplicates", async () => {
    const input = gasStationSubmissionSchema.parse({ name: "Wawa", address: "123 Main St", cityId: "city-1", postalCode: "" });
    tx.city.findUnique.mockResolvedValue({ ...city, status: "INACTIVE" });
    await expect(saveGasStation(input)).rejects.toMatchObject({ field: "cityId" });
    tx.city.findUnique.mockResolvedValue(city);
    tx.gasStation.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6.19.3" }));
    await expect(saveGasStation(input)).rejects.toBeInstanceOf(GasStationPersistenceError);
  });

  it("rejects a new station in an inactive canonical State", async () => {
    const input = gasStationSubmissionSchema.parse({ name: "Wawa", address: "123 Main St", cityId: "city-1", postalCode: "" });
    tx.city.findUnique.mockResolvedValue({ ...city, stateReference: { status: "INACTIVE" } });
    await expect(saveGasStation(input)).rejects.toMatchObject({ field: "cityId" });
  });

  it("activates and inactivates without destructive delete", async () => {
    await setGasStationActive("station-1", false);
    expect(mocks.gasStationUpdate).toHaveBeenCalledWith({ where: { id: "station-1" }, data: { isActive: false } });
  });

  it("applies management search/status filters", async () => {
    await getGasStationManagementList({ q: "Hialeah", status: "inactive" });
    expect(mocks.gasStationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isActive: false, OR: expect.any(Array) }),
    }));
  });

  it("offers active stations and an explicitly selected inactive historical station", async () => {
    mocks.gasStationFindMany.mockResolvedValue([{ ...station, isActive: false }]);
    const options = await getEquipmentFuelGasStationOptions("station-1");
    expect(mocks.gasStationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ isActive: true }, { id: "station-1" }] },
    }));
    expect(options[0]).toMatchObject({ id: "station-1", isActive: false, label: expect.stringContaining("Wawa") });
  });
});
