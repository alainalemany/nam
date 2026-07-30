import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupplyRequestLifecycleActionState } from "@/features/supply-requests/lifecycle-action-state";
import { SupplyRequestLifecycleError } from "@/features/supply-requests/lifecycle-errors";

const mocks = vi.hoisted(() => ({
  fulfill: vi.fn(),
  cancel: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/supply-requests/lifecycle-persistence", () => ({
  fulfillSupplyRequest: mocks.fulfill,
  cancelSupplyRequest: mocks.cancel,
}));

import {
  cancelSupplyRequestAction,
  fulfillSupplyRequestAction,
} from "@/features/supply-requests/lifecycle-actions";

const initialState: SupplyRequestLifecycleActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: {
    expectedCurrentVersionNumber: "1",
    fulfillmentOperationalWorkDate: "2026-07-29",
    fulfillmentNote: "",
    cancellationReason: "",
  },
};

function fulfillmentForm() {
  const data = new FormData();
  data.set("expectedCurrentVersionNumber", "1");
  data.set("fulfillmentOperationalWorkDate", "2026-07-29");
  data.set("fulfillmentNote", " Complete ");
  return data;
}

function cancellationForm() {
  const data = new FormData();
  data.set("expectedCurrentVersionNumber", "1");
  data.set("cancellationReason", " No longer needed ");
  return data;
}

describe("Supply Request lifecycle Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fulfill.mockResolvedValue({
      supplyRequestId: "request/one",
      currentVersionId: "version-2",
      newVersionNumber: 2,
      namReference: "SR-2026-0001",
      status: "FULFILLED",
    });
    mocks.cancel.mockResolvedValue({
      supplyRequestId: "request/two",
      currentVersionId: "version-2",
      newVersionNumber: 2,
      namReference: "SR-2026-0002",
      status: "CANCELLED",
    });
  });

  it("fulfills exactly once and redirects only after the committed result", async () => {
    await expect(
      fulfillSupplyRequestAction(
        "request/one",
        initialState,
        fulfillmentForm(),
      ),
    ).rejects.toThrow("redirect:/supply-requests/request%2Fone");
    expect(mocks.fulfill).toHaveBeenCalledOnce();
    expect(mocks.fulfill).toHaveBeenCalledWith({
      supplyRequestId: "request/one",
      expectedCurrentVersionNumber: 1,
      fulfillmentOperationalWorkDate: "2026-07-29",
      fulfillmentNote: "Complete",
    });
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("cancels exactly once and redirects only after the committed result", async () => {
    await expect(
      cancelSupplyRequestAction(
        "request/two",
        initialState,
        cancellationForm(),
      ),
    ).rejects.toThrow("redirect:/supply-requests/request%2Ftwo");
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.cancel).toHaveBeenCalledWith({
      supplyRequestId: "request/two",
      expectedCurrentVersionNumber: 1,
      cancellationReason: "No longer needed",
    });
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it("rejects unknown, repeated, timestamp, status, and version-ID fields", async () => {
    for (const field of [
      "status",
      "fulfilledLocalDate",
      "currentVersionId",
      "requesterDisplayNameSnapshot",
    ]) {
      const data = fulfillmentForm();
      data.set(field, "caller-owned");
      const result = await fulfillSupplyRequestAction(
        "request-1",
        initialState,
        data,
      );
      expect(result).toMatchObject({ status: "error" });
    }
    const repeated = cancellationForm();
    repeated.append("cancellationReason", "second");
    await expect(
      cancelSupplyRequestAction("request-1", initialState, repeated),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.fulfill).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("ignores only established Next.js action metadata", async () => {
    const allowed = fulfillmentForm();
    allowed.set("$ACTION_ID_example", "metadata");
    await expect(
      fulfillSupplyRequestAction("request-1", initialState, allowed),
    ).rejects.toThrow("redirect:/supply-requests/request%2Fone");

    vi.clearAllMocks();
    const rejected = fulfillmentForm();
    rejected.set("ACTION_ID_example", "not metadata");
    await expect(
      fulfillSupplyRequestAction("request-1", initialState, rejected),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it("maps stale and invalid-transition errors without action-layer retry", async () => {
    mocks.fulfill.mockRejectedValue(
      new SupplyRequestLifecycleError(
        "STALE_VERSION",
        "This Supply Request changed. Reload the current request.",
        "expectedCurrentVersionNumber",
      ),
    );
    const stale = await fulfillSupplyRequestAction(
      "request-1",
      initialState,
      fulfillmentForm(),
    );
    expect(stale).toMatchObject({
      status: "error",
      message: expect.stringMatching(/reload/i),
    });
    expect(mocks.fulfill).toHaveBeenCalledOnce();

    mocks.cancel.mockRejectedValue(
      new SupplyRequestLifecycleError(
        "INVALID_TRANSITION",
        "This Supply Request is already fulfilled.",
      ),
    );
    await expect(
      cancelSupplyRequestAction(
        "request-1",
        initialState,
        cancellationForm(),
      ),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.cancel).toHaveBeenCalledOnce();
  });

  it("attaches work-date errors and preserves submitted note or reason", async () => {
    mocks.fulfill.mockRejectedValue(
      new SupplyRequestLifecycleError(
        "FULFILLMENT_WORK_DATE_BEFORE_REQUEST",
        "Fulfillment operational work date cannot be before the request date.",
        "fulfillmentOperationalWorkDate",
      ),
    );
    const fulfilled = await fulfillSupplyRequestAction(
      "request-1",
      initialState,
      fulfillmentForm(),
    );
    expect(fulfilled).toMatchObject({
      values: {
        fulfillmentOperationalWorkDate: "2026-07-29",
        fulfillmentNote: " Complete ",
      },
      fieldErrors: {
        fulfillmentOperationalWorkDate: [expect.any(String)],
      },
    });

    mocks.cancel.mockRejectedValue(
      new SupplyRequestLifecycleError("STALE_VERSION", "Reload."),
    );
    const cancelled = await cancelSupplyRequestAction(
      "request-1",
      initialState,
      cancellationForm(),
    );
    expect(cancelled.values.cancellationReason).toBe(" No longer needed ");
  });

  it("does not invoke persistence on validation failure", async () => {
    const invalid = fulfillmentForm();
    invalid.set("expectedCurrentVersionNumber", "1.5");
    const result = await fulfillSupplyRequestAction(
      "request-1",
      initialState,
      invalid,
    );
    expect(result).toMatchObject({ status: "error" });
    expect(mocks.fulfill).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("isolates raw failures and keeps cancellation wording inside NAM", async () => {
    mocks.cancel.mockRejectedValue(
      new Error("raw database detail SQLSTATE 08006"),
    );
    const result = await cancelSupplyRequestAction(
      "request-1",
      initialState,
      cancellationForm(),
    );
    expect(result.message).toBe(
      "The Supply Request could not be updated in NAM. Try again.",
    );
    expect(JSON.stringify(result)).not.toMatch(
      /database detail|sqlstate|08006/i,
    );
    expect(result.message).not.toMatch(/corporate.*cancel/i);
    expect(mocks.cancel).toHaveBeenCalledOnce();
  });
});
