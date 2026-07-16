import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ persist: vi.fn(), savePerson: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((href: string) => { throw new Error(`redirect:${href}`); }) }));
vi.mock("@/features/equipment-fuel-events/persistence", async () => {
  const actual = await vi.importActual<typeof import("@/features/equipment-fuel-events/persistence")>("@/features/equipment-fuel-events/persistence");
  return { ...actual, persistEquipmentFuelEvent: mocks.persist, saveFuelServicePersonReference: mocks.savePerson };
});

import { correctEquipmentFuelEventAction, createEquipmentFuelEventAction, saveFuelServicePersonAction } from "@/features/equipment-fuel-events/actions";
import { EquipmentFuelPersistenceError } from "@/features/equipment-fuel-events/persistence";
import { emptyEquipmentFuelActionState } from "@/features/equipment-fuel-events/validation";

function formData(overrides: Record<string, unknown> = {}) {
  const data = new FormData();
  data.set("payload", JSON.stringify({ operationalWorkDate: "2026-07-15", eventTime: "23:45", equipmentId: "equipment-1", fuelType: "DIESEL", fuelServicePersonId: "", newFuelServicePersonDisplayName: "", dailyLogActivityId: "", notes: "", tankFills: [{ sequence: 1, tankLabel: "Main Tank", gallons: "390" }], ...overrides }));
  return data;
}

describe("Equipment Fuel Event Server Actions", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.persist.mockResolvedValue({ id: "event-1" }); mocks.savePerson.mockResolvedValue({ id: "person-1" }); });

  it("creates and corrects only through feature-owned aggregate persistence", async () => {
    await expect(createEquipmentFuelEventAction(emptyEquipmentFuelActionState, formData())).rejects.toThrow("redirect:/equipment-fuel-events/event-1");
    expect(mocks.persist).toHaveBeenCalledWith(expect.objectContaining({ operationalWorkDate: "2026-07-15", tankFills: [{ sequence: 1, tankLabel: "Main Tank", gallons: 390 }] }));
    await expect(correctEquipmentFuelEventAction("event-1", emptyEquipmentFuelActionState, formData())).rejects.toThrow("redirect:/equipment-fuel-events/event-1");
    expect(mocks.persist).toHaveBeenLastCalledWith(expect.any(Object), "event-1");
  });

  it("returns field-level validation and never persists malformed aggregates", async () => {
    const result = await createEquipmentFuelEventAction(emptyEquipmentFuelActionState, formData({ eventTime: "24:00", tankFills: [] }));
    expect(result.status).toBe("error");
    expect(result.fieldErrors.eventTime).toBeDefined();
    expect(result.fieldErrors.tankFills).toBeDefined();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("returns safe one-to-one Daily Work Log and person uniqueness feedback", async () => {
    mocks.persist.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Unique", { code: "P2002", clientVersion: "test", meta: { target: "FuelEvent_dailyLogActivity_key" } }));
    const activityResult = await createEquipmentFuelEventAction(emptyEquipmentFuelActionState, formData());
    expect(activityResult.fieldErrors.dailyLogActivityId).toBeDefined();
    mocks.persist.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Unique", { code: "P2002", clientVersion: "test", meta: { target: "FuelServicePerson_normalizedKey_key" } }));
    const personResult = await createEquipmentFuelEventAction(emptyEquipmentFuelActionState, formData({ newFuelServicePersonDisplayName: "Pat Smith" }));
    expect(personResult.fieldErrors.newFuelServicePersonDisplayName).toBeDefined();
  });

  it("maps server-owned Daily Log compatibility failures to the selector", async () => {
    mocks.persist.mockRejectedValueOnce(new EquipmentFuelPersistenceError(
      "The linked Daily Work Log activity must use the same operational work date.",
      "dailyLogActivityId",
    ));
    const result = await createEquipmentFuelEventAction(emptyEquipmentFuelActionState, formData());
    expect(result.fieldErrors.dailyLogActivityId).toEqual([
      "The linked Daily Work Log activity must use the same operational work date.",
    ]);
  });

  it("manages Fuel Service Person inactivation without exposing deletion", async () => {
    const data = new FormData(); data.set("displayName", " Pat   Smith ");
    const result = await saveFuelServicePersonAction("person-1", { ok: true, message: "" }, data);
    expect(result).toEqual({ ok: true, message: "Fuel Service Person saved." });
    expect(mocks.savePerson).toHaveBeenCalledWith({ displayName: "Pat Smith", active: false }, "person-1");
  });
});
