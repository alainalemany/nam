import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSupplyRequestDailyLogLinkContextWithClient } from "@/features/supply-requests/daily-log-link-data-internal";

function version(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-2",
    supplyRequestId: "request-1",
    versionNumber: 2,
    changeKind: "CORRECTED",
    status: "FULFILLED",
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
    fulfillmentOperationalWorkDate: new Date("2026-07-31T00:00:00.000Z"),
    fulfilledLocalDate: new Date("2026-07-31T00:00:00.000Z"),
    fulfilledLocalTime: "10:00",
    fulfillmentNote: null,
    cancelledLocalDate: null,
    cancelledLocalTime: null,
    cancellationReason: null,
    correctionReason: "Corrected fulfillment",
    correctedByDisplayNameSnapshot: "Alain Alemany",
    correctionLocalDate: new Date("2026-07-31T00:00:00.000Z"),
    correctionLocalTime: "10:15",
    createdAt: new Date("2026-07-31T14:15:00.000Z"),
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
    ...overrides,
  };
}

const rootFindUnique = vi.fn();
const linkFindUnique = vi.fn();
const dailyLogFindMany = vi.fn();
const transaction = {
  supplyRequest: { findUnique: rootFindUnique },
  supplyRequestDailyLogLink: { findUnique: linkFindUnique },
  dailyLog: { findMany: dailyLogFindMany },
};
const client = {
  $transaction: vi.fn(
    async (callback: (tx: typeof transaction) => unknown) => callback(transaction),
  ),
} as never;

function currentRoot(current = version()) {
  return {
    id: "request-1",
    namReference: "SR-2026-0001",
    currentVersionId: current.id,
    currentVersion: current,
  };
}

describe("Supply Request Daily Log candidate query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rootFindUnique
      .mockResolvedValueOnce({ id: "request-1" })
      .mockResolvedValueOnce(currentRoot());
    linkFindUnique.mockResolvedValue(null);
    dailyLogFindMany.mockResolvedValue([]);
  });

  it("loads submission context from the explicit pointer in Repeatable Read", async () => {
    await expect(
      getSupplyRequestDailyLogLinkContextWithClient(
        client,
        "request-1",
        "SUBMISSION",
      ),
    ).resolves.toMatchObject({
      currentVersionNumber: 2,
      currentStatus: "FULFILLED",
      expectedRoleDate: "2026-07-30",
      requiredActivityTitle:
        "Submitted supply request SR-2026-0001 for Dragline 101 · 101.",
      eligible: true,
    });
    expect((client as never as { $transaction: ReturnType<typeof vi.fn> }).$transaction)
      .toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: "RepeatableRead",
        maxWait: 5_000,
        timeout: 15_000,
      });
  });

  it("uses corrected-to-Fulfilled status and fulfillment work date", async () => {
    const result = await getSupplyRequestDailyLogLinkContextWithClient(
      client,
      "request-1",
      "FULFILLMENT",
    );
    expect(result).toMatchObject({
      eligible: true,
      expectedRoleDate: "2026-07-31",
      requiredActivityTitle:
        "Received all supplies associated with SR-2026-0001.",
    });
    expect(dailyLogFindMany).toHaveBeenCalledOnce();
  });

  it("returns a read-only unavailable fulfillment context without querying logs", async () => {
    rootFindUnique.mockReset();
    const requested = version({
      changeKind: "CORRECTED",
      status: "REQUESTED",
      fulfillmentOperationalWorkDate: null,
      fulfilledLocalDate: null,
      fulfilledLocalTime: null,
      correctionReason: "Restore requested",
    });
    rootFindUnique
      .mockResolvedValueOnce({ id: "request-1" })
      .mockResolvedValueOnce(currentRoot(requested));
    const result = await getSupplyRequestDailyLogLinkContextWithClient(
      client,
      "request-1",
      "FULFILLMENT",
    );
    expect(result).toMatchObject({
      eligible: false,
      expectedRoleDate: null,
      dailyLogs: [],
    });
    expect(dailyLogFindMany).not.toHaveBeenCalled();
  });

  it("returns multiple same-date Daily Logs and only their narrow eligible Activities", async () => {
    dailyLogFindMany.mockResolvedValue([
      {
        id: "log-1",
        logDate: new Date("2026-07-30T00:00:00.000Z"),
        shift: "DAY",
        summary: "First",
        mine: { name: "Mine A", city: { name: "Wright", state: "WY" } },
        primaryEquipment: { displayName: "Dragline 101", equipmentNumber: "101" },
        activities: [
          {
            id: "activity-1",
            dailyLogId: "log-1",
            sequence: 1,
            startTime: "08:00",
            endTime: "08:10",
            title: "Submitted supply request SR-2026-0001 for Dragline 101 · 101.",
            equipment: null,
            supplyRequestLink: null,
          },
        ],
      },
      {
        id: "log-2",
        logDate: new Date("2026-07-30T00:00:00.000Z"),
        shift: "NIGHT",
        summary: "Second",
        mine: null,
        primaryEquipment: null,
        activities: [],
      },
    ]);
    const result = await getSupplyRequestDailyLogLinkContextWithClient(
      client,
      "request-1",
      "SUBMISSION",
    );
    expect(result?.dailyLogs).toHaveLength(2);
    expect(result?.dailyLogs[0].activities[0]).toEqual(
      expect.objectContaining({ id: "activity-1", currentlyLinked: false }),
    );
    const query = dailyLogFindMany.mock.calls[0][0];
    expect(query.take).toBe(50);
    expect(query.select.activities.take).toBe(100);
    expect(query.select.activities.where).toMatchObject({
      activityType: "SUPPLY_REQUEST",
      title: expect.any(String),
    });
  });

  it("rejects malformed current state and incompatible persisted links", async () => {
    rootFindUnique.mockReset();
    rootFindUnique
      .mockResolvedValueOnce({ id: "request-1" })
      .mockResolvedValueOnce(currentRoot(version({ submittedLocalTime: "25:00" })));
    await expect(
      getSupplyRequestDailyLogLinkContextWithClient(
        client,
        "request-1",
        "SUBMISSION",
      ),
    ).rejects.toMatchObject({ code: "CURRENT_VERSION_INVALID" });

    rootFindUnique.mockReset();
    rootFindUnique
      .mockResolvedValueOnce({ id: "request-1" })
      .mockResolvedValueOnce(currentRoot());
    linkFindUnique.mockResolvedValue({
      role: "SUBMISSION",
      dailyLogActivity: {
        id: "activity-1",
        activityType: "GENERAL_NOTE",
        title: "Wrong",
        activityDate: new Date("2026-07-30T00:00:00.000Z"),
        sequence: 1,
        startTime: null,
        endTime: null,
        equipmentId: null,
        dailyLog: {
          id: "log-1",
          logDate: new Date("2026-07-30T00:00:00.000Z"),
        },
      },
    });
    await expect(
      getSupplyRequestDailyLogLinkContextWithClient(
        client,
        "request-1",
        "SUBMISSION",
      ),
    ).rejects.toMatchObject({ code: "LINK_INTEGRITY_INVALID" });
  });
});
