import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  equipmentFuelEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  equipmentFuelEventTankFill: { deleteMany: vi.fn(), createMany: vi.fn() },
  equipment: { findUnique: vi.fn() },
  fuelServicePerson: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  dailyLogActivity: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
    fuelServicePerson: { create: vi.fn(), update: vi.fn() },
  },
}));

import { persistEquipmentFuelEvent } from "@/features/equipment-fuel-events/persistence";
import { equipmentFuelEventSubmissionSchema } from "@/features/equipment-fuel-events/validation";

const equipment = {
  id: "equipment-1", displayName: "Dragline 1", equipmentNumber: "DL-1", category: "DRAGLINE" as const,
  powerType: "DIESEL" as const, status: "ACTIVE" as const,
  mine: { name: "Mine A", city: { name: "City A", state: "FL" } },
};

function input(overrides: Record<string, unknown> = {}) {
  return equipmentFuelEventSubmissionSchema.parse({
    operationalWorkDate: "2026-07-15", eventTime: "23:45", equipmentId: "equipment-1",
    fuelType: "OFF_ROAD_DIESEL", fuelServicePersonId: "person-1", dailyLogActivityId: "activity-1", notes: "Context",
    tankFills: [{ sequence: 1, tankLabel: " Main   Tank ", gallons: "390" }, { sequence: 2, tankLabel: "Walking Engine", gallons: "79" }],
    ...overrides,
  });
}

function existing(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1", operationalWorkDate: new Date("2026-07-15T00:00:00Z"), eventTime: "23:45",
    equipmentId: "equipment-1", equipmentDisplayName: "Historic Dragline", equipmentNumber: "OLD-1", equipmentCategory: "DRAGLINE",
    mineName: "Historic Mine", cityName: "Historic City", cityState: "WY", fuelType: "OFF_ROAD_DIESEL", totalGallons: 400,
    fuelServicePersonId: "person-1", fuelServicePersonDisplayNameSnapshot: "Historic Pat", dailyLogActivityId: "activity-1", notes: null,
    createdAt: new Date(), updatedAt: new Date(), tankFills: [], ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.equipment.findUnique.mockResolvedValue(equipment);
  tx.fuelServicePerson.findUnique.mockResolvedValue({ id: "person-1", displayName: "Current Pat", normalizedKey: "current pat", active: true });
  tx.dailyLogActivity.findUnique.mockResolvedValue({ id: "activity-1", activityType: "FUEL_SERVICE", activityDate: new Date("2026-07-15T00:00:00Z"), equipmentId: "equipment-1" });
  tx.equipmentFuelEvent.create.mockResolvedValue({ id: "event-1" });
  tx.equipmentFuelEvent.update.mockResolvedValue({ id: "event-1" });
  tx.equipmentFuelEventTankFill.deleteMany.mockResolvedValue({ count: 2 });
  tx.equipmentFuelEventTankFill.createMany.mockResolvedValue({ count: 2 });
});

