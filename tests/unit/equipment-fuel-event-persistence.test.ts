import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  equipmentFuelEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  equipmentFuelEventTankFill: { deleteMany: vi.fn(), createMany: vi.fn() },
  equipment: { findUnique: vi.fn() },
  gasStation: { findUnique: vi.fn() },
  fuelServicePerson: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  dailyLogActivity: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
    fuelServicePerson: { create: vi.fn(), update: vi.fn() },
  },
}));

import { calculateFuelEventTotals, persistEquipmentFuelEvent } from "@/features/equipment-fuel-events/persistence";
import { equipmentFuelEventCorrectionSchema, equipmentFuelEventSubmissionSchema } from "@/features/equipment-fuel-events/validation";

const equipment = {
  id: "equipment-1", displayName: "Dragline 1", equipmentNumber: "DL-1", category: "DRAGLINE" as const,
  powerType: "DIESEL" as const, status: "ACTIVE" as const,
  mine: { name: "Mine A", city: { name: "City A", state: "FL" } },
};

const station = {
  id: "station-1",
  name: "Wawa",
  address: "123 Main St",
  postalCode: "33010",
  isActive: true,
  city: { name: "Hialeah", state: "FL" },
};

function input(overrides: Record<string, unknown> = {}) {
  return equipmentFuelEventSubmissionSchema.parse({
    operationalWorkDate: "2026-07-15", eventTime: "23:45", equipmentId: "equipment-1",
    fuelType: "OFF_ROAD_DIESEL", gasStationId: "station-1", pricePerGallon: "3.457",
    meterType: "HOURS", meterReading: "1204.5", receiptReference: "R-100", notes: "Context",
    tankFills: [{ sequence: 1, tankLabel: " Main   Tank ", gallons: "390" }, { sequence: 2, tankLabel: "Walking Engine", gallons: "79" }],
    ...overrides,
  });
}

function legacyInput(overrides: Record<string, unknown> = {}) {
  return equipmentFuelEventCorrectionSchema.parse({
    operationalWorkDate: "2026-07-15", eventTime: "23:45", equipmentId: "equipment-1",
    fuelType: "OFF_ROAD_DIESEL", gasStationId: "", pricePerGallon: "", meterType: "", meterReading: "",
    receiptReference: "", notes: "Context",
    tankFills: [{ sequence: 1, tankLabel: "Main Tank", gallons: "390" }],
    ...overrides,
  });
}

function existing(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1", operationalWorkDate: new Date("2026-07-15T00:00:00Z"), eventTime: "23:45",
    equipmentId: "equipment-1", equipmentDisplayName: "Historic Dragline", equipmentNumber: "OLD-1", equipmentCategory: "DRAGLINE",
    mineName: "Historic Mine", cityName: "Historic City", cityState: "WY", fuelType: "OFF_ROAD_DIESEL",
    totalGallons: new Prisma.Decimal(400), gasStationId: null, gasStationNameSnapshot: null,
    gasStationAddressSnapshot: null, gasStationCitySnapshot: null, gasStationStateSnapshot: null,
    gasStationPostalCodeSnapshot: null, pricePerGallon: null, totalCost: null, meterType: null,
    meterReading: null, receiptReference: null,
    fuelServicePersonId: "person-1", fuelServicePersonDisplayNameSnapshot: "Historic Pat",
    dailyLogActivityId: "activity-1", notes: null,
    createdAt: new Date(), updatedAt: new Date(), tankFills: [], ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.equipment.findUnique.mockResolvedValue(equipment);
  tx.gasStation.findUnique.mockResolvedValue(station);
  tx.equipmentFuelEvent.create.mockResolvedValue({ id: "event-1" });
  tx.equipmentFuelEvent.update.mockResolvedValue({ id: "event-1" });
  tx.equipmentFuelEventTankFill.deleteMany.mockResolvedValue({ count: 2 });
  tx.equipmentFuelEventTankFill.createMany.mockResolvedValue({ count: 2 });
});

