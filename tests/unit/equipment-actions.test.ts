import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  equipmentCreate: vi.fn(),
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

  it("reports the Equipment uniqueness constraint without changing references", async () => {
    mocks.equipmentCreate.mockRejectedValue(
      uniqueError(["mineId", "displayName"]),
    );

    const result = await createEquipmentAction(
      emptyEquipmentFormState,
      validFormData(),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { displayName: expect.any(Array) },
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
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
