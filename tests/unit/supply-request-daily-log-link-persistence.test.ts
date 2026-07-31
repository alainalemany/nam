import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  removeSupplyRequestDailyLogLinkWithDependencies,
  setSupplyRequestDailyLogLinkWithDependencies,
} from "@/features/supply-requests/daily-log-link-persistence-internal";

function currentVersion() {
  return {
    id: "version-1",
    supplyRequestId: "request-1",
    versionNumber: 1,
    changeKind: "CREATED",
    status: "REQUESTED",
    operationalWorkDate: new Date("2026-07-30T00:00:00.000Z"),
    submittedLocalDate: new Date("2026-07-30T00:00:00.000Z"),
    submittedLocalTime: "08:00",
    equipmentId: "equipment-1",
    equipment: { id: "equipment-1" },
    equipmentDisplayNameSnapshot: "Dragline 101",
    equipmentNumberSnapshot: "101",
    equipmentCategorySnapshot: "DRAGLINE",
    mineNameSnapshot: "Mine A",
    cityNameSnapshot: "Wright",
    cityStateSnapshot: "WY",
    requesterDisplayNameSnapshot: "Alain Alemany",
    requesterEmployeeNumberSnapshot: "911601",
    supervisorId: "supervisor-1",
    supervisorNameSnapshot: "Supervisor One",
    supervisorEmailSnapshot: "one@example.com",
    notes: null,
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
    createdAt: new Date("2026-07-30T12:00:00.000Z"),
    items: [
      {
        id: "line-1",
        supplyItemId: "item-1",
        sequence: 1,
        itemNumberSnapshot: "A-1",
        normalizedItemNumberSnapshot: "A-1",
        descriptionSnapshot: "Filter",
        quantity: 1,
        unitOfMeasureSnapshot: "Each",
      },
    ],
  };
}

function fake(options: {
  existing?: { id: string; dailyLogActivityId: string } | null;
  targetLink?: { id: string; supplyRequestId: string; role: "SUBMISSION" | "FULFILLMENT" } | null;
  activityTitle?: string;
} = {}) {
  const calls: string[] = [];
  let rawCall = 0;
  const existing = options.existing ?? null;
  const transaction = {
    $queryRaw: vi.fn(async () => {
      rawCall += 1;
      if (rawCall === 1) {
        calls.push("root-lock");
        return [{ id: "request-1" }];
      }
      calls.push("activity-lock");
      return [{ id: "activity-1" }];
    }),
    supplyRequest: {
      findUnique: vi.fn(async ({ select }: { select: Record<string, unknown> }) => {
        calls.push("request-load");
        if ("currentVersion" in select) {
          return {
            id: "request-1",
            namReference: "SR-2026-0001",
            currentVersionId: "version-1",
            currentVersion: currentVersion(),
          };
        }
        return { id: "request-1", namReference: "SR-2026-0001" };
      }),
    },
    supplyRequestDailyLogLink: {
      findUnique: vi.fn(async () => {
        calls.push("existing-link");
        return existing;
      }),
      create: vi.fn(async () => {
        calls.push("create-link");
        return { id: "link-new" };
      }),
      delete: vi.fn(async () => {
        calls.push("delete-link");
        return existing;
      }),
    },
    dailyLogActivity: {
      findUnique: vi.fn(async () => {
        calls.push("activity-load");
        return {
          id: "activity-1",
          activityType: "SUPPLY_REQUEST",
          title:
            options.activityTitle ??
            "Submitted supply request SR-2026-0001 for Dragline 101 · 101.",
          activityDate: new Date("2026-07-30T00:00:00.000Z"),
          equipmentId: "equipment-1",
          dailyLog: {
            id: "log-1",
            logDate: new Date("2026-07-30T00:00:00.000Z"),
          },
          supplyRequestLink: options.targetLink ?? null,
        };
      }),
    },
  };
  const client = {
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  };
  return { client: client as never, transaction, calls };
}

