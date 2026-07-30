import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SupplyRequestReferenceError,
} from "@/features/supply-requests/reference-errors";

const mocks = vi.hoisted(() => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  statusItem: vi.fn(),
  createSupervisor: vi.fn(),
  updateSupervisor: vi.fn(),
  statusSupervisor: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/features/supply-requests/reference-persistence", () => ({
  createSupplyItemReference: mocks.createItem,
  updateSupplyItemReference: mocks.updateItem,
  setSupplyItemStatus: mocks.statusItem,
  createSupervisorReference: mocks.createSupervisor,
  updateSupervisorReference: mocks.updateSupervisor,
  setSupervisorStatus: mocks.statusSupervisor,
}));

import {
  changeSupervisorStatusAction,
  changeSupplyItemStatusAction,
  createSupervisorReferenceAction,
  createSupplyItemReferenceAction,
  updateSupervisorReferenceAction,
  updateSupplyItemReferenceAction,
} from "@/features/supply-requests/reference-actions";
import { emptyReferenceActionState } from "@/features/supply-requests/reference-action-state";

function itemForm() {
  const data = new FormData();
  data.set("itemNumber", " AB-12 ");
  data.set("description", " Main filter ");
  data.set("unitOfMeasure", " Each ");
  return data;
}

function supervisorForm() {
  const data = new FormData();
  data.set("fullName", " Pablo Gonzalez ");
  data.set("email", " Pablo@example.com ");
  return data;
}

describe("Supply Request reference Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createItem.mockResolvedValue({ id: "item-1" });
    mocks.updateItem.mockResolvedValue({ id: "item-1" });
    mocks.statusItem.mockResolvedValue({ id: "item-1", active: false });
    mocks.createSupervisor.mockResolvedValue({ id: "supervisor-1" });
    mocks.updateSupervisor.mockResolvedValue({ id: "supervisor-1" });
    mocks.statusSupervisor.mockResolvedValue({
      id: "supervisor-1",
      active: false,
    });
  });

  it("creates and edits Supply Items before redirecting to the stable list", async () => {
    await expect(
      createSupplyItemReferenceAction(emptyReferenceActionState, itemForm()),
    ).rejects.toThrow("redirect:/supply-requests/items");
    expect(mocks.createItem).toHaveBeenCalledWith({
      itemNumber: " AB-12 ",
      description: " Main filter ",
      unitOfMeasure: " Each ",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/supply-requests/items",
    );

    await expect(
      updateSupplyItemReferenceAction(
        "item-1",
        emptyReferenceActionState,
        itemForm(),
      ),
    ).rejects.toThrow("redirect:/supply-requests/items");
    expect(mocks.updateItem).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({ itemNumber: " AB-12 " }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/supply-requests/items/item-1/edit",
    );
  });

  it("returns field errors and preserves Supply Item values", async () => {
    mocks.createItem.mockRejectedValue(
      new SupplyRequestReferenceError(
        "DUPLICATE_ITEM_NUMBER",
        "Duplicate.",
        "itemNumber",
        { itemNumber: ["Already exists."] },
      ),
    );
    const result = await createSupplyItemReferenceAction(
      emptyReferenceActionState,
      itemForm(),
    );
    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { itemNumber: ["Already exists."] },
      values: { itemNumber: " AB-12 " },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("activates and inactivates Supply Items explicitly", async () => {
    await expect(
      changeSupplyItemStatusAction(
        "item-1",
        "inactivate",
        emptyReferenceActionState,
        new FormData(),
      ),
    ).rejects.toThrow("redirect:/supply-requests/items");
    expect(mocks.statusItem).toHaveBeenCalledWith("item-1", "inactivate");
  });

  it("creates and edits same-name-capable supervisors", async () => {
    await expect(
      createSupervisorReferenceAction(
        emptyReferenceActionState,
        supervisorForm(),
      ),
    ).rejects.toThrow("redirect:/supply-requests/supervisors");
    expect(mocks.createSupervisor).toHaveBeenCalledWith({
      fullName: " Pablo Gonzalez ",
      email: " Pablo@example.com ",
    });

    await expect(
      updateSupervisorReferenceAction(
        "supervisor-1",
        emptyReferenceActionState,
        supervisorForm(),
      ),
    ).rejects.toThrow("redirect:/supply-requests/supervisors");
  });

  it("maps supervisor email conflicts without raw errors", async () => {
    mocks.updateSupervisor.mockRejectedValue(
      new SupplyRequestReferenceError(
        "DUPLICATE_SUPERVISOR_EMAIL",
        "A supervisor with this email already exists.",
        "email",
        { email: ["A supervisor with this email already exists."] },
      ),
    );
    const result = await updateSupervisorReferenceAction(
      "supervisor-1",
      emptyReferenceActionState,
      supervisorForm(),
    );
    expect(result.message).not.toMatch(/postgres|P2002|password/i);
    expect(result.fieldErrors.email).toBeDefined();
  });

  it("activates and inactivates supervisors explicitly", async () => {
    await expect(
      changeSupervisorStatusAction(
        "supervisor-1",
        "activate",
        emptyReferenceActionState,
        new FormData(),
      ),
    ).rejects.toThrow("redirect:/supply-requests/supervisors");
    expect(mocks.statusSupervisor).toHaveBeenCalledWith(
      "supervisor-1",
      "activate",
    );
  });

  it("returns safe record-not-found behavior without redirecting", async () => {
    mocks.statusItem.mockRejectedValue(
      new SupplyRequestReferenceError(
        "NOT_FOUND",
        "The requested Supply Item could not be found.",
      ),
    );
    const result = await changeSupplyItemStatusAction(
      "missing",
      "activate",
      emptyReferenceActionState,
      new FormData(),
    );
    expect(result).toMatchObject({
      status: "error",
      message: "The requested Supply Item could not be found.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects unknown and duplicate form fields before persistence", async () => {
    const itemData = itemForm();
    itemData.set("active", "true");
    const itemResult = await createSupplyItemReferenceAction(
      emptyReferenceActionState,
      itemData,
    );
    expect(itemResult).toMatchObject({
      status: "error",
      fieldErrors: {
        form: ["The submitted form contained unexpected fields."],
      },
    });
    expect(mocks.createItem).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();

    vi.clearAllMocks();
    const supervisorData = supervisorForm();
    supervisorData.append("email", "other@example.com");
    const supervisorResult = await createSupervisorReferenceAction(
      emptyReferenceActionState,
      supervisorData,
    );
    expect(supervisorResult.status).toBe("error");
    expect(mocks.createSupervisor).not.toHaveBeenCalled();

    const statusData = new FormData();
    statusData.set("delete", "true");
    const statusResult = await changeSupplyItemStatusAction(
      "item-1",
      "inactivate",
      emptyReferenceActionState,
      statusData,
    );
    expect(statusResult.status).toBe("error");
    expect(mocks.statusItem).not.toHaveBeenCalled();
  });

  it("ignores only Next.js internal action metadata fields", async () => {
    const data = itemForm();
    data.set("$ACTION_REF_1", "internal");
    await expect(
      createSupplyItemReferenceAction(emptyReferenceActionState, data),
    ).rejects.toThrow("redirect:/supply-requests/items");
    expect(mocks.createItem).toHaveBeenCalledOnce();
  });
});
