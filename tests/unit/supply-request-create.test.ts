import { describe, expect, it } from "vitest";

import {
  SupplyRequestCreateError,
  unexpectedSupplyRequestPersistenceError,
} from "@/features/supply-requests/errors";
import {
  normalizeSupervisorEmail,
  normalizeSupervisorFullName,
  normalizeSupplyItemNumberDisplay,
  normalizeSupplyItemNumberKey,
  SupplyRequestNormalizationError,
} from "@/features/supply-requests/normalization";
import { formatSupplyRequestNamReference } from "@/features/supply-requests/persistence";
import {
  isRetryableSupplyRequestPersistenceError,
  runSupplyRequestCreateWithRetry,
} from "@/features/supply-requests/retry";
import { supplyRequestRequester } from "@/features/supply-requests/server-config";
import {
  canonicalSupplyRequestItems,
  isCanonicalSupplyRequestDate,
  isCanonicalSupplyRequestLocalTime,
  parseCreateSupplyRequestInput,
  type CreateSupplyRequestInput,
} from "@/features/supply-requests/validation";

function validInput(
  overrides: Partial<CreateSupplyRequestInput> = {},
): CreateSupplyRequestInput {
  return {
    operationalWorkDate: "2026-07-28",
    submittedLocalDate: "2026-07-29",
    submittedLocalTime: "01:15",
    equipmentId: "equipment-1",
    supervisorId: "supervisor-1",
    notes: "  Upcoming scheduled PM  ",
    corporateSubmissionConfirmed: true,
    items: [
      { supplyItemId: "item-a", quantity: 2 },
      { supplyItemId: "item-b", quantity: 7 },
    ],
    ...overrides,
  };
}

describe("Supply Request normalization", () => {
  it("normalizes Item Number display whitespace without changing case or punctuation", () => {
    expect(
      normalizeSupplyItemNumberDisplay("\u00a0 ab-12 / X   4 \u2003"),
    ).toBe("ab-12 / X 4");
  });

  it("creates a locale-independent uppercase Item Number key and preserves punctuation", () => {
    expect(normalizeSupplyItemNumberKey(" i-ı / ab.12 ")).toBe(
      "I-I / AB.12",
    );
  });

  it("normalizes supervisor display names while preserving letter case", () => {
    expect(normalizeSupervisorFullName("  Pablo\u2003  Gonzalez ")).toBe(
      "Pablo Gonzalez",
    );
  });

  it("trims supervisor email display and lowercases its identity key", () => {
    expect(normalizeSupervisorEmail("  Pablo.Gonzalez@Example.COM ")).toEqual({
      displayEmail: "Pablo.Gonzalez@Example.COM",
      normalizedEmail: "pablo.gonzalez@example.com",
    });
  });

  it("rejects supervisor emails with internal whitespace or invalid syntax", () => {
    expect(() =>
      normalizeSupervisorEmail("pablo. gonzalez@example.com"),
    ).toThrow(SupplyRequestNormalizationError);
    expect(() => normalizeSupervisorEmail("not-an-email")).toThrow(
      "Enter a valid supervisor email address.",
    );
  });
});

describe("Supply Request initial-create validation", () => {
  it("owns the approved immutable requester identity", () => {
    expect(supplyRequestRequester).toEqual({
      displayName: "Alain Alemany",
      employeeNumber: "911601",
    });
    expect(Object.isFrozen(supplyRequestRequester)).toBe(true);
  });

  it("accepts strict real dates and rejects impossible or noncanonical dates", () => {
    expect(isCanonicalSupplyRequestDate("2024-02-29")).toBe(true);
    expect(isCanonicalSupplyRequestDate("2026-02-29")).toBe(false);
    expect(isCanonicalSupplyRequestDate("0000-01-01")).toBe(false);
    expect(isCanonicalSupplyRequestDate("2026-7-09")).toBe(false);
    expect(isCanonicalSupplyRequestDate("9999-12-31")).toBe(true);
    expect(isCanonicalSupplyRequestDate("10000-01-01")).toBe(false);
  });

  it("accepts only canonical minute-precision local times", () => {
    expect(isCanonicalSupplyRequestLocalTime("00:00")).toBe(true);
    expect(isCanonicalSupplyRequestLocalTime("23:59")).toBe(true);
    expect(isCanonicalSupplyRequestLocalTime("24:00")).toBe(false);
    expect(isCanonicalSupplyRequestLocalTime("1:15")).toBe(false);
    expect(isCanonicalSupplyRequestLocalTime("01:15:00")).toBe(false);
    expect(isCanonicalSupplyRequestLocalTime("01:15Z")).toBe(false);
  });

  it("trims Notes and converts blank Notes to absent", () => {
    expect(parseCreateSupplyRequestInput(validInput()).notes).toBe(
      "Upcoming scheduled PM",
    );
    expect(
      parseCreateSupplyRequestInput(validInput({ notes: " \u2003 " })).notes,
    ).toBeUndefined();
  });

  it("enforces item-count bounds", () => {
    expect(() =>
      parseCreateSupplyRequestInput(validInput({ items: [] })),
    ).toThrow(SupplyRequestCreateError);
    expect(() =>
      parseCreateSupplyRequestInput(
        validInput({
          items: Array.from({ length: 51 }, (_, index) => ({
            supplyItemId: `item-${index}`,
            quantity: 1,
          })),
        }),
      ),
    ).toThrow(SupplyRequestCreateError);
  });

  it.each([
    0,
    -1,
    1.5,
    1_000_000,
    Number.MAX_SAFE_INTEGER + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])(
    "rejects invalid quantity %s",
    (quantity) => {
      expect(() =>
        parseCreateSupplyRequestInput(
          validInput({ items: [{ supplyItemId: "item-a", quantity }] }),
        ),
      ).toThrow(SupplyRequestCreateError);
    },
  );

  it("rejects duplicate Supply Item selections before persistence", () => {
    expect(() =>
      parseCreateSupplyRequestInput(
        validInput({
          items: [
            { supplyItemId: "item-a", quantity: 1 },
            { supplyItemId: "item-a", quantity: 2 },
          ],
        }),
      ),
    ).toThrow(
      expect.objectContaining({ code: "DUPLICATE_ITEM_SELECTION" }),
    );
  });

  it("canonicalizes submitted item order into contiguous one-based sequence", () => {
    expect(
      canonicalSupplyRequestItems(
        parseCreateSupplyRequestInput(validInput()).items,
      ),
    ).toEqual([
      { supplyItemId: "item-a", quantity: 2, sequence: 1 },
      { supplyItemId: "item-b", quantity: 7, sequence: 2 },
    ]);
  });

  it("requires exact corporate-submission confirmation and rejects extra fields", () => {
    expect(() =>
      parseCreateSupplyRequestInput(
        validInput({ corporateSubmissionConfirmed: false }),
      ),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));

    expect(() =>
      parseCreateSupplyRequestInput({
        ...validInput(),
        items: [
          {
            supplyItemId: "item-a",
            quantity: 1,
            sequence: 99,
            unit: "Caller-owned",
          },
        ],
      } as unknown as CreateSupplyRequestInput),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));

    expect(() =>
      parseCreateSupplyRequestInput({
        ...validInput(),
        namReference: "CALLER-OWNED",
      } as CreateSupplyRequestInput),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });
});

