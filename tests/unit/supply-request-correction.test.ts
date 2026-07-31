import { describe, expect, it, vi } from "vitest";

import { SupplyRequestCorrectionError } from "@/features/supply-requests/correction-errors";
import { runSupplyRequestCorrectionWithRetry } from "@/features/supply-requests/correction-retry";
import { isRetryableSupplyRequestLifecycleError } from "@/features/supply-requests/lifecycle-retry";
import {
  parseCorrectSupplyRequestFormData,
  parseSupplyRequestCorrectionItems,
} from "@/features/supply-requests/correction-surface-validation";
import {
  parseCorrectSupplyRequestInput,
} from "@/features/supply-requests/correction-validation";
import { parseSupplyRequestOriginalVersion } from "@/features/supply-requests/surface-validation";

function requestedInput() {
  return {
    supplyRequestId: "request-1",
    expectedCurrentVersionNumber: 2,
    correctionReason: " Repair historical record ",
    operationalWorkDate: "2026-07-28",
    submittedLocalDate: "2026-07-29",
    submittedLocalTime: "01:15",
    equipmentId: "equipment-1",
    supervisorId: "supervisor-1",
    notes: " Corrected Notes ",
    resultingStatus: "REQUESTED" as const,
    items: [{ supplyItemId: "item-1", quantity: 3 }],
  };
}

