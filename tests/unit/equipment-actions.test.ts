import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cityCreate: vi.fn(),
  cityFindMany: vi.fn(),
  equipmentCreate: vi.fn(),
  equipmentFindUnique: vi.fn(),
  equipmentUpdate: vi.fn(),
  mineCreate: vi.fn(),
  mineFindMany: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
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
  city: {
    create: mocks.cityCreate,
    findMany: mocks.cityFindMany,
  },
  equipment: {
    create: mocks.equipmentCreate,
    findUnique: mocks.equipmentFindUnique,
    update: mocks.equipmentUpdate,
  },
  mine: {
    create: mocks.mineCreate,
    findMany: mocks.mineFindMany,
  },
};

function validFormData(overrides: Record<string, string> = {}) {
  const values = {
    cityName: "Fort Meade",
    cityState: "FL",
    mineName: "South Fort Meade",
    mineType: "Quarry",
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

function storedEquipment({
  cityName = "Fort Meade",
  cityState = "FL" as string | null,
  mineName = "South Fort Meade",
  mineType = "Quarry" as string | null,
} = {}) {
  return {
    id: "equipment-1",
    mineId: "mine-existing",
    mine: {
      id: "mine-existing",
      cityId: "city-existing",
      name: mineName,
      type: mineType,
      city: {
        id: "city-existing",
        name: cityName,
        state: cityState,
      },
    },
  };
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
    mocks.cityFindMany.mockResolvedValue([]);
    mocks.cityCreate.mockResolvedValue({
      id: "city-1",
      name: "Fort Meade",
      state: "FL",
    });
    mocks.mineFindMany.mockResolvedValue([]);
    mocks.mineCreate.mockResolvedValue({
      id: "mine-1",
      cityId: "city-1",
      name: "South Fort Meade",
      type: "Quarry",
    });
    mocks.equipmentFindUnique.mockResolvedValue(storedEquipment());
    mocks.equipmentCreate.mockResolvedValue({ id: "equipment-1" });
    mocks.equipmentUpdate.mockResolvedValue({ id: "equipment-1" });
  });

  it("persists submitted FL and Quarry create defaults inside one transaction", async () => {
    await expect(
      createEquipmentAction(emptyEquipmentFormState, validFormData()),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.transaction.mock.calls[0][1]).toEqual({
      isolationLevel: "Serializable",
    });
    expect(mocks.cityCreate).toHaveBeenCalledWith({
      data: { name: "Fort Meade", state: "FL" },
    });
    expect(mocks.mineCreate).toHaveBeenCalledWith({
      data: { cityId: "city-1", name: "South Fort Meade", type: "Quarry" },
    });
    expect(mocks.equipmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mineId: "mine-1" }),
      }),
    );
  });

  it("persists alternate controlled create selections", async () => {
    mocks.cityCreate.mockResolvedValue({ id: "city-1", name: "Gillette", state: "WY" });
    mocks.mineCreate.mockResolvedValue({
      id: "mine-1",
      cityId: "city-1",
      name: "North Mine",
      type: "Strip Mine",
    });

    await expect(
      createEquipmentAction(
        emptyEquipmentFormState,
        validFormData({
          cityName: "Gillette",
          cityState: "WY",
          mineName: "North Mine",
          mineType: "Strip Mine",
        }),
      ),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.cityCreate).toHaveBeenCalledWith({
      data: { name: "Gillette", state: "WY" },
    });
    expect(mocks.mineCreate).toHaveBeenCalledWith({
      data: { cityId: "city-1", name: "North Mine", type: "Strip Mine" },
    });
  });

  it("rejects forged create values before starting a transaction", async () => {
    const result = await createEquipmentAction(
      emptyEquipmentFormState,
      validFormData({ cityState: "Florida", mineType: "Surface Mine" }),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: {
        cityState: expect.any(Array),
        mineType: expect.any(Array),
      },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("preserves attached null State and Mine Type identities during unrelated edits", async () => {
    mocks.equipmentFindUnique.mockResolvedValue(
      storedEquipment({ cityState: null, mineType: null }),
    );

    await expect(
      updateEquipmentAction(
        "equipment-1",
        emptyEquipmentFormState,
        validFormData({
          cityState: "",
          mineType: "",
          notes: "Unrelated Equipment note",
        }),
      ),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.equipmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "equipment-1" },
        data: expect.objectContaining({
          mineId: "mine-existing",
          notes: "Unrelated Equipment note",
        }),
      }),
    );
    expect(mocks.cityFindMany).not.toHaveBeenCalled();
    expect(mocks.mineFindMany).not.toHaveBeenCalled();
    expect(mocks.cityCreate).not.toHaveBeenCalled();
    expect(mocks.mineCreate).not.toHaveBeenCalled();
  });

  it("preserves attached out-of-catalog State and Mine Type identities during unrelated edits", async () => {
    mocks.equipmentFindUnique.mockResolvedValue(
      storedEquipment({ cityState: "Legacy State", mineType: "Legacy Mine Type" }),
    );

    await expect(
      updateEquipmentAction(
        "equipment-1",
        emptyEquipmentFormState,
        validFormData({
          cityState: "Legacy State",
          mineType: "Legacy Mine Type",
          displayName: "Renamed Dragline",
        }),
      ),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.equipmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mineId: "mine-existing",
          displayName: "Renamed Dragline",
        }),
      }),
    );
    expect(mocks.cityCreate).not.toHaveBeenCalled();
    expect(mocks.mineCreate).not.toHaveBeenCalled();
  });

  it("rejects FL and Quarry as shared-reference corrections for attached null values", async () => {
    mocks.equipmentFindUnique.mockResolvedValue(
      storedEquipment({ cityState: null, mineType: null }),
    );

    const result = await updateEquipmentAction(
      "equipment-1",
      emptyEquipmentFormState,
      validFormData(),
    );

    expect(result).toMatchObject({
      status: "error",
      message: expect.stringMatching(/cannot correct shared/i),
      fieldErrors: {
        cityState: expect.any(Array),
        mineType: expect.any(Array),
      },
    });
    expect(mocks.cityFindMany).not.toHaveBeenCalled();
    expect(mocks.mineFindMany).not.toHaveBeenCalled();
    expect(mocks.cityCreate).not.toHaveBeenCalled();
    expect(mocks.mineCreate).not.toHaveBeenCalled();
    expect(mocks.equipmentUpdate).not.toHaveBeenCalled();
  });

  it("protects a same-name City with conflicting State during create", async () => {
    mocks.cityFindMany.mockResolvedValue([
      { id: "city-existing", name: "FORT MEADE", state: null },
    ]);

    const result = await createEquipmentAction(
      emptyEquipmentFormState,
      validFormData(),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { cityState: expect.any(Array) },
    });
    expect(mocks.cityCreate).not.toHaveBeenCalled();
    expect(mocks.mineFindMany).not.toHaveBeenCalled();
    expect(mocks.equipmentCreate).not.toHaveBeenCalled();
  });

  it("protects a conflicting Mine Type through the update action", async () => {
    mocks.mineFindMany.mockResolvedValue([
      {
        id: "mine-replacement",
        cityId: "city-existing",
        name: "Replacement Mine",
        type: "Strip Mine",
      },
    ]);

    const result = await updateEquipmentAction(
      "equipment-1",
      emptyEquipmentFormState,
      validFormData({ mineName: "replacement mine", mineType: "Quarry" }),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { mineType: expect.any(Array) },
    });
    expect(mocks.mineCreate).not.toHaveBeenCalled();
    expect(mocks.equipmentUpdate).not.toHaveBeenCalled();
  });

  it("allows a genuine Mine reassignment when the new reference resolves safely", async () => {
    mocks.mineCreate.mockResolvedValue({
      id: "mine-replacement",
      cityId: "city-existing",
      name: "Replacement Mine",
      type: "Strip Mine",
    });

    await expect(
      updateEquipmentAction(
        "equipment-1",
        emptyEquipmentFormState,
        validFormData({
          mineName: "Replacement Mine",
          mineType: "Strip Mine",
        }),
      ),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.cityFindMany).not.toHaveBeenCalled();
    expect(mocks.mineCreate).toHaveBeenCalledWith({
      data: {
        cityId: "city-existing",
        name: "Replacement Mine",
        type: "Strip Mine",
      },
    });
    expect(mocks.equipmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mineId: "mine-replacement" }),
      }),
    );
  });

  it("reuses case-variant City and Mine names instead of creating duplicates", async () => {
    mocks.cityFindMany.mockResolvedValue([
      { id: "city-existing", name: "Fort Meade", state: "FL" },
    ]);
    mocks.mineFindMany.mockResolvedValue([
      {
        id: "mine-existing",
        cityId: "city-existing",
        name: "South Fort Meade",
        type: "Quarry",
      },
    ]);

    await expect(
      createEquipmentAction(
        emptyEquipmentFormState,
        validFormData({ cityName: "FORT MEADE", mineName: "south fort meade" }),
      ),
    ).rejects.toThrow("redirect:/equipment");

    expect(mocks.cityFindMany).toHaveBeenCalledWith({
      where: { name: { equals: "FORT MEADE", mode: "insensitive" } },
      take: 2,
    });
    expect(mocks.mineFindMany).toHaveBeenCalledWith({
      where: {
        cityId: "city-existing",
        name: { equals: "south fort meade", mode: "insensitive" },
      },
      take: 2,
    });
    expect(mocks.cityCreate).not.toHaveBeenCalled();
    expect(mocks.mineCreate).not.toHaveBeenCalled();
    expect(mocks.equipmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mineId: "mine-existing" }),
      }),
    );
  });

  it("returns a safe ambiguity error when case-insensitive City matching finds duplicates", async () => {
    mocks.cityFindMany.mockResolvedValue([
      { id: "city-1", name: "Fort Meade", state: "FL" },
      { id: "city-2", name: "FORT MEADE", state: "FL" },
    ]);

    const result = await createEquipmentAction(
      emptyEquipmentFormState,
      validFormData(),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { cityName: expect.any(Array) },
    });
    expect(mocks.cityCreate).not.toHaveBeenCalled();
    expect(mocks.equipmentCreate).not.toHaveBeenCalled();
  });

  it("returns an error when a downstream write fails inside the transaction", async () => {
    mocks.equipmentCreate.mockRejectedValue(new Error("downstream failure"));

    const result = await createEquipmentAction(
      emptyEquipmentFormState,
      validFormData(),
    );

    expect(result).toMatchObject({
      status: "error",
      message: expect.stringMatching(/could not be created/i),
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.cityCreate).toHaveBeenCalled();
    expect(mocks.mineCreate).toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "City",
      reject: () => mocks.cityCreate.mockRejectedValue(uniqueError(["name", "state"])),
      field: "cityState",
    },
    {
      label: "Mine",
      reject: () => mocks.mineCreate.mockRejectedValue(uniqueError(["cityId", "name"])),
      field: "mineType",
    },
  ])("does not mislabel a $label uniqueness failure as duplicate Equipment", async ({ reject, field }) => {
    reject();

    const result = await createEquipmentAction(
      emptyEquipmentFormState,
      validFormData(),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { [field]: expect.any(Array) },
    });
    expect(result.message).not.toMatch(/equipment record with this display name/i);
    expect(result.fieldErrors.displayName).toBeUndefined();
  });

  it("reports the Equipment uniqueness constraint as duplicate Equipment", async () => {
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
});