describe("Supply Request reference and retry behavior", () => {
  it("formats four-digit and expanded annual references", () => {
    expect(formatSupplyRequestNamReference(2026, 1)).toBe("SR-2026-0001");
    expect(formatSupplyRequestNamReference(2026, 10_000)).toBe(
      "SR-2026-10000",
    );
  });

  it("recognizes only approved transient failures and allocator conflicts", () => {
    expect(isRetryableSupplyRequestPersistenceError({ code: "P2034" })).toBe(
      true,
    );
    expect(
      isRetryableSupplyRequestPersistenceError({
        code: "P2010",
        meta: { code: "40P01" },
      }),
    ).toBe(true);
    expect(
      isRetryableSupplyRequestPersistenceError({
        code: "P2002",
        meta: { target: ["referenceYear", "referenceSequence"] },
      }),
    ).toBe(true);
    expect(
      isRetryableSupplyRequestPersistenceError({
        code: "P2002",
        meta: { target: ["normalizedEmail"] },
      }),
    ).toBe(false);
    expect(
      isRetryableSupplyRequestPersistenceError({
        code: "P2002",
        meta: { target: ["referenceYear", "unexpected"] },
      }),
    ).toBe(false);
    expect(
      isRetryableSupplyRequestPersistenceError({
        code: "P2002",
        meta: { target: ["versionId", "sequence"] },
      }),
    ).toBe(false);
    expect(
      isRetryableSupplyRequestPersistenceError({ code: "P1001" }),
    ).toBe(false);
    expect(
      isRetryableSupplyRequestPersistenceError({ code: "P1002" }),
    ).toBe(false);
    expect(
      isRetryableSupplyRequestPersistenceError({ code: "P2028" }),
    ).toBe(false);
    expect(
      isRetryableSupplyRequestPersistenceError(
        new SupplyRequestCreateError("INVALID_INPUT", "Invalid."),
      ),
    ).toBe(false);
  });

  it("retries the complete operation and succeeds within three total attempts", async () => {
    let attempts = 0;
    await expect(
      runSupplyRequestCreateWithRetry(async (attempt) => {
        attempts += 1;
        if (attempt < 3) throw { code: "P2034" };
        return "committed";
      }),
    ).resolves.toBe("committed");
    expect(attempts).toBe(3);
  });

  it("stops after three transient failures with a safe exhaustion error", async () => {
    let attempts = 0;
    await expect(
      runSupplyRequestCreateWithRetry(async () => {
        attempts += 1;
        throw { code: "P2034", message: "database detail" };
      }),
    ).rejects.toMatchObject({
      code: "RETRY_EXHAUSTED",
      message: expect.not.stringContaining("database detail"),
    });
    expect(attempts).toBe(3);
  });

  it("does not retry business or unknown errors", async () => {
    let attempts = 0;
    const error = new SupplyRequestCreateError(
      "SUPPLY_ITEM_INACTIVE",
      "Inactive.",
    );
    await expect(
      runSupplyRequestCreateWithRetry(async () => {
        attempts += 1;
        throw error;
      }),
    ).rejects.toBe(error);
    expect(attempts).toBe(1);
  });

  it("maps unexpected persistence failures to credential-safe NAM wording", () => {
    const safe = unexpectedSupplyRequestPersistenceError();
    expect(safe).toMatchObject({
      code: "UNEXPECTED_PERSISTENCE",
      message: "The submitted request could not be recorded in NAM. Try again.",
    });
    expect(safe.message).not.toMatch(/postgres|password|corporate submission/i);
  });
});
