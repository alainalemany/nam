import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupplyRequestCorrectionActionState } from "@/features/supply-requests/surface-types";

const mocks = vi.hoisted(() => ({
  correct: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/supply-requests/correction-persistence", () => ({
  correctSupplyRequest: mocks.correct,
}));

import { correctSupplyRequestAction } from "@/features/supply-requests/correction-actions";
import { SupplyRequestCorrectionError } from "@/features/supply-requests/correction-errors";

const initial: SupplyRequestCorrectionActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: {
    expectedCurrentVersionNumber: "1",
    correctionReason: "",
    operationalWorkDate: "2026-07-28",
    submittedLocalDate: "2026-07-29",
    submittedLocalTime: "01:15",
    equipmentId: "equipment-1",
    supervisorId: "supervisor-1",
    notes: "",
    resultingStatus: "REQUESTED",
    fulfillmentOperationalWorkDate: "",
    fulfilledLocalDate: "",
    fulfilledLocalTime: "",
    fulfillmentNote: "",
    cancelledLocalDate: "",
    cancelledLocalTime: "",
    cancellationReason: "",
  },
  items: [{ supplyItemId: "item-1", quantity: 2 }],
};

function form() {
  const data = new FormData();
  Object.entries(initial.values).forEach(([key, value]) => {
    if (
      ![
        "fulfillmentOperationalWorkDate",
        "fulfilledLocalDate",
        "fulfilledLocalTime",
        "fulfillmentNote",
        "cancelledLocalDate",
        "cancelledLocalTime",
        "cancellationReason",
      ].includes(key)
    ) {
      data.set(key, value);
    }
  });
  data.set("correctionReason", "Fix record");
  data.set("itemsPayload", JSON.stringify(initial.items));
  return data;
}

describe("Supply Request correction Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.correct.mockResolvedValue({
      supplyRequestId: "request/one",
      namReference: "SR-2026-0001",
      currentVersionId: "version-2",
      newVersionNumber: 2,
      status: "REQUESTED",
    });
  });

  it("calls correction exactly once and redirects after commit", async () => {
    await expect(
      correctSupplyRequestAction("request/one", initial, form()),
    ).rejects.toThrow("redirect:/supply-requests/request%2Fone");
    expect(mocks.correct).toHaveBeenCalledOnce();
  });

  it("rejects unknown, repeated, metadata-like, and caller-owned fields", async () => {
    for (const field of [
      "correctedByDisplayNameSnapshot",
      "correctionLocalDate",
      "equipmentDisplayNameSnapshot",
      "preserveSnapshot",
      "ACTION_ID_fake",
    ]) {
      const data = form();
      data.set(field, "caller");
      await expect(
        correctSupplyRequestAction("request-1", initial, data),
      ).resolves.toMatchObject({ status: "error" });
    }
    const repeated = form();
    repeated.append("correctionReason", "second");
    await expect(
      correctSupplyRequestAction("request-1", initial, repeated),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.correct).not.toHaveBeenCalled();
  });

  it("allows Next metadata and preserves the complete submitted aggregate on failure", async () => {
    mocks.correct.mockRejectedValue(
      new SupplyRequestCorrectionError(
        "STALE_VERSION",
        "Reload the current request.",
        "expectedCurrentVersionNumber",
      ),
    );
    const data = form();
    data.set("$ACTION_ID_test", "metadata");
    const result = await correctSupplyRequestAction("request-1", initial, data);
    expect(result).toMatchObject({
      status: "error",
      message: expect.stringMatching(/reload/i),
      values: { correctionReason: "Fix record", equipmentId: "equipment-1" },
      items: [{ supplyItemId: "item-1", quantity: 2 }],
    });
    expect(mocks.correct).toHaveBeenCalledOnce();
  });

  it("maps replacement and status errors without action-layer retry", async () => {
    mocks.correct.mockRejectedValue(
      new SupplyRequestCorrectionError(
        "EQUIPMENT_INACTIVE",
        "Select active Equipment.",
        "equipmentId",
      ),
    );
    await expect(
      correctSupplyRequestAction("request-1", initial, form()),
    ).resolves.toMatchObject({
      fieldErrors: { equipmentId: [expect.any(String)] },
    });
    expect(mocks.correct).toHaveBeenCalledOnce();
  });

  it("isolates unexpected database details", async () => {
    mocks.correct.mockRejectedValue(new Error("SQLSTATE 08006 password=secret"));
    const result = await correctSupplyRequestAction("request-1", initial, form());
    expect(result.message).toBe(
      "The Supply Request could not be corrected in NAM. Try again.",
    );
    expect(JSON.stringify(result)).not.toMatch(/08006|password|sqlstate/i);
  });

  it("bounds submitted recovery values without accepting truncated input", async () => {
    const data = form();
    data.set("notes", "n".repeat(2_001));
    const result = await correctSupplyRequestAction(
      "request-1",
      initial,
      data,
    );
    expect(result).toMatchObject({ status: "error" });
    expect(result.values.notes).toHaveLength(2_000);
    expect(mocks.correct).not.toHaveBeenCalled();
  });
});