describe("Equipment Fuel Event persistence", () => {
  it("creates one V2 aggregate with station snapshots, exact totals, and null legacy links", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(undefined);
    await persistEquipmentFuelEvent(input());
    const data = tx.equipmentFuelEvent.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      equipmentDisplayName: "Dragline 1",
      gasStationId: "station-1",
      gasStationNameSnapshot: "Wawa",
      gasStationAddressSnapshot: "123 Main St",
      gasStationCitySnapshot: "Hialeah",
      gasStationStateSnapshot: "FL",
      pricePerGallon: expect.any(Prisma.Decimal),
      meterType: "HOURS",
      receiptReference: "R-100",
      fuelServicePersonId: null,
      fuelServicePersonDisplayNameSnapshot: null,
      dailyLogActivityId: null,
    });
    expect(data.totalGallons.toString()).toBe("469");
    expect(data.totalCost.toString()).toBe("1621.33");
    expect(data.tankFills.create.map((fill: { gallons: Prisma.Decimal }) => fill.gallons.toString())).toEqual(["390", "79"]);
  });

  it("calculates multiple fractional fills and half-up monetary rounding authoritatively", () => {
    const exact = calculateFuelEventTotals(input({
      pricePerGallon: "5.000",
      tankFills: [{ sequence: 1, tankLabel: "Main", gallons: "0.001" }],
    }));
    expect(exact.totalGallons.toString()).toBe("0.001");
    expect(exact.totalCost?.toFixed(2)).toBe("0.01");

    const multiple = calculateFuelEventTotals(input({
      pricePerGallon: "3.333",
      tankFills: [
        { sequence: 1, tankLabel: "Main", gallons: "12.347" },
        { sequence: 2, tankLabel: "Aux", gallons: "0.153" },
      ],
    }));
    expect(multiple.totalGallons.toString()).toBe("12.5");
    expect(multiple.totalCost?.toFixed(2)).toBe("41.66");
  });

  it("preserves hidden legacy person snapshot and Daily Log link during legacy correction", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(existing());
    tx.equipment.findUnique.mockResolvedValue({ ...equipment, status: "INACTIVE", displayName: "Renamed Dragline" });
    await persistEquipmentFuelEvent(legacyInput(), "event-1");
    const updateData = tx.equipmentFuelEvent.update.mock.calls[0][0].data;
    expect(updateData).toMatchObject({ equipmentDisplayName: "Historic Dragline", gasStationId: null, totalCost: null });
    expect(updateData).not.toHaveProperty("fuelServicePersonId");
    expect(updateData).not.toHaveProperty("fuelServicePersonDisplayNameSnapshot");
    expect(updateData).not.toHaveProperty("dailyLogActivityId");
  });

  it("preserves unchanged inactive historical station and station snapshots", async () => {
    const historic = existing({
      gasStationId: "station-1", gasStationNameSnapshot: "Historic Wawa",
      gasStationAddressSnapshot: "Old address", gasStationCitySnapshot: "Old City",
      gasStationStateSnapshot: "FL", gasStationPostalCodeSnapshot: "33000",
      pricePerGallon: new Prisma.Decimal("3.457"), totalCost: new Prisma.Decimal("1621.33"),
      meterType: "HOURS", meterReading: new Prisma.Decimal("1204.5"),
    });
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(historic);
    tx.gasStation.findUnique.mockResolvedValue({ ...station, isActive: false, name: "Renamed" });
    await persistEquipmentFuelEvent(input(), "event-1");
    expect(tx.equipmentFuelEvent.update.mock.calls[0][0].data).toMatchObject({
      gasStationNameSnapshot: "Historic Wawa",
      gasStationAddressSnapshot: "Old address",
    });
  });

  it("rejects an inactive station for a new event or changed station", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(undefined);
    tx.gasStation.findUnique.mockResolvedValue({ ...station, isActive: false });
    await expect(persistEquipmentFuelEvent(input())).rejects.toMatchObject({ field: "gasStationId" });
  });

  it("refreshes Equipment snapshots and replaces stale fills transactionally", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(existing());
    tx.equipment.findUnique.mockResolvedValue({ ...equipment, id: "equipment-2", displayName: "Replacement Tractor", category: "TRACTOR" });
    await persistEquipmentFuelEvent(legacyInput({ equipmentId: "equipment-2" }), "event-1");
    expect(tx.equipmentFuelEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ equipmentId: "equipment-2", equipmentDisplayName: "Replacement Tractor" }) }));
    expect(tx.equipmentFuelEventTankFill.deleteMany).toHaveBeenCalledWith({ where: { equipmentFuelEventId: "event-1" } });
    expect(tx.equipmentFuelEventTankFill.createMany).toHaveBeenCalled();
  });

  it("requires active Equipment for creation or replacement but permits unchanged inactive Equipment", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(undefined);
    tx.equipment.findUnique.mockResolvedValue({ ...equipment, status: "INACTIVE" });
    await expect(persistEquipmentFuelEvent(input())).rejects.toMatchObject({ field: "equipmentId" });
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(existing());
    await expect(persistEquipmentFuelEvent(legacyInput(), "event-1")).resolves.toEqual({ id: "event-1" });
  });

  it("rejects electric and contradictory fuel combinations", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(undefined);
    tx.equipment.findUnique.mockResolvedValue({ ...equipment, powerType: "ELECTRIC" });
    await expect(persistEquipmentFuelEvent(input())).rejects.toMatchObject({ field: "fuelType" });
    tx.equipment.findUnique.mockResolvedValue({ ...equipment, powerType: "GASOLINE" });
    await expect(persistEquipmentFuelEvent(input())).rejects.toMatchObject({ field: "fuelType" });
  });
});