describe("Supply Request Daily Log link persistence", () => {
  it("locks root and Activity, validates, then creates a narrow role link", async () => {
    const db = fake();
    await expect(
      setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: "request-1",
          role: "SUBMISSION",
          dailyLogActivityId: "activity-1",
        },
        { client: db.client, generateId: () => "link-1" },
      ),
    ).resolves.toEqual({
      supplyRequestId: "request-1",
      namReference: "SR-2026-0001",
      role: "SUBMISSION",
      dailyLogActivityId: "activity-1",
      operation: "CREATED",
    });
    expect(db.calls).toEqual([
      "root-lock",
      "request-load",
      "existing-link",
      "activity-lock",
      "activity-load",
      "create-link",
    ]);
  });

  it("returns idempotent retained success without rewriting the same link", async () => {
    const db = fake({
      existing: { id: "link-1", dailyLogActivityId: "activity-1" },
      targetLink: {
        id: "link-1",
        supplyRequestId: "request-1",
        role: "SUBMISSION",
      },
    });
    await expect(
      setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: "request-1",
          role: "SUBMISSION",
          dailyLogActivityId: "activity-1",
          expectedDailyLogActivityId: "activity-1",
        },
        { client: db.client },
      ),
    ).resolves.toMatchObject({ operation: "RETAINED" });
    expect(db.transaction.supplyRequestDailyLogLink.create).not.toHaveBeenCalled();
    expect(db.transaction.supplyRequestDailyLogLink.delete).not.toHaveBeenCalled();
  });

  it("rejects stale expected state before target Activity resolution", async () => {
    const db = fake({
      existing: { id: "link-1", dailyLogActivityId: "activity-old" },
    });
    await expect(
      setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: "request-1",
          role: "SUBMISSION",
          dailyLogActivityId: "activity-1",
          expectedDailyLogActivityId: "different-old",
        },
        { client: db.client },
      ),
    ).rejects.toMatchObject({ code: "STALE_LINK_STATE" });
    expect(db.transaction.dailyLogActivity.findUnique).not.toHaveBeenCalled();
  });

  it("validates a replacement fully before deleting the old link", async () => {
    const db = fake({
      existing: { id: "link-old", dailyLogActivityId: "activity-old" },
      activityTitle: "Near-match title",
    });
    await expect(
      setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: "request-1",
          role: "SUBMISSION",
          dailyLogActivityId: "activity-1",
          expectedDailyLogActivityId: "activity-old",
        },
        { client: db.client },
      ),
    ).rejects.toMatchObject({ code: "ACTIVITY_TITLE_MISMATCH" });
    expect(db.transaction.supplyRequestDailyLogLink.delete).not.toHaveBeenCalled();
  });

  it("rejects globally reused Activities and never deletes them", async () => {
    const db = fake({
      targetLink: {
        id: "other-link",
        supplyRequestId: "request-2",
        role: "FULFILLMENT",
      },
    });
    await expect(
      setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: "request-1",
          role: "SUBMISSION",
          dailyLogActivityId: "activity-1",
        },
        { client: db.client },
      ),
    ).rejects.toMatchObject({ code: "ACTIVITY_ALREADY_LINKED" });
    expect(db.transaction.supplyRequestDailyLogLink.create).not.toHaveBeenCalled();
  });

  it("removes only the expected link under the root lock", async () => {
    const db = fake({
      existing: { id: "link-1", dailyLogActivityId: "activity-1" },
    });
    await expect(
      removeSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: "request-1",
          role: "SUBMISSION",
          expectedDailyLogActivityId: "activity-1",
        },
        { client: db.client },
      ),
    ).resolves.toMatchObject({
      removedDailyLogActivityId: "activity-1",
    });
    expect(db.transaction.supplyRequestDailyLogLink.delete).toHaveBeenCalledOnce();
    expect(db.calls[0]).toBe("root-lock");
  });

  it("maps exact named uniqueness targets without exposing constraints", async () => {
    for (const [target, code] of [
      ["SupplyRequestDailyLogLink_activity_key", "ACTIVITY_ALREADY_LINKED"],
      ["SupplyRequestDailyLogLink_request_role_key", "STALE_LINK_STATE"],
    ] as const) {
      const client = {
        $transaction: vi.fn(async () => {
          throw new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
              code: "P2002",
              clientVersion: "6.19.3",
              meta: { target },
            },
          );
        }),
      };
      await expect(
        setSupplyRequestDailyLogLinkWithDependencies(
          {
            supplyRequestId: "request-1",
            role: "SUBMISSION",
            dailyLogActivityId: "activity-1",
          },
          { client: client as never },
        ),
      ).rejects.toMatchObject({ code });
    }
  });
});