describe("Supply Request correction validation", () => {
  it("normalizes a complete Requested correction", () => {
    expect(parseCorrectSupplyRequestInput(requestedInput())).toMatchObject({
      supplyRequestId: "request-1",
      correctionReason: "Repair historical record",
      notes: "Corrected Notes",
      resultingStatus: "REQUESTED",
    });
  });

  it("accepts complete Fulfilled and Cancelled corrections", () => {
    expect(
      parseCorrectSupplyRequestInput({
        ...requestedInput(),
        resultingStatus: "FULFILLED",
        fulfillmentOperationalWorkDate: "2026-07-28",
        fulfilledLocalDate: "2026-07-29",
        fulfilledLocalTime: "01:15",
        fulfillmentNote: " Complete ",
      }),
    ).toMatchObject({ fulfillmentNote: "Complete" });
    expect(
      parseCorrectSupplyRequestInput({
        ...requestedInput(),
        resultingStatus: "CANCELLED",
        cancelledLocalDate: "2026-07-29",
        cancelledLocalTime: "01:15",
        cancellationReason: " Duplicate ",
      }),
    ).toMatchObject({ cancellationReason: "Duplicate" });
  });

  it("enforces ID, expected-version, reason, Notes, and item bounds", () => {
    for (const patch of [
      { supplyRequestId: " " },
      { supplyRequestId: "x".repeat(101) },
      { expectedCurrentVersionNumber: 0 },
      { expectedCurrentVersionNumber: 1.5 },
      { expectedCurrentVersionNumber: 2_147_483_648 },
      { expectedCurrentVersionNumber: "2" },
      { correctionReason: " " },
      { correctionReason: "x".repeat(1001) },
      { notes: "x".repeat(2001) },
      { items: [] },
      { items: [{ supplyItemId: "item-1", quantity: 0 }] },
    ]) {
      expect(() =>
        parseCorrectSupplyRequestInput({
          ...requestedInput(),
          ...patch,
        } as never),
      ).toThrow(SupplyRequestCorrectionError);
    }
    expect(
      parseCorrectSupplyRequestInput({
        ...requestedInput(),
        correctionReason: "x".repeat(1000),
        notes: "x".repeat(2000),
      }),
    ).toMatchObject({
      correctionReason: "x".repeat(1000),
      notes: "x".repeat(2000),
    });
  });

  it("rejects malformed dates, times, statuses, duplicates, and unknown fields", () => {
    for (const patch of [
      { operationalWorkDate: "2026-02-30" },
      { submittedLocalDate: " 2026-07-29 " },
      { submittedLocalTime: "1:15" },
      { resultingStatus: "REOPENED" },
      {
        items: [
          { supplyItemId: "item-1", quantity: 1 },
          { supplyItemId: "item-1", quantity: 2 },
        ],
      },
      { correctedByDisplayNameSnapshot: "Caller" },
    ]) {
      expect(() =>
        parseCorrectSupplyRequestInput({
          ...requestedInput(),
          ...patch,
        } as never),
      ).toThrow(SupplyRequestCorrectionError);
    }
  });

  it("enforces mutually exclusive status facts and local chronology", () => {
    const invalid = [
      {
        ...requestedInput(),
        fulfilledLocalDate: "2026-07-29",
      },
      {
        ...requestedInput(),
        resultingStatus: "FULFILLED" as const,
      },
      {
        ...requestedInput(),
        resultingStatus: "FULFILLED" as const,
        fulfillmentOperationalWorkDate: "2026-07-27",
        fulfilledLocalDate: "2026-07-29",
        fulfilledLocalTime: "01:14",
      },
      {
        ...requestedInput(),
        resultingStatus: "CANCELLED" as const,
        cancelledLocalDate: "2026-07-28",
        cancelledLocalTime: "23:59",
      },
    ];
    invalid.forEach((input) =>
      expect(() => parseCorrectSupplyRequestInput(input)).toThrow(
        SupplyRequestCorrectionError,
      ),
    );
  });

  it("strictly parses owned FormData and ordered item JSON", () => {
    const form = new FormData();
    Object.entries({
      expectedCurrentVersionNumber: "2",
      correctionReason: "Fix",
      operationalWorkDate: "2026-07-28",
      submittedLocalDate: "2026-07-29",
      submittedLocalTime: "01:15",
      equipmentId: "equipment-1",
      supervisorId: "supervisor-1",
      notes: "",
      resultingStatus: "REQUESTED",
      itemsPayload: JSON.stringify([
        { supplyItemId: "item-2", quantity: 4 },
        { supplyItemId: "item-1", quantity: 3 },
      ]),
    }).forEach(([key, value]) => form.set(key, value));
    form.set("$ACTION_ID_test", "metadata");
    expect(parseCorrectSupplyRequestFormData("request-1", form).input.items).toEqual([
      { supplyItemId: "item-2", quantity: 4 },
      { supplyItemId: "item-1", quantity: 3 },
    ]);
    form.set("unit", "caller-owned");
    expect(() => parseCorrectSupplyRequestFormData("request-1", form)).toThrow(
      SupplyRequestCorrectionError,
    );
  });

  it("rejects malformed, non-array, unknown nested, and oversized item payloads", () => {
    for (const payload of [
      "{",
      "{}",
      JSON.stringify([{ supplyItemId: "item-1", quantity: 1, unit: "Each" }]),
      "x".repeat(50_001),
    ]) {
      expect(() => parseSupplyRequestCorrectionItems(payload)).toThrow(
        SupplyRequestCorrectionError,
      );
    }
  });

  it("retries exactly rollback-certain failures and stops at three attempts", async () => {
    expect(isRetryableSupplyRequestLifecycleError({ code: "P2034" })).toBe(true);
    expect(isRetryableSupplyRequestLifecycleError({ code: "40001" })).toBe(true);
    expect(isRetryableSupplyRequestLifecycleError({ code: "40P01" })).toBe(true);
    expect(
      isRetryableSupplyRequestLifecycleError({
        code: "P2010",
        meta: { code: "40001" },
      }),
    ).toBe(true);
    for (const error of [
      { code: "P2002" },
      { code: "P2010", meta: { code: "23505" } },
      new Error("deadlock serialization timeout"),
      { code: "ETIMEDOUT" },
    ]) {
      expect(isRetryableSupplyRequestLifecycleError(error)).toBe(false);
    }
    const operation = vi.fn(async () => {
      throw { code: "P2034" };
    });
    await expect(runSupplyRequestCorrectionWithRetry(operation)).rejects.toMatchObject({
      code: "RETRY_EXHAUSTED",
    });
    expect(operation).toHaveBeenCalledTimes(3);
    const business = vi.fn(async () => {
      throw new SupplyRequestCorrectionError("STALE_VERSION", "Reload.");
    });
    await expect(runSupplyRequestCorrectionWithRetry(business)).rejects.toMatchObject({
      code: "STALE_VERSION",
    });
    expect(business).toHaveBeenCalledOnce();
  });

  it("parses every canonical positive signed-32-bit version", () => {
    expect(parseSupplyRequestOriginalVersion("1")).toBe(1);
    expect(parseSupplyRequestOriginalVersion("27")).toBe(27);
    expect(parseSupplyRequestOriginalVersion("2147483647")).toBe(2_147_483_647);
    for (const value of ["", "0", "-1", "1.0", "1e2", "+1", "01", "2147483648"]) {
      expect(parseSupplyRequestOriginalVersion(value)).toBeNull();
    }
  });
});
