import { describe, expect, it, vi } from "vitest";

import { SupplyRequestLifecycleError } from "@/features/supply-requests/lifecycle-errors";
import {
  fulfillSupplyRequestWithDependencies,
} from "@/features/supply-requests/lifecycle-persistence-internal";
import {
  isRetryableSupplyRequestLifecycleError,
  runSupplyRequestLifecycleWithRetry,
} from "@/features/supply-requests/lifecycle-retry";
import {
  isLifecycleWallClockBeforeSubmission,
  parseCancelSupplyRequestInput,
  parseFulfillSupplyRequestInput,
} from "@/features/supply-requests/lifecycle-validation";

function currentVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-1",
    supplyRequestId: "request-1",
    versionNumber: 1,
    changeKind: "CREATED",
    status: "REQUESTED",
    operationalWorkDate: new Date("2026-07-28T00:00:00.000Z"),
    submittedLocalDate: new Date("2026-07-29T00:00:00.000Z"),
    submittedLocalTime: "01:15",
    equipmentId: null,
    equipmentDisplayNameSnapshot: "Dragline 101",
    equipmentNumberSnapshot: "101",
    equipmentCategorySnapshot: "DRAGLINE",
    mineNameSnapshot: "Black Thunder",
    cityNameSnapshot: "Wright",
    cityStateSnapshot: "WY",
    requesterDisplayNameSnapshot: "Alain Alemany",
    requesterEmployeeNumberSnapshot: "911601",
    supervisorId: "supervisor-1",
    supervisorNameSnapshot: "Pablo Gonzalez",
    supervisorEmailSnapshot: "pablo@example.com",
    notes: "Original Notes",
    fulfillmentOperationalWorkDate: null,
    fulfilledLocalDate: null,
    fulfilledLocalTime: null,
    fulfillmentNote: null,
    cancelledLocalDate: null,
    cancelledLocalTime: null,
    cancellationReason: null,
    correctionReason: null,
    correctedByDisplayNameSnapshot: null,
    correctionLocalDate: null,
    correctionLocalTime: null,
    items: [
      {
        id: "old-line-1",
        supplyItemId: "item-1",
        sequence: 1,
        quantity: 3,
        itemNumberSnapshot: "A-1",
        normalizedItemNumberSnapshot: "A-1",
        descriptionSnapshot: "Filter",
        unitOfMeasureSnapshot: "Each",
      },
      {
        id: "old-line-2",
        supplyItemId: "item-2",
        sequence: 2,
        quantity: 4,
        itemNumberSnapshot: "B-2",
        normalizedItemNumberSnapshot: "B-2",
        descriptionSnapshot: "Seal",
        unitOfMeasureSnapshot: "Box",
      },
    ],
    ...overrides,
  };
}

