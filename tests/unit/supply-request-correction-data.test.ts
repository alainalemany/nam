import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getImmutableSupplyRequestVersionWithClient,
  getSupplyRequestCorrectionContextWithClient,
  getSupplyRequestCorrectionHistoryWithClient,
  getSupplyRequestCurrentPageDataWithClient,
} from "@/features/supply-requests/surface-data-internal";

const rootFindUnique = vi.fn();
const versionFindUnique = vi.fn();
const equipmentFindMany = vi.fn();
const supervisorFindMany = vi.fn();
const itemFindMany = vi.fn();
const dailyLogLinkFindMany = vi.fn();
const transaction = vi.fn();
const client = {
  $transaction: transaction,
  supplyRequest: { findUnique: rootFindUnique },
  supplyRequestVersion: { findUnique: versionFindUnique },
  equipment: { findMany: equipmentFindMany },
  supplyRequestSupervisor: { findMany: supervisorFindMany },
  supplyItem: { findMany: itemFindMany },
  supplyRequestDailyLogLink: { findMany: dailyLogLinkFindMany },
} as never;

function version(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-2",
    supplyRequestId: "request-1",
    versionNumber: 2,
    changeKind: "FULFILLED",
    status: "FULFILLED",
    operationalWorkDate: new Date("2026-07-28T00:00:00.000Z"),
    submittedLocalDate: new Date("2026-07-29T00:00:00.000Z"),
    submittedLocalTime: "01:15",
    equipmentId: "equipment-1",
    equipment: { id: "equipment-1" },
    equipmentDisplayNameSnapshot: "Dragline",
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
    notes: "Notes",
    fulfillmentOperationalWorkDate: new Date("2026-07-28T00:00:00.000Z"),
    fulfilledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
    fulfilledLocalTime: "02:00",
    fulfillmentNote: null,
    cancelledLocalDate: null,
    cancelledLocalTime: null,
    cancellationReason: null,
    correctionReason: null,
    correctedByDisplayNameSnapshot: null,
    correctionLocalDate: null,
    correctionLocalTime: null,
    createdAt: new Date("2026-07-29T06:00:00.000Z"),
    items: [
      {
        id: "line-1",
        supplyItemId: "item-1",
        sequence: 1,
        itemNumberSnapshot: "A-1",
        normalizedItemNumberSnapshot: "A-1",
        descriptionSnapshot: "Filter",
        quantity: 2,
        unitOfMeasureSnapshot: "Each",
      },
    ],
    ...overrides,
  };
}

