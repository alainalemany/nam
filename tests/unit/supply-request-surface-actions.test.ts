import { beforeEach, describe, expect, it, vi } from "vitest";

import { SupplyRequestCreateError } from "@/features/supply-requests/errors";
import type { SupplyRequestCreateActionState } from "@/features/supply-requests/surface-types";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  equipmentSearch: vi.fn(),
  supervisorSearch: vi.fn(),
  itemSearch: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/supply-requests/persistence", () => ({
  createSupplyRequest: mocks.create,
}));
vi.mock("@/features/supply-requests/surface-data", () => ({
  searchActiveSupplyRequestEquipment: mocks.equipmentSearch,
  searchActiveSupplyRequestSupervisors: mocks.supervisorSearch,
  searchActiveSupplyRequestItems: mocks.itemSearch,
}));

import {
  createSupplyRequestAction,
  searchSupplyRequestEquipmentAction,
} from "@/features/supply-requests/surface-actions";

const initialState: SupplyRequestCreateActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: {
    operationalWorkDate: "",
    submittedLocalDate: "",
    submittedLocalTime: "",
    equipmentId: "",
    supervisorId: "",
    notes: "",
    corporateSubmissionConfirmed: false,
  },
  items: [],
};

function validForm() {
  const data = new FormData();
  data.set("operationalWorkDate", "2026-07-28");
  data.set("submittedLocalDate", "2026-07-29");
  data.set("submittedLocalTime", "01:15");
  data.set("equipmentId", "equipment-1");
  data.set("supervisorId", "supervisor-1");
  data.set("notes", "Keep this");
  data.set(
    "itemsPayload",
    JSON.stringify([{ supplyItemId: "item-1", quantity: 3 }]),
  );
  data.set("corporateSubmissionConfirmed", "true");
  return data;
}

describe("Supply Request create surface Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({
      supplyRequestId: "request/one",
      namReference: "SR-2026-0001",
      currentVersionId: "version-1",
      versionNumber: 1,
      status: "REQUESTED",
    });
  });

  it("calls the accepted create boundary once and redirects after commit", async () => {
    await expect(
      createSupplyRequestAction(initialState, validForm()),
    ).rejects.toThrow("redirect:/supply-requests/request%2Fone");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        corporateSubmissionConfirmed: true,
        items: [{ supplyItemId: "item-1", quantity: 3 }],
      }),
    );
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });

  it("does not persist or redirect validation failures", async () => {
    const data = validForm();
    data.delete("corporateSubmissionConfirmed");
    const result = await createSupplyRequestAction(initialState, data);
    expect(result).toMatchObject({ status: "error" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("maps persistence errors and preserves safe submitted state", async () => {
    mocks.create.mockRejectedValue(
      new SupplyRequestCreateError(
        "SUPPLY_ITEM_INACTIVE",
        "The selected Supply Item is inactive.",
        "items",
      ),
    );
    const result = await createSupplyRequestAction(initialState, validForm());
    expect(result).toMatchObject({
      status: "error",
      values: { notes: "Keep this", equipmentId: "equipment-1" },
      items: [{ supplyItemId: "item-1", quantity: 3 }],
      fieldErrors: { items: ["The selected Supply Item is inactive."] },
    });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("maps nested item validation errors to the visible item section", async () => {
    const data = validForm();
    data.set(
      "itemsPayload",
      JSON.stringify([{ supplyItemId: "item-1", quantity: 0 }]),
    );
    const result = await createSupplyRequestAction(initialState, data);
    expect(result).toMatchObject({
      status: "error",
      fieldErrors: {
        items: expect.arrayContaining([expect.stringMatching(/at least 1/i)]),
      },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not retry persistence exhaustion at the action layer", async () => {
    mocks.create.mockRejectedValue(
      new SupplyRequestCreateError(
        "RETRY_EXHAUSTED",
        "The request could not be recorded in NAM after a temporary conflict.",
      ),
    );
    const result = await createSupplyRequestAction(initialState, validForm());
    expect(result.status).toBe("error");
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("isolates unexpected raw errors", async () => {
    mocks.create.mockRejectedValue(
      new Error("postgres credential secret SQLSTATE 08006"),
    );
    const result = await createSupplyRequestAction(initialState, validForm());
    expect(result.message).toBe(
      "The submitted request could not be recorded in NAM. Try again.",
    );
    expect(JSON.stringify(result)).not.toMatch(/credential|08006|postgres/i);
  });

  it("maps bounded search results and safe search failures", async () => {
    mocks.equipmentSearch.mockResolvedValue([{ id: "e1", label: "D1" }]);
    await expect(searchSupplyRequestEquipmentAction(" d1 ")).resolves.toEqual({
      options: [{ id: "e1", label: "D1" }],
      error: null,
    });
    expect(mocks.equipmentSearch).toHaveBeenCalledWith("d1");

    mocks.equipmentSearch.mockRejectedValue(new Error("raw"));
    await expect(searchSupplyRequestEquipmentAction("d2")).resolves.toEqual({
      options: [],
      error: "Search is temporarily unavailable. Try again.",
    });
  });

  it("rejects overlong search without touching the database", async () => {
    await expect(
      searchSupplyRequestEquipmentAction("x".repeat(201)),
    ).resolves.toMatchObject({ options: [], error: expect.any(String) });
    expect(mocks.equipmentSearch).not.toHaveBeenCalled();
  });
});