function fakeClient(options: {
  failCreates?: number;
  current?: ReturnType<typeof currentVersion>;
  lockedRows?: readonly { id: string }[];
  currentVersionId?: string | null;
} = {}) {
  const calls: string[] = [];
  const created: Array<Record<string, unknown>> = [];
  let failures = options.failCreates ?? 0;
  const transaction = {
    $queryRaw: vi.fn(async () => {
      calls.push("lock");
      return options.lockedRows ?? [{ id: "request-1" }];
    }),
    supplyRequest: {
      findUnique: vi.fn(async () => {
        calls.push("load");
        return {
          id: "request-1",
          namReference: "SR-2026-0001",
          currentVersionId:
            options.currentVersionId === undefined
              ? "version-1"
              : options.currentVersionId,
          currentVersion: options.current ?? currentVersion(),
        };
      }),
      update: vi.fn(async ({
        data,
      }: {
        data: {
          currentVersion: {
            connect: { id_supplyRequestId: { id: string } };
          };
        };
      }) => {
        calls.push("pointer");
        return {
          id: "request-1",
          namReference: "SR-2026-0001",
          currentVersionId: data.currentVersion.connect.id_supplyRequestId.id,
        };
      }),
    },
    supplyRequestVersion: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        calls.push("version");
        created.push(data);
        if (failures > 0) {
          failures -= 1;
          throw { code: "P2034" };
        }
        return {
          id: data.id,
          versionNumber: data.versionNumber,
          status: data.status,
        };
      }),
    },
  };
  const client = {
    $transaction: vi.fn(
      async (operation: (tx: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
  };
  return { client: client as never, clientMock: client, transaction, calls, created };
}

describe("Supply Request lifecycle validation and persistence helpers", () => {
  it("strictly validates shared fulfillment input", () => {
    expect(
      parseFulfillSupplyRequestInput({
        supplyRequestId: " request-1 ",
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "2026-07-29",
        fulfillmentNote: "  Received completely.  ",
      }),
    ).toEqual({
      supplyRequestId: "request-1",
      expectedCurrentVersionNumber: 1,
      fulfillmentOperationalWorkDate: "2026-07-29",
      fulfillmentNote: "Received completely.",
    });

    for (const expectedCurrentVersionNumber of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER,
      2_147_483_648,
      "1",
    ]) {
      expect(() =>
        parseFulfillSupplyRequestInput({
          supplyRequestId: "request-1",
          expectedCurrentVersionNumber: expectedCurrentVersionNumber as never,
          fulfillmentOperationalWorkDate: "2026-07-29",
        }),
      ).toThrow(SupplyRequestLifecycleError);
    }
  });

  it("rejects blank and overlong IDs, impossible dates, and unknown fields", () => {
    expect(() =>
      parseFulfillSupplyRequestInput({
        supplyRequestId: " \u2003 ",
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "2026-02-30",
      }),
    ).toThrow(SupplyRequestLifecycleError);
    expect(() =>
      parseFulfillSupplyRequestInput({
        supplyRequestId: "x".repeat(101),
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "2026-07-29",
      }),
    ).toThrow(SupplyRequestLifecycleError);
    expect(() =>
      parseFulfillSupplyRequestInput({
        supplyRequestId: "request-1",
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "2025-02-29",
      }),
    ).toThrow(SupplyRequestLifecycleError);
    expect(() =>
      parseFulfillSupplyRequestInput({
        supplyRequestId: "request-1",
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: " 2026-07-29 ",
      }),
    ).toThrow(SupplyRequestLifecycleError);
    expect(() =>
      parseFulfillSupplyRequestInput({
        supplyRequestId: "request-1",
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "2026-07-29",
        status: "FULFILLED",
      } as never),
    ).toThrow(SupplyRequestLifecycleError);
  });

  it("normalizes optional lifecycle narratives and enforces 1000 characters", () => {
    expect(
      parseCancelSupplyRequestInput({
        supplyRequestId: "request-1",
        expectedCurrentVersionNumber: 1,
        cancellationReason: "   ",
      }).cancellationReason,
    ).toBeUndefined();
    expect(
      parseCancelSupplyRequestInput({
        supplyRequestId: "request-1",
        expectedCurrentVersionNumber: 1,
        cancellationReason: "x".repeat(1000),
      }).cancellationReason,
    ).toHaveLength(1000);
    expect(() =>
      parseCancelSupplyRequestInput({
        supplyRequestId: "request-1",
        expectedCurrentVersionNumber: 1,
        cancellationReason: "x".repeat(1001),
      }),
    ).toThrow(SupplyRequestLifecycleError);
    expect(
      parseFulfillSupplyRequestInput({
        supplyRequestId: "request-1",
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "2026-07-29",
        fulfillmentNote: "x".repeat(1000),
      }).fulfillmentNote,
    ).toHaveLength(1000);
    expect(() =>
      parseFulfillSupplyRequestInput({
        supplyRequestId: "request-1",
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "2026-07-29",
        fulfillmentNote: "x".repeat(1001),
      }),
    ).toThrow(SupplyRequestLifecycleError);
  });

  it("compares canonical local wall-clock facts without UTC conversion", () => {
    expect(
      isLifecycleWallClockBeforeSubmission(
        "2026-07-29",
        "01:15",
        "2026-07-29",
        "01:15",
      ),
    ).toBe(false);
    expect(
      isLifecycleWallClockBeforeSubmission(
        "2026-07-29",
        "01:14",
        "2026-07-29",
        "01:15",
      ),
    ).toBe(true);
    expect(
      isLifecycleWallClockBeforeSubmission(
        "2026-07-30",
        "00:00",
        "2026-07-29",
        "23:59",
      ),
    ).toBe(false);
  });

  it("classifies only recognized rollback-only transaction errors as retryable", () => {
    expect(isRetryableSupplyRequestLifecycleError({ code: "P2034" })).toBe(true);
    expect(isRetryableSupplyRequestLifecycleError({ code: "40001" })).toBe(true);
    expect(isRetryableSupplyRequestLifecycleError({ code: "40P01" })).toBe(true);
    expect(
      isRetryableSupplyRequestLifecycleError({
        code: "P2010",
        meta: { code: "40001" },
      }),
    ).toBe(true);
    for (const code of ["P2002", "P1001", "P2028", "08006", "ETIMEDOUT"]) {
      expect(isRetryableSupplyRequestLifecycleError({ code })).toBe(false);
    }
  });

  it("uses exactly three total retry attempts and stops on business errors", async () => {
    const transient = vi.fn(async () => {
      throw { code: "P2034" };
    });
    await expect(runSupplyRequestLifecycleWithRetry(transient)).rejects.toMatchObject({
      code: "RETRY_EXHAUSTED",
    });
    expect(transient).toHaveBeenCalledTimes(3);

    const business = vi.fn(async () => {
      throw new SupplyRequestLifecycleError("STALE_VERSION", "Reload.");
    });
    await expect(runSupplyRequestLifecycleWithRetry(business)).rejects.toMatchObject({
      code: "STALE_VERSION",
    });
    expect(business).toHaveBeenCalledOnce();
  });

  it("locks before loading, copies snapshots and lines, then advances the pointer", async () => {
    const fake = fakeClient();
    const ids = ["version-2", "new-line-1", "new-line-2"];
    const result = await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: "request-1",
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "2026-07-29",
        fulfillmentNote: " Complete ",
      },
      {
        client: fake.client,
        now: () => new Date("2026-07-29T06:20:00.000Z"),
        generateId: () => ids.shift() ?? "unexpected",
      },
    );
    expect(fake.calls).toEqual(["lock", "load", "version", "pointer"]);
    expect(result).toEqual({
      supplyRequestId: "request-1",
      namReference: "SR-2026-0001",
      currentVersionId: "version-2",
      newVersionNumber: 2,
      status: "FULFILLED",
    });
    expect(fake.created[0]).toMatchObject({
      id: "version-2",
      versionNumber: 2,
      changeKind: "FULFILLED",
      status: "FULFILLED",
      equipmentId: null,
      mineNameSnapshot: "Black Thunder",
      notes: "Original Notes",
      fulfilledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
      fulfilledLocalTime: "02:20",
      fulfillmentNote: "Complete",
      cancelledLocalDate: null,
      correctionReason: null,
      items: {
        create: [
          expect.objectContaining({ id: "new-line-1", sequence: 1, quantity: 3 }),
          expect.objectContaining({ id: "new-line-2", sequence: 2, quantity: 4 }),
        ],
      },
    });
  });

  it("reuses one captured timestamp and regenerates IDs across a full retry", async () => {
    const fake = fakeClient({ failCreates: 1 });
    const now = vi.fn(() => new Date("2026-07-29T06:20:00.000Z"));
    let id = 0;
    const result = await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: "request-1",
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "2026-07-29",
      },
      {
        client: fake.client,
        now,
        generateId: () => `attempt-id-${++id}`,
      },
    );
    expect(now).toHaveBeenCalledOnce();
    expect(fake.created).toHaveLength(2);
    expect(fake.created[0].id).not.toBe(fake.created[1].id);
    expect(fake.created[0].fulfilledLocalTime).toBe("02:20");
    expect(fake.created[1].fulfilledLocalTime).toBe("02:20");
    expect(result.newVersionNumber).toBe(2);
  });

  it("checks stale expected version before terminal status and never retries it", async () => {
    const fake = fakeClient({
      current: currentVersion({ versionNumber: 2, status: "FULFILLED" }),
    });
    await expect(
      fulfillSupplyRequestWithDependencies(
        {
          supplyRequestId: "request-1",
          expectedCurrentVersionNumber: 1,
          fulfillmentOperationalWorkDate: "2026-07-29",
        },
        {
          client: fake.client,
          now: () => new Date("2026-07-29T06:20:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    expect(fake.clientMock.$transaction).toHaveBeenCalledOnce();
    expect(fake.transaction.supplyRequestVersion.create).not.toHaveBeenCalled();
  });

  it("maps a missing locked root and rejects a null current pointer without guessing", async () => {
    const missing = fakeClient({ lockedRows: [] });
    await expect(
      fulfillSupplyRequestWithDependencies(
        {
          supplyRequestId: "request-1",
          expectedCurrentVersionNumber: 1,
          fulfillmentOperationalWorkDate: "2026-07-29",
        },
        {
          client: missing.client,
          now: () => new Date("2026-07-29T06:20:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_FOUND" });
    expect(missing.transaction.supplyRequest.findUnique).not.toHaveBeenCalled();

    const invalid = fakeClient({ currentVersionId: null });
    await expect(
      fulfillSupplyRequestWithDependencies(
        {
          supplyRequestId: "request-1",
          expectedCurrentVersionNumber: 1,
          fulfillmentOperationalWorkDate: "2026-07-29",
        },
        {
          client: invalid.client,
          now: () => new Date("2026-07-29T06:20:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({ code: "CURRENT_VERSION_INVALID" });
    expect(invalid.transaction.supplyRequestVersion.create).not.toHaveBeenCalled();
  });

  it("rejects unexpected lock results and malformed authoritative current facts", async () => {
    const mismatchedLock = fakeClient({
      lockedRows: [{ id: "different-request" }],
    });
    await expect(
      fulfillSupplyRequestWithDependencies(
        {
          supplyRequestId: "request-1",
          expectedCurrentVersionNumber: 1,
          fulfillmentOperationalWorkDate: "2026-07-29",
        },
        {
          client: mismatchedLock.client,
          now: () => new Date("2026-07-29T06:20:00.000Z"),
        },
      ),
    ).rejects.toMatchObject({ code: "CURRENT_VERSION_INVALID" });
    expect(
      mismatchedLock.transaction.supplyRequest.findUnique,
    ).not.toHaveBeenCalled();

    for (const current of [
      currentVersion({ versionNumber: 0 }),
      currentVersion({ versionNumber: 2_147_483_648 }),
      currentVersion({ submittedLocalTime: "1:15" }),
      currentVersion({ submittedLocalTime: "not-a-time" }),
      currentVersion({ operationalWorkDate: new Date(Number.NaN) }),
    ]) {
      const invalid = fakeClient({ current });
      await expect(
        fulfillSupplyRequestWithDependencies(
          {
            supplyRequestId: "request-1",
            expectedCurrentVersionNumber: Math.max(
              1,
              Math.min(current.versionNumber, 2_147_483_647),
            ),
            fulfillmentOperationalWorkDate: "2026-07-29",
          },
          {
            client: invalid.client,
            now: () => new Date("2026-07-29T06:20:00.000Z"),
          },
        ),
      ).rejects.toMatchObject({
        code: "CURRENT_VERSION_INVALID",
      });
      expect(
        invalid.transaction.supplyRequestVersion.create,
      ).not.toHaveBeenCalled();
    }
  });
});
