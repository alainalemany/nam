import { describe, expect, it } from "vitest";

import { SupplyRequestCreateError } from "@/features/supply-requests/errors";
import {
  formatSupplyRequestDate,
  supplyRequestDerivedTitle,
  supplyRequestEquipmentCategoryLabel,
  supplyRequestEquipmentSnapshotLabel,
  supplyRequestStatusLabel,
} from "@/features/supply-requests/surface-display";
import {
  parseSupplyRequestCreateFormData,
  parseSupplyRequestOriginalVersion,
  parseSupplyRequestRouteId,
  parseSupplyRequestSearchQuery,
  parseSupplyRequestSelectedItemsPayload,
} from "@/features/supply-requests/surface-validation";
import { supplyRequestNewYorkWallClock } from "@/features/supply-requests/wall-clock";

function validForm() {
  const data = new FormData();
  data.set("operationalWorkDate", "2026-07-28");
  data.set("submittedLocalDate", "2026-07-29");
  data.set("submittedLocalTime", "01:15");
  data.set("equipmentId", "equipment-1");
  data.set("supervisorId", "supervisor-1");
  data.set("notes", " Night shift ");
  data.set(
    "itemsPayload",
    JSON.stringify([
      { supplyItemId: "item-b", quantity: 2 },
      { supplyItemId: "item-a", quantity: 4 },
    ]),
  );
  data.set("corporateSubmissionConfirmed", "true");
  return data;
}