describe("Equipment Fuel Event persistence", () => {
  it("creates one complete aggregate with server-owned snapshots, normalized labels, and derived total", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(undefined);
    await persistEquipmentFuelEvent(input());
    expect(tx.equipmentFuelEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      equipmentDisplayName: "Dragline 1", mineName: "Mine A", cityName: "City A", totalGallons: 469,
      fuelServicePersonDisplayNameSnapshot: "Current Pat",
      tankFills: { create: [{ sequence: 1, tankLabel: "Main Tank", normalizedTankLabel: "main tank", gallons: 390 }, { sequence: 2, tankLabel: "Walking Engine", normalizedTankLabel: "walking engine", gallons: 79 }] },
    }) }));
  });

  it("allows repeated same-day and identical-time events because no business-key lookup occurs", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(undefined);
    await persistEquipmentFuelEvent(input());
    await persistEquipmentFuelEvent(input());
    expect(tx.equipmentFuelEvent.create).toHaveBeenCalledTimes(2);
  });

  it("preserves unchanged historical Equipment and inactive-person snapshots", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(existing());
    tx.equipment.findUnique.mockResolvedValue({ ...equipment, status: "INACTIVE", displayName: "Renamed Dragline" });
    tx.fuelServicePerson.findUnique.mockResolvedValue({ id: "person-1", displayName: "Renamed Pat", active: false });
    await persistEquipmentFuelEvent(input(), "event-1");
    expect(tx.equipmentFuelEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ equipmentDisplayName: "Historic Dragline", mineName: "Historic Mine", fuelServicePersonDisplayNameSnapshot: "Historic Pat" }) }));
  });

  it("requires an active replacement person and refreshes only the person snapshot", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(existing());
    tx.fuelServicePerson.findUnique.mockResolvedValue({ id: "person-2", displayName: "New Pat", normalizedKey: "new pat", active: false });
    await expect(persistEquipmentFuelEvent(input({ fuelServicePersonId: "person-2" }), "event-1")).rejects.toMatchObject({ field: "fuelServicePersonId" });
    tx.fuelServicePerson.findUnique.mockResolvedValue({ id: "person-2", displayName: "New Pat", normalizedKey: "new pat", active: true });
    await persistEquipmentFuelEvent(input({ fuelServicePersonId: "person-2" }), "event-1");
    expect(tx.equipmentFuelEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      equipmentDisplayName: "Historic Dragline",
      fuelServicePersonId: "person-2",
      fuelServicePersonDisplayNameSnapshot: "New Pat",
    }) }));
  });

  it("refreshes snapshots and replaces stale fills transactionally after Equipment changes", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(existing());
    tx.equipment.findUnique.mockResolvedValue({ ...equipment, id: "equipment-2", displayName: "Replacement Tractor", category: "TRACTOR" });
    tx.dailyLogActivity.findUnique.mockResolvedValue(null);
    await persistEquipmentFuelEvent(input({ equipmentId: "equipment-2", dailyLogActivityId: "" }), "event-1");
    expect(tx.equipmentFuelEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ equipmentId: "equipment-2", equipmentDisplayName: "Replacement Tractor", mineName: "Mine A" }) }));
    expect(tx.equipmentFuelEventTankFill.deleteMany).toHaveBeenCalledWith({ where: { equipmentFuelEventId: "event-1" } });
    expect(tx.equipmentFuelEventTankFill.createMany).toHaveBeenCalled();
  });

  it("requires active Equipment for creation or replacement but permits unchanged inactive Equipment", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(undefined);
    tx.equipment.findUnique.mockResolvedValue({ ...equipment, status: "INACTIVE" });
    await expect(persistEquipmentFuelEvent(input())).rejects.toMatchObject({ field: "equipmentId" });
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(existing());
    await expect(persistEquipmentFuelEvent(input(), "event-1")).resolves.toEqual({ id: "event-1" });
  });

  it("rejects electric and contradictory fuel combinations", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(undefined);
    tx.equipment.findUnique.mockResolvedValue({ ...equipment, powerType: "ELECTRIC" });
    await expect(persistEquipmentFuelEvent(input())).rejects.toMatchObject({ field: "fuelType" });
    tx.equipment.findUnique.mockResolvedValue({ ...equipment, powerType: "GASOLINE" });
    await expect(persistEquipmentFuelEvent(input())).rejects.toMatchObject({ field: "fuelType" });
  });

  it("validates Daily Work Log type, date, and Equipment without mutating it", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(undefined);
    tx.dailyLogActivity.findUnique.mockResolvedValue({ id: "activity-1", activityType: "CUT", activityDate: new Date("2026-07-15T00:00:00Z"), equipmentId: "equipment-1" });
    await expect(persistEquipmentFuelEvent(input())).rejects.toMatchObject({ field: "dailyLogActivityId" });
    tx.dailyLogActivity.findUnique.mockResolvedValue({ id: "activity-1", activityType: "FUEL_SERVICE", activityDate: new Date("2026-07-16T00:00:00Z"), equipmentId: "equipment-1" });
    await expect(persistEquipmentFuelEvent(input())).rejects.toMatchObject({ field: "dailyLogActivityId" });
    tx.dailyLogActivity.findUnique.mockResolvedValue({ id: "activity-1", activityType: "FUEL_SERVICE", activityDate: new Date("2026-07-15T00:00:00Z"), equipmentId: "equipment-2" });
    await expect(persistEquipmentFuelEvent(input())).rejects.toMatchObject({ field: "dailyLogActivityId" });
    expect(tx.dailyLogActivity).not.toHaveProperty("update");
  });

  it("creates an inline person in the event transaction and rejects an equivalent duplicate", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(undefined);
    tx.fuelServicePerson.findUnique.mockResolvedValue(null);
    tx.fuelServicePerson.create.mockResolvedValue({ id: "person-new", displayName: "Pat Smith", normalizedKey: "pat smith", active: true });
    await persistEquipmentFuelEvent(input({ fuelServicePersonId: "", newFuelServicePersonDisplayName: " Pat   Smith " }));
    expect(tx.fuelServicePerson.create).toHaveBeenCalledWith({ data: { displayName: "Pat Smith", normalizedKey: "pat smith", active: true } });
    tx.fuelServicePerson.findUnique.mockResolvedValue({ id: "person-existing", active: true });
    await expect(persistEquipmentFuelEvent(input({ fuelServicePersonId: "", newFuelServicePersonDisplayName: "PAT SMITH" }))).rejects.toMatchObject({ field: "newFuelServicePersonDisplayName" });
  });

  it("requires a current active replacement after Equipment SetNull", async () => {
    tx.equipmentFuelEvent.findUnique.mockResolvedValue(existing({ equipmentId: null }));
    tx.equipment.findUnique.mockResolvedValue({ ...equipment, id: "equipment-2", status: "INACTIVE" });
    await expect(persistEquipmentFuelEvent(input({ equipmentId: "equipment-2", dailyLogActivityId: "" }), "event-1")).rejects.toMatchObject({ field: "equipmentId" });
  });
});
