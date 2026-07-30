import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  parseSupplyRequestReferenceFilters,
  supplyRequestReferencePageHref,
} from "@/features/supply-requests/reference-filters";
import {
  createSupervisorReferenceWithClient,
  createSupplyItemReferenceWithClient,
} from "@/features/supply-requests/reference-persistence-internal";
import {
  parseReferenceStatusIntent,
  parseSupervisorReferenceInput,
  parseSupplyItemReferenceInput,
} from "@/features/supply-requests/reference-validation";

describe("Supply Request reference validation", () => {
  it("normalizes Supply Item display fields and server-owned identity", () => {
    expect(
      parseSupplyItemReferenceInput({
        itemNumber: "  ab-12 / X   4 ",
        description: "  Main   filter  ",
        unitOfMeasure: "  Each  ",
      }),
    ).toEqual({
      itemNumber: "ab-12 / X 4",
      normalizedItemNumber: "AB-12 / X 4",
      description: "Main filter",
      unitOfMeasure: "Each",
    });
  });

  it("enforces Supply Item normalized limits and rejects unknown fields", () => {
    expect(() =>
      parseSupplyItemReferenceInput({
        itemNumber: " ".repeat(20),
        description: "Filter",
        unitOfMeasure: "Each",
      }),
    ).toThrow();
    expect(() =>
      parseSupplyItemReferenceInput({
        itemNumber: `${"A".repeat(100)}   `,
        description: "D".repeat(500),
        unitOfMeasure: "U".repeat(100),
      }),
    ).not.toThrow();
    expect(() =>
      parseSupplyItemReferenceInput({
        itemNumber: "A-1",
        description: "Filter",
        unitOfMeasure: "Each",
        normalizedItemNumber: "CALLER",
      }),
    ).toThrow();
  });

  it("preserves punctuation and handles Unicode whitespace and case deterministically", () => {
    expect(
      parseSupplyItemReferenceInput({
        itemNumber: "\u2003straße / #1\u00a0",
        description: "\u00a0Filter\u2003element\u00a0",
        unitOfMeasure: "  Each\tBox  ",
      }),
    ).toEqual({
      itemNumber: "straße / #1",
      normalizedItemNumber: "STRASSE / #1",
      description: "Filter element",
      unitOfMeasure: "Each Box",
    });
    expect(
      parseSupplyItemReferenceInput({
        itemNumber: "---",
        description: "Punctuation-preserving item",
        unitOfMeasure: "Each",
      }).itemNumber,
    ).toBe("---");
  });

  it("applies display limits after normalization", () => {
    expect(() =>
      parseSupplyItemReferenceInput({
        itemNumber: `  ${"A".repeat(100)}  `,
        description: `  ${"D".repeat(500)}  `,
        unitOfMeasure: `  ${"U".repeat(100)}  `,
      }),
    ).not.toThrow();
    expect(() =>
      parseSupplyItemReferenceInput({
        itemNumber: "A".repeat(101),
        description: "Description",
        unitOfMeasure: "Each",
      }),
    ).toThrow();
    expect(() =>
      parseSupplyItemReferenceInput({
        itemNumber: "A-1",
        description: "D".repeat(501),
        unitOfMeasure: "Each",
      }),
    ).toThrow();
  });

  it("normalizes supervisor names and email identity while preserving display email", () => {
    expect(
      parseSupervisorReferenceInput({
        fullName: "  Pablo\u2003 Gonzalez ",
        email: " Pablo.Gonzalez@Example.COM ",
      }),
    ).toEqual({
      fullName: "Pablo Gonzalez",
      email: "Pablo.Gonzalez@Example.COM",
      normalizedEmail: "pablo.gonzalez@example.com",
    });
  });

  it("rejects supervisor limits, internal email whitespace, and unknown fields", () => {
    expect(() =>
      parseSupervisorReferenceInput({
        fullName: "P".repeat(201),
        email: "pablo@example.com",
      }),
    ).toThrow();
    expect(() =>
      parseSupervisorReferenceInput({
        fullName: "Pablo",
        email: "pablo @example.com",
      }),
    ).toThrow();
    expect(() =>
      parseSupervisorReferenceInput({
        fullName: "Pablo",
        email: "pablo@example.com",
        userId: "caller-owned",
      }),
    ).toThrow();
  });

  it("rejects blank names, malformed addresses, and non-ASCII email forms outside V1", () => {
    expect(() =>
      parseSupervisorReferenceInput({
        fullName: "\u2003\u00a0",
        email: "pablo@example.com",
      }),
    ).toThrow();
    for (const email of [
      "not-an-address",
      "pablo@@example.com",
      "ü@example.com",
      "pablo@exämple.com",
    ]) {
      expect(() =>
        parseSupervisorReferenceInput({
          fullName: "Pablo Gonzalez",
          email,
        }),
      ).toThrow();
    }
  });

  it("parses only explicit activation intents", () => {
    expect(parseReferenceStatusIntent("activate")).toBe("activate");
    expect(parseReferenceStatusIntent("inactivate")).toBe("inactivate");
    expect(() => parseReferenceStatusIntent("delete")).toThrow();
  });
});