describe("Supply Request create and detail surface helpers", () => {
  it("derives canonical New York wall-clock values in standard time", () => {
    expect(
      supplyRequestNewYorkWallClock(new Date("2026-01-15T05:07:59.999Z")),
    ).toEqual({ date: "2026-01-15", time: "00:07" });
  });

  it("derives canonical New York values in daylight-saving time", () => {
    expect(
      supplyRequestNewYorkWallClock(new Date("2026-07-15T16:42:31.000Z")),
    ).toEqual({ date: "2026-07-15", time: "12:42" });
  });

  it("keeps the New York calendar date when UTC is already next day", () => {
    expect(
      supplyRequestNewYorkWallClock(new Date("2026-07-30T02:05:00.000Z")),
    ).toEqual({ date: "2026-07-29", time: "22:05" });
  });

  it("does not depend on the process timezone and omits seconds", () => {
    const previous = process.env.TZ;
    process.env.TZ = "Pacific/Auckland";
    try {
      expect(
        supplyRequestNewYorkWallClock(new Date("2026-12-01T18:09:59.000Z")),
      ).toEqual({ date: "2026-12-01", time: "13:09" });
    } finally {
      process.env.TZ = previous;
    }
  });

  it("handles New York midnight and both DST transition periods", () => {
    expect(
      supplyRequestNewYorkWallClock(new Date("2026-03-08T07:01:00.000Z")),
    ).toEqual({ date: "2026-03-08", time: "03:01" });
    expect(
      supplyRequestNewYorkWallClock(new Date("2026-11-01T06:30:00.000Z")),
    ).toEqual({ date: "2026-11-01", time: "01:30" });
    expect(
      supplyRequestNewYorkWallClock(new Date("2026-07-29T04:00:00.000Z")),
    ).toEqual({ date: "2026-07-29", time: "00:00" });
  });

  it("strictly parses owned form fields and preserves item order", () => {
    const parsed = parseSupplyRequestCreateFormData(validForm());
    expect(parsed.input).toMatchObject({
      notes: "Night shift",
      corporateSubmissionConfirmed: true,
      items: [
        { supplyItemId: "item-b", quantity: 2 },
        { supplyItemId: "item-a", quantity: 4 },
      ],
    });
  });

  it("allows only established Next.js action metadata", () => {
    const data = validForm();
    data.set("$ACTION_REF_1", "internal");
    expect(parseSupplyRequestCreateFormData(data).input.items).toHaveLength(2);
  });

  it("rejects unknown and repeated top-level fields", () => {
    const unknown = validForm();
    unknown.set("status", "FULFILLED");
    expect(() => parseSupplyRequestCreateFormData(unknown)).toThrow(
      SupplyRequestCreateError,
    );
    const repeated = validForm();
    repeated.append("equipmentId", "equipment-2");
    expect(() => parseSupplyRequestCreateFormData(repeated)).toThrow(
      SupplyRequestCreateError,
    );
  });

  it("rejects repeated item and confirmation fields and non-action metadata", () => {
    const repeatedItems = validForm();
    repeatedItems.append("itemsPayload", "[]");
    expect(() => parseSupplyRequestCreateFormData(repeatedItems)).toThrow(
      SupplyRequestCreateError,
    );

    const repeatedConfirmation = validForm();
    repeatedConfirmation.append("corporateSubmissionConfirmed", "true");
    expect(() => parseSupplyRequestCreateFormData(repeatedConfirmation)).toThrow(
      SupplyRequestCreateError,
    );

    const similarMetadata = validForm();
    similarMetadata.set("ACTION_REF_1", "not-next-metadata");
    expect(() => parseSupplyRequestCreateFormData(similarMetadata)).toThrow(
      SupplyRequestCreateError,
    );
  });

  it("rejects every caller-owned generated and snapshot field", () => {
    for (const field of [
      "namReference",
      "referenceYear",
      "referenceSequence",
      "requesterDisplayNameSnapshot",
      "equipmentDisplayNameSnapshot",
      "mineNameSnapshot",
      "cityNameSnapshot",
      "supervisorNameSnapshot",
      "status",
      "changeKind",
      "versionNumber",
      "currentVersionId",
      "active",
      "createdAt",
    ]) {
      const data = validForm();
      data.set(field, "caller-owned");
      expect(() => parseSupplyRequestCreateFormData(data)).toThrow(
        SupplyRequestCreateError,
      );
    }
  });

  it("rejects malformed serialized items and unknown nested fields", () => {
    expect(() => parseSupplyRequestSelectedItemsPayload("{bad")).toThrow(
      SupplyRequestCreateError,
    );
    expect(() =>
      parseSupplyRequestSelectedItemsPayload(
        JSON.stringify([
          {
            supplyItemId: "item-1",
            quantity: 1,
            unit: "caller-owned",
          },
        ]),
      ),
    ).toThrow(SupplyRequestCreateError);
    for (const payload of [
      "null",
      "{}",
      JSON.stringify([null]),
      JSON.stringify([{ supplyItemId: "item-1", quantity: "1" }]),
      JSON.stringify([
        { supplyItemId: "item-1", quantity: 1, sequence: 1 },
      ]),
      JSON.stringify([
        { supplyItemId: "item-1", quantity: 1, normalizedItemNumber: "A-1" },
      ]),
    ]) {
      expect(() => parseSupplyRequestSelectedItemsPayload(payload)).toThrow(
        SupplyRequestCreateError,
      );
    }
  });

  it("rejects duplicate items and invalid quantity bounds", () => {
    const duplicate = validForm();
    duplicate.set(
      "itemsPayload",
      JSON.stringify([
        { supplyItemId: "item-1", quantity: 1 },
        { supplyItemId: "item-1", quantity: 2 },
      ]),
    );
    expect(() => parseSupplyRequestCreateFormData(duplicate)).toThrow(
      /only once/i,
    );
    for (const quantity of [0, -1, 1.5, 1_000_000, Number.MAX_SAFE_INTEGER]) {
      const invalid = validForm();
      invalid.set(
        "itemsPayload",
        JSON.stringify([{ supplyItemId: "item-1", quantity }]),
      );
      expect(() => parseSupplyRequestCreateFormData(invalid)).toThrow();
    }
  });

  it("enforces selected-item count and serialized-size bounds", () => {
    expect(() =>
      parseSupplyRequestSelectedItemsPayload(
        JSON.stringify(
          Array.from({ length: 51 }, (_, index) => ({
            supplyItemId: `item-${index}`,
            quantity: 1,
          })),
        ),
      ),
    ).toThrow(SupplyRequestCreateError);
    expect(() =>
      parseSupplyRequestSelectedItemsPayload(" ".repeat(50_001)),
    ).toThrow(SupplyRequestCreateError);
  });

  it("requires the corporate confirmation to be exactly true", () => {
    const missing = validForm();
    missing.delete("corporateSubmissionConfirmed");
    expect(() => parseSupplyRequestCreateFormData(missing)).toThrow(
      SupplyRequestCreateError,
    );
    const falseValue = validForm();
    falseValue.set("corporateSubmissionConfirmed", "false");
    expect(() => parseSupplyRequestCreateFormData(falseValue)).toThrow(
      SupplyRequestCreateError,
    );
  });

  it("normalizes bounded search and uses the first repeated value", () => {
    expect(parseSupplyRequestSearchQuery("  dragline  ")).toBe("dragline");
    expect(parseSupplyRequestSearchQuery([" first ", "second"])).toBe("first");
    expect(parseSupplyRequestSearchQuery("   ")).toBe("");
    expect(parseSupplyRequestSearchQuery("x".repeat(201))).toBeNull();
  });

  it("strictly parses route identity and canonical positive immutable versions", () => {
    expect(parseSupplyRequestRouteId(" request-1 ")).toBe("request-1");
    expect(parseSupplyRequestRouteId("")).toBeNull();
    expect(parseSupplyRequestRouteId("x".repeat(101))).toBeNull();
    expect(parseSupplyRequestOriginalVersion("1")).toBe(1);
    expect(parseSupplyRequestOriginalVersion("2")).toBe(2);
    expect(parseSupplyRequestOriginalVersion("2147483647")).toBe(2_147_483_647);
    for (const value of [
      "0",
      "-1",
      "1.0",
      "01",
      "+1",
      "1e0",
      " 1",
      "1 ",
      "2147483648",
      "9007199254740992",
      "NaN",
      "Infinity",
      "",
    ]) {
      expect(parseSupplyRequestOriginalVersion(value)).toBeNull();
    }
  });

  it("applies the approved Equipment snapshot fallback", () => {
    expect(supplyRequestEquipmentSnapshotLabel("Dragline", "101")).toBe(
      "Dragline · 101",
    );
    expect(supplyRequestEquipmentSnapshotLabel("101", "101")).toBe("101");
    expect(supplyRequestEquipmentSnapshotLabel("dl-1", "DL-1")).toBe("dl-1");
    expect(supplyRequestEquipmentSnapshotLabel("DL   1", "dl 1")).toBe(
      "DL   1",
    );
    expect(supplyRequestEquipmentSnapshotLabel("", "101")).toBe(
      "Equipment 101",
    );
    expect(supplyRequestEquipmentSnapshotLabel("Dragline #101", "101")).toBe(
      "Dragline #101 · 101",
    );
    expect(supplyRequestEquipmentSnapshotLabel(" ", null)).toBe(
      "Equipment unavailable",
    );
  });

  it("formats display-only labels without changing business values", () => {
    expect(formatSupplyRequestDate("2026-07-29")).toBe("Jul 29, 2026");
    expect(supplyRequestStatusLabel("REQUESTED")).toBe("Requested");
    expect(supplyRequestEquipmentCategoryLabel("WORK_TRUCK")).toBe(
      "Work truck",
    );
    expect(supplyRequestDerivedTitle("Dragline 101", "2026-07-29")).toBe(
      "Supply Request — Dragline 101 — Jul 29, 2026",
    );
  });
});