describe("Supply Request correction queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(
      async (operation: (value: unknown) => Promise<unknown>) =>
        operation(client),
    );
    equipmentFindMany.mockResolvedValue([]);
    supervisorFindMany.mockResolvedValue([]);
    itemFindMany.mockResolvedValue([]);
    dailyLogLinkFindMany.mockResolvedValue([]);
  });

  it("returns a complete correction context through the explicit pointer", async () => {
    const current = version();
    rootFindUnique.mockResolvedValue({
      id: "request-1",
      namReference: "SR-2026-0001",
      currentVersionId: current.id,
      currentVersion: current,
    });
    const result = await getSupplyRequestCorrectionContextWithClient(
      client,
      "request-1",
    );
    expect(result).toMatchObject({
      requiresEquipmentReplacement: false,
      detail: { versionNumber: 2, status: "FULFILLED" },
      equipment: [{ id: "equipment-1", displayName: "Dragline" }],
      supervisors: [{ id: "supervisor-1", fullName: "Supervisor One" }],
      items: [{ id: "item-1", itemNumber: "A-1" }],
    });
  });

  it("requires replacement context when live Equipment is missing", async () => {
    const current = version({ equipmentId: null, equipment: null });
    rootFindUnique.mockResolvedValue({
      id: "request-1",
      namReference: "SR-2026-0001",
      currentVersionId: current.id,
      currentVersion: current,
    });
    await expect(
      getSupplyRequestCorrectionContextWithClient(client, "request-1"),
    ).resolves.toMatchObject({
      requiresEquipmentReplacement: true,
      equipment: [],
    });
  });

  it("rejects null and inconsistent current pointers", async () => {
    rootFindUnique.mockResolvedValue({
      id: "request-1",
      currentVersionId: null,
      currentVersion: null,
    });
    await expect(
      getSupplyRequestCorrectionContextWithClient(client, "request-1"),
    ).resolves.toBeNull();
  });

  it("returns every noncurrent summary newest first with mapped change times", async () => {
    rootFindUnique.mockResolvedValue({
      id: "request-1",
      currentVersionId: "version-4",
      currentVersion: {
        id: "version-4",
        supplyRequestId: "request-1",
      },
      versions: [
        {
          versionNumber: 3,
          changeKind: "CORRECTED",
          status: "REQUESTED",
          submittedLocalDate: new Date("2026-07-29T00:00:00.000Z"),
          submittedLocalTime: "01:15",
          fulfilledLocalDate: null,
          fulfilledLocalTime: null,
          cancelledLocalDate: null,
          cancelledLocalTime: null,
          correctionLocalDate: new Date("2026-07-30T00:00:00.000Z"),
          correctionLocalTime: "03:00",
          correctionReason: "Repair",
        },
        {
          versionNumber: 2,
          changeKind: "FULFILLED",
          status: "FULFILLED",
          submittedLocalDate: new Date("2026-07-29T00:00:00.000Z"),
          submittedLocalTime: "01:15",
          fulfilledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
          fulfilledLocalTime: "02:00",
          cancelledLocalDate: null,
          cancelledLocalTime: null,
          correctionLocalDate: null,
          correctionLocalTime: null,
          correctionReason: null,
        },
      ],
    });
    await expect(
      getSupplyRequestCorrectionHistoryWithClient(client, "request-1"),
    ).resolves.toEqual([
      expect.objectContaining({
        versionNumber: 3,
        changeLocalDate: "2026-07-30",
        correctionReason: "Repair",
      }),
      expect.objectContaining({
        versionNumber: 2,
        changeLocalTime: "02:00",
      }),
    ]);
    expect(rootFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          versions: expect.objectContaining({
            orderBy: { versionNumber: "desc" },
          }),
        }),
      }),
    );
  });

  it("loads current detail and history from one repeatable-read snapshot", async () => {
    const current = version();
    rootFindUnique
      .mockResolvedValueOnce({
        id: "request-1",
        namReference: "SR-2026-0001",
        currentVersionId: current.id,
        currentVersion: current,
      })
      .mockResolvedValueOnce({
        id: "request-1",
        currentVersionId: current.id,
        currentVersion: {
          id: current.id,
          supplyRequestId: "request-1",
        },
        versions: [],
      });
    await expect(
      getSupplyRequestCurrentPageDataWithClient(client, "request-1"),
    ).resolves.toMatchObject({
      detail: { versionNumber: 2 },
      history: [],
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
  });

  it("rejects incoherent immutable history summaries", async () => {
    rootFindUnique.mockResolvedValue({
      id: "request-1",
      currentVersionId: "version-2",
      currentVersion: {
        id: "version-2",
        supplyRequestId: "request-1",
      },
      versions: [
        {
          versionNumber: 1,
          changeKind: "FULFILLED",
          status: "FULFILLED",
          submittedLocalDate: new Date("2026-07-29T00:00:00.000Z"),
          submittedLocalTime: "01:15",
          fulfilledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
          fulfilledLocalTime: "02:00",
          cancelledLocalDate: null,
          cancelledLocalTime: null,
          correctionLocalDate: null,
          correctionLocalTime: null,
          correctionReason: "Unexpected correction metadata",
        },
      ],
    });
    await expect(
      getSupplyRequestCorrectionHistoryWithClient(client, "request-1"),
    ).resolves.toBeNull();
  });

  it("classifies original, current, and superseded immutable versions", async () => {
    for (const [versionNumber, id, currentId, role] of [
      [1, "version-1", "version-3", "original"],
      [3, "version-3", "version-3", "current"],
      [2, "version-2", "version-3", "superseded"],
    ] as const) {
      const record =
        versionNumber === 1
          ? version({
              id,
              versionNumber,
              changeKind: "CREATED",
              status: "REQUESTED",
              fulfillmentOperationalWorkDate: null,
              fulfilledLocalDate: null,
              fulfilledLocalTime: null,
            })
          : version({ id, versionNumber });
      versionFindUnique.mockResolvedValue({
        ...record,
        supplyRequest: {
          id: "request-1",
          namReference: "SR-2026-0001",
          currentVersionId: currentId,
          currentVersion: {
            id: currentId,
            supplyRequestId: "request-1",
            versionNumber: 3,
          },
        },
      });
      await expect(
        getImmutableSupplyRequestVersionWithClient(
          client,
          "request-1",
          String(versionNumber),
        ),
      ).resolves.toMatchObject({ role });
    }

    const originalCurrent = version({
      id: "version-1",
      versionNumber: 1,
      changeKind: "CREATED",
      status: "REQUESTED",
      fulfillmentOperationalWorkDate: null,
      fulfilledLocalDate: null,
      fulfilledLocalTime: null,
    });
    versionFindUnique.mockResolvedValue({
      ...originalCurrent,
      supplyRequest: {
        id: "request-1",
        namReference: "SR-2026-0001",
        currentVersionId: "version-1",
        currentVersion: {
          id: "version-1",
          supplyRequestId: "request-1",
          versionNumber: 1,
        },
      },
    });
    await expect(
      getImmutableSupplyRequestVersionWithClient(client, "request-1", "1"),
    ).resolves.toMatchObject({ role: "original", currentVersionNumber: 1 });
  });

  it("rejects malformed versions, wrong ownership, and invalid persisted facts", async () => {
    await expect(
      getImmutableSupplyRequestVersionWithClient(client, "request-1", "1e2"),
    ).resolves.toBeNull();
    expect(versionFindUnique).not.toHaveBeenCalled();
    const record = version({ fulfilledLocalTime: "bad" });
    versionFindUnique.mockResolvedValue({
      ...record,
      supplyRequest: {
        id: "request-1",
        namReference: "SR-2026-0001",
        currentVersionId: record.id,
        currentVersion: {
          id: record.id,
          supplyRequestId: "request-1",
          versionNumber: 2,
        },
      },
    });
    await expect(
      getImmutableSupplyRequestVersionWithClient(client, "request-1", "2"),
    ).resolves.toBeNull();

    const wrongOwner = version();
    versionFindUnique.mockResolvedValue({
      ...wrongOwner,
      supplyRequest: {
        id: "request-2",
        namReference: "SR-2026-0002",
        currentVersionId: wrongOwner.id,
        currentVersion: {
          id: wrongOwner.id,
          supplyRequestId: "request-2",
          versionNumber: 2,
        },
      },
    });
    await expect(
      getImmutableSupplyRequestVersionWithClient(client, "request-1", "2"),
    ).resolves.toBeNull();

    const malformedCorrection = version({
      changeKind: "CORRECTED",
      status: "REQUESTED",
      fulfillmentOperationalWorkDate: null,
      fulfilledLocalDate: null,
      fulfilledLocalTime: null,
      correctionReason: "Repair",
      correctedByDisplayNameSnapshot: "Alain Alemany",
      correctionLocalDate: new Date("2026-07-30T00:00:00.000Z"),
      correctionLocalTime: "bad",
    });
    versionFindUnique.mockResolvedValue({
      ...malformedCorrection,
      supplyRequest: {
        id: "request-1",
        namReference: "SR-2026-0001",
        currentVersionId: malformedCorrection.id,
        currentVersion: {
          id: malformedCorrection.id,
          supplyRequestId: "request-1",
          versionNumber: 2,
        },
      },
    });
    await expect(
      getImmutableSupplyRequestVersionWithClient(client, "request-1", "2"),
    ).resolves.toBeNull();

    versionFindUnique.mockResolvedValue({
      ...version({
        items: [
          version().items[0],
          {
            ...version().items[0],
            id: "line-2",
            sequence: 2,
          },
        ],
      }),
      supplyRequest: {
        id: "request-1",
        namReference: "SR-2026-0001",
        currentVersionId: "version-2",
        currentVersion: {
          id: "version-2",
          supplyRequestId: "request-1",
          versionNumber: 2,
        },
      },
    });
    await expect(
      getImmutableSupplyRequestVersionWithClient(client, "request-1", "2"),
    ).resolves.toBeNull();
  });
});
