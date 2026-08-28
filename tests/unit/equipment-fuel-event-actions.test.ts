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
  data.set("payload", JSON.stringify({ operationalWorkDate: "2026-07-15", eventTime: "23:45", equipmentId: "equipment-1", fuelType: "DIESEL", notes: "Raw notes", tankFills: [{ clientRowId: "row-a", sequence: 1, tankLabel: "Main Tank", gallons: "390" }], ...overrides }));
  return data;
}

describe("Equipment Fuel Event Server Actions", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.persist.mockResolvedValue({ id: "event-1" }); mocks.savePerson.mockResolvedValue({ id: "person-1" }); });

  it("creates and corrects only through feature-owned aggregate persistence", async () => {
    await expect(createEquipmentFuelEventAction(emptyEquipmentFuelActionState, formData({
      fuelServicePersonId: "forged-person",
      dailyLogActivityId: "forged-activity",
    }))).rejects.toThrow("redirect:/equipment-fuel-events/event-1");
    expect(mocks.persist).toHaveBeenCalledWith(expect.objectContaining({ operationalWorkDate: "2026-07-15", tankFills: [{ sequence: 1, tankLabel: "Main Tank", gallons: 390 }] }));
    expect(mocks.persist.mock.calls[0][0]).not.toHaveProperty("fuelServicePersonId");
    expect(mocks.persist.mock.calls[0][0]).not.toHaveProperty("dailyLogActivityId");
    await expect(correctEquipmentFuelEventAction("event-1", emptyEquipmentFuelActionState, formData())).rejects.toThrow("redirect:/equipment-fuel-events/event-1");
    expect(mocks.persist).toHaveBeenLastCalledWith(expect.any(Object), "event-1");
  });

  it("returns field-level validation with the complete raw submitted aggregate", async () => {
    const rawFills = [
      { clientRowId: "row-b", sequence: 1, tankLabel: "", gallons: "79" },
      { clientRowId: "row-a", sequence: 2, tankLabel: " Main   Tank ", gallons: "390" },
    ];
    const result = await createEquipmentFuelEventAction(emptyEquipmentFuelActionState, formData({
      operationalWorkDate: "2026-07-16",
      eventTime: "24:00",
      equipmentId: "equipment-2",
      fuelType: "OFF_ROAD_DIESEL",
      notes: "  preserve my spacing  ",
      tankFills: rawFills,
    }));
    expect(result.status).toBe("error");
    expect(result.fieldErrors.eventTime).toBeDefined();
    expect(result.fieldErrors["tankFills.0.tankLabel"]).toBeDefined();
    expect(result.values).toEqual({
      operationalWorkDate: "2026-07-16",
      eventTime: "24:00",
      equipmentId: "equipment-2",
      fuelType: "OFF_ROAD_DIESEL",
      notes: "  preserve my spacing  ",
      tankFills: rawFills,
    });
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("preserves the complete values for known domain persistence failures", async () => {
    mocks.persist.mockRejectedValueOnce(new EquipmentFuelPersistenceError(
      "The selected Equipment could not be found.",
      "equipmentId",
    ));
    const result = await createEquipmentFuelEventAction(emptyEquipmentFuelActionState, formData());
    expect(result.fieldErrors.equipmentId).toEqual(["The selected Equipment could not be found."]);
    expect(result.values).toMatchObject({
      operationalWorkDate: "2026-07-15",
      eventTime: "23:45",
      equipmentId: "equipment-1",
      fuelType: "DIESEL",
      notes: "Raw notes",
      tankFills: [{ clientRowId: "row-a", sequence: 1, tankLabel: "Main Tank", gallons: "390" }],
    });
  });

  it("preserves the complete values for unknown recoverable persistence failures", async () => {
    mocks.persist.mockRejectedValueOnce(new Error("temporary write failure"));
    const result = await correctEquipmentFuelEventAction("event-1", emptyEquipmentFuelActionState, formData());
    expect(result).toMatchObject({
      status: "error",
      fieldErrors: {},
      values: {
        operationalWorkDate: "2026-07-15",
        eventTime: "23:45",
        equipmentId: "equipment-1",
        fuelType: "DIESEL",
        notes: "Raw notes",
        tankFills: [{ clientRowId: "row-a", sequence: 1, tankLabel: "Main Tank", gallons: "390" }],
      },
    });
  });

  it("manages Fuel Service Person inactivation without exposing deletion", async () => {
    const data = new FormData(); data.set("displayName", " Pat   Smith ");
    const result = await saveFuelServicePersonAction("person-1", { ok: true, message: "" }, data);
    expect(result).toEqual({ ok: true, message: "Fuel Service Person saved." });
    expect(mocks.savePerson).toHaveBeenCalledWith({ displayName: "Pat Smith", active: false }, "person-1");
  });
});
