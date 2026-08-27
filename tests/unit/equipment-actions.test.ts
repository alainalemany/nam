import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  equipmentCreate: vi.fn(),
  equipmentFindFirst: vi.fn(),
  equipmentFindUnique: vi.fn(),
  equipmentUpdate: vi.fn(),
  mineFindUnique: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

import {
  createEquipmentAction,
  updateEquipmentAction,
} from "@/features/equipment/actions";
import { emptyEquipmentFormState } from "@/features/equipment/validation";

const transactionClient = {
  equipment: {
    create: mocks.equipmentCreate,
    findFirst: mocks.equipmentFindFirst,
    findUnique: mocks.equipmentFindUnique,
    update: mocks.equipmentUpdate,
  },
  mine: {
    findUnique: mocks.mineFindUnique,
  },
};

function validFormData(overrides: Record<string, string> = {}) {
  const values = {
    mineId: "mine-1",
    displayName: "Dragline 1",
    equipmentNumber: "DL-1",
    category: "DRAGLINE",
    make: "",
    model: "",
    powerType: "DIESEL",
    instrumentationType: "PHYSICAL_GAUGES",
    status: "ACTIVE",
    notes: "",
    ...overrides,
  };
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

function uniqueError(target: string | string[]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("Equipment Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (operation: (client: typeof transactionClient) => Promise<unknown>) =>
        operation(transactionClient),
    );
    mocks.redirect.mockImplementation((href: string) => {
      throw new Error(`redirect:${href}`);
    });
    mocks.mineFindUnique.mockResolvedValue({ id: "mine-1", status: "ACTIVE" });
    mocks.equipmentFindFirst.mockResolvedValue(null);
    mocks.equipmentFindUnique.mockResolvedValue({ mineId: "mine-1" });
    mocks.equipmentCreate.mockResolvedValue({ id: "equipment-1" });
    mocks.equipmentUpdate.mockResolvedValue({ id: "equipment-1" });
  });

  it("creates Equipment with the selected existing Mine ID", async () => {
    await expect(
      createEquipmentAction(emptyEquipmentFormState, validFormData()),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.mineFindUnique).toHaveBeenCalledWith({
      where: { id: "mine-1" },
      select: { id: true, status: true },
    });
    expect(mocks.equipmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mineId: "mine-1",
        displayName: "Dragline 1",
      }),
    });
    expect(transactionClient).not.toHaveProperty("city");
    expect(transactionClient.mine).not.toHaveProperty("create");
  });

  it("rejects a missing or forged Mine ID without creating Equipment", async () => {
    mocks.mineFindUnique.mockResolvedValue(null);

    const result = await createEquipmentAction(
      emptyEquipmentFormState,
      validFormData({ mineId: "missing-mine" }),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { mineId: [expect.stringMatching(/existing Mine/i)] },
    });
    expect(mocks.equipmentCreate).not.toHaveBeenCalled();
  });

  it("rejects an inactive Mine for new Equipment", async () => {
    mocks.mineFindUnique.mockResolvedValue({ id: "mine-1", status: "INACTIVE" });

    const result = await createEquipmentAction(
      emptyEquipmentFormState,
      validFormData(),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { mineId: ["Select an active Mine."] },
    });
    expect(mocks.equipmentCreate).not.toHaveBeenCalled();
  });

  it("prevents a forged inactive Mine reassignment during edit", async () => {
    mocks.equipmentFindUnique.mockResolvedValue({ mineId: "mine-current" });
    mocks.mineFindUnique.mockResolvedValue({ id: "mine-inactive", status: "INACTIVE" });

    const result = await updateEquipmentAction(
      "equipment-1",
      emptyEquipmentFormState,
      validFormData({ mineId: "mine-inactive" }),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { mineId: ["Select an active Mine."] },
    });
    expect(mocks.equipmentUpdate).not.toHaveBeenCalled();
  });

  it("preserves an unchanged inactive Mine assignment during unrelated edits", async () => {
    mocks.equipmentFindUnique.mockResolvedValue({ mineId: "mine-inactive" });
    mocks.mineFindUnique.mockResolvedValue({ id: "mine-inactive", status: "INACTIVE" });

    await expect(
      updateEquipmentAction(
        "equipment-1",
        emptyEquipmentFormState,
        validFormData({ mineId: "mine-inactive", displayName: "Renamed Dragline" }),
      ),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.equipmentUpdate).toHaveBeenCalledWith({
      where: { id: "equipment-1" },
      data: expect.objectContaining({
        mineId: "mine-inactive",
        displayName: "Renamed Dragline",
      }),
    });
  });

  it("updates Equipment to another active canonical Mine", async () => {
    mocks.equipmentFindUnique.mockResolvedValue({ mineId: "mine-current" });
    mocks.mineFindUnique.mockResolvedValue({ id: "mine-2", status: "ACTIVE" });

    await expect(
      updateEquipmentAction(
        "equipment-1",
        emptyEquipmentFormState,
        validFormData({ mineId: "mine-2" }),
      ),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.equipmentUpdate).toHaveBeenCalledWith({
      where: { id: "equipment-1" },
      data: expect.objectContaining({ mineId: "mine-2" }),
    });
  });

  it("allows duplicate display names at the same or different Mines", async () => {
    await expect(
      createEquipmentAction(
        emptyEquipmentFormState,
        validFormData({ displayName: "Tundra", equipmentNumber: "131909" }),
      ),
    ).rejects.toThrow("redirect:/equipment");

    mocks.mineFindUnique.mockResolvedValue({ id: "mine-2", status: "ACTIVE" });
    await expect(
      createEquipmentAction(
        emptyEquipmentFormState,
        validFormData({
          mineId: "mine-2",
          displayName: "Tundra",
          equipmentNumber: "132005",
        }),
      ),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.equipmentCreate).toHaveBeenCalledTimes(2);
  });

  it("rejects a duplicate non-empty Equipment Number across Mines", async () => {
    mocks.equipmentFindFirst.mockResolvedValue({
      displayName: "Tundra",
      equipmentNumber: "131909",
      mine: { name: "White Rock" },
    });

    const result = await createEquipmentAction(
      emptyEquipmentFormState,
      validFormData({ mineId: "mine-2", equipmentNumber: "131909" }),
    );

    expect(result).toMatchObject({
      status: "error",
      message: "Equipment #131909 already exists as Tundra at White Rock.",
      fieldErrors: { equipmentNumber: ["Enter a different Equipment Number."] },
      values: {
        mineId: "mine-2",
        equipmentNumber: "131909",
      },
    });
    expect(mocks.equipmentCreate).not.toHaveBeenCalled();
  });

  it("allows edit to retain its own Equipment Number", async () => {
    await expect(
      updateEquipmentAction(
        "equipment-1",
        emptyEquipmentFormState,
        validFormData({ equipmentNumber: "DL-1" }),
      ),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.equipmentFindFirst).toHaveBeenCalledWith({
      where: { equipmentNumber: "DL-1", id: { not: "equipment-1" } },
      select: {
        displayName: true,
        equipmentNumber: true,
        mine: { select: { name: true } },
      },
    });
    expect(mocks.equipmentUpdate).toHaveBeenCalledOnce();
  });

  it("rejects edit changing to another Equipment record's number", async () => {
    mocks.equipmentFindFirst.mockResolvedValue({
      displayName: "Tundra",
      equipmentNumber: "131909",
      mine: { name: "White Rock" },
    });

    const result = await updateEquipmentAction(
      "equipment-1",
      emptyEquipmentFormState,
      validFormData({ equipmentNumber: "131909", notes: "Keep this note" }),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { equipmentNumber: expect.any(Array) },
      values: { equipmentNumber: "131909", notes: "Keep this note" },
    });
    expect(mocks.equipmentUpdate).not.toHaveBeenCalled();
  });

  it("allows multiple blank Equipment Numbers", async () => {
    await expect(
      createEquipmentAction(
        emptyEquipmentFormState,
        validFormData({ equipmentNumber: "" }),
      ),
    ).rejects.toThrow("redirect:/equipment");
    await expect(
      createEquipmentAction(
        emptyEquipmentFormState,
        validFormData({ equipmentNumber: "   " }),
      ),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.equipmentFindFirst).not.toHaveBeenCalled();
    expect(mocks.equipmentCreate).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ equipmentNumber: null }),
    });
    expect(mocks.equipmentCreate).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ equipmentNumber: null }),
    });
  });

  it("reports the Equipment Number database constraint and preserves values", async () => {
    mocks.equipmentCreate.mockRejectedValue(
      uniqueError("Equipment_equipmentNumber_key"),
    );

    const formData = validFormData({ notes: "Submitted notes" });
    formData.set("hasDigitalAlarmScreen", "on");
    const result = await createEquipmentAction(
      emptyEquipmentFormState,
      formData,
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { equipmentNumber: expect.any(Array) },
      values: {
        mineId: "mine-1",
        displayName: "Dragline 1",
        equipmentNumber: "DL-1",
        category: "DRAGLINE",
        powerType: "DIESEL",
        instrumentationType: "PHYSICAL_GAUGES",
        hasDigitalAlarmScreen: true,
        status: "ACTIVE",
        notes: "Submitted notes",
      },
    });
  });

  it("rejects missing Mine input before opening a transaction", async () => {
    const result = await createEquipmentAction(
      emptyEquipmentFormState,
      validFormData({ mineId: "" }),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { mineId: expect.any(Array) },
      values: { mineId: "", displayName: "Dragline 1" },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