describe("Supply Request reference URL parsing", () => {
  it("uses first repeated values and trims search", () => {
    expect(
      parseSupplyRequestReferenceFilters({
        q: ["  filter  ", "ignored"],
        status: ["inactive", "active"],
        page: ["2", "9"],
      }),
    ).toEqual({
      filters: { q: "filter", status: "inactive", page: 2 },
      ignoredInvalidParameters: false,
    });
  });

  it("defaults invalid status and page without crashing", () => {
    expect(
      parseSupplyRequestReferenceFilters({
        q: " ".repeat(201),
        status: "retired",
        page: "1.5",
      }),
    ).toEqual({
      filters: { status: "all", page: 1 },
      ignoredInvalidParameters: true,
    });
  });

  it("handles empty repeated values, huge safe pages, and Unicode search terms", () => {
    expect(
      parseSupplyRequestReferenceFilters({
        q: ["   ", "ignored"],
        status: ["", "active"],
        page: String(Number.MAX_SAFE_INTEGER),
      }),
    ).toEqual({
      filters: { status: "all", page: Number.MAX_SAFE_INTEGER },
      ignoredInvalidParameters: false,
    });
    expect(
      parseSupplyRequestReferenceFilters({ q: "  filtro número  " }).filters,
    ).toEqual({ q: "filtro número", status: "all", page: 1 });
  });

  it("preserves normalized filters in pagination links", () => {
    expect(
      supplyRequestReferencePageHref(
        "/supply-requests/items",
        { q: "Filter / A", status: "inactive", page: 2 },
        3,
      ),
    ).toBe(
      "/supply-requests/items?q=Filter+%2F+A&status=inactive&page=3",
    );
  });
});

describe("Supply Request reference uniqueness mapping", () => {
  it("maps only the exact normalized Item Number constraint", async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["normalizedItemNumber"] },
    });
    const client = {
      supplyItem: { create: vi.fn().mockRejectedValue(duplicate) },
    };
    await expect(
      createSupplyItemReferenceWithClient(client as never, {
        itemNumber: "A-1",
        description: "Filter",
        unitOfMeasure: "Each",
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_ITEM_NUMBER",
      field: "itemNumber",
    });

    client.supplyItem.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["unrelated"] },
      }),
    );
    await expect(
      createSupplyItemReferenceWithClient(client as never, {
        itemNumber: "A-1",
        description: "Filter",
        unitOfMeasure: "Each",
      }),
    ).rejects.toMatchObject({ code: "UNEXPECTED_PERSISTENCE" });
  });

  it("maps only the exact normalized supervisor email constraint", async () => {
    const client = {
      supplyRequestSupervisor: {
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("Unique", {
            code: "P2002",
            clientVersion: "test",
            meta: { target: ["normalizedEmail"] },
          }),
        ),
      },
    };
    await expect(
      createSupervisorReferenceWithClient(client as never, {
        fullName: "Pablo Gonzalez",
        email: "pablo@example.com",
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_SUPERVISOR_EMAIL",
      field: "email",
    });
  });
});
