import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentSupplyRequestDetailWithClient,
  getOriginalSupplyRequestDetailWithClient,
  getSupplyRequestLifecycleActionContextWithClient,
} from "@/features/supply-requests/surface-data-internal";

const rootFindUnique = vi.fn();
const versionFindUnique = vi.fn();
const client = {
  supplyRequest: { findUnique: rootFindUnique },
  supplyRequestVersion: { findUnique: versionFindUnique },
} as never;

function version(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-1",
    supplyRequestId: "request-1",
    versionNumber: 1,
    changeKind: "CREATED",
    status: "REQUESTED",
    operationalWorkDate: new Date("2026-07-28T00:00:00.000Z"),
    submittedLocalDate: new Date("2026-07-29T00:00:00.000Z"),
    submittedLocalTime: "01:15",
    equipmentId: "equipment-1",
    equipment: { id: "equipment-1" },
    equipmentDisplayNameSnapshot: "Dragline 101",
    equipmentNumberSnapshot: "101",
    equipmentCategorySnapshot: "DRAGLINE",
    mineNameSnapshot: "Black Thunder",
    cityNameSnapshot: "Wright",
    cityStateSnapshot: "WY",
    requesterDisplayNameSnapshot: "Alain Alemany",
    requesterEmployeeNumberSnapshot: "911601",
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
    createdAt: new Date("2026-07-29T05:20:00.000Z"),
    items: [
      {
        id: "line-1",
        sequence: 1,
        itemNumberSnapshot: "A-1",
        descriptionSnapshot: "Filter",
        quantity: 2,
        unitOfMeasureSnapshot: "Each",
      },
    ],
    ...overrides,
  };
}

function root(current = version(), overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    namReference: "SR-2026-0001",
    currentVersionId: current.id,
    currentVersion: current,
    ...overrides,
  };
}

describe("Supply Request lifecycle query mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rootFindUnique.mockResolvedValue(null);
    versionFindUnique.mockResolvedValue(null);
  });

  it("returns narrow Requested action context from the explicit current pointer", async () => {
    rootFindUnique.mockResolvedValue(root());
    await expect(
      getSupplyRequestLifecycleActionContextWithClient(client, " request-1 "),
    ).resolves.toEqual({
      supplyRequestId: "request-1",
      namReference: "SR-2026-0001",
      versionNumber: 1,
      status: "REQUESTED",
      operationalWorkDate: "2026-07-28",
      submittedLocalDate: "2026-07-29",
      submittedLocalTime: "01:15",
      equipmentLabel: "Dragline 101 · 101",
      itemCount: 1,
    });
    expect(rootFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "request-1" } }),
    );
  });

  it("rejects invalid IDs, null pointers, and same-owner inconsistencies", async () => {
    await expect(
      getSupplyRequestLifecycleActionContextWithClient(client, ""),
    ).resolves.toBeNull();
    expect(rootFindUnique).not.toHaveBeenCalled();

    rootFindUnique.mockResolvedValue(
      root(version(), { currentVersionId: null, currentVersion: null }),
    );
    await expect(
      getSupplyRequestLifecycleActionContextWithClient(client, "request-1"),
    ).resolves.toBeNull();

    rootFindUnique.mockResolvedValue(
      root(version({ supplyRequestId: "request-2" })),
    );
    await expect(
      getSupplyRequestLifecycleActionContextWithClient(client, "request-1"),
    ).resolves.toBeNull();
  });

  it("maps complete Fulfilled facts and no cancellation facts", async () => {
    const fulfilled = version({
      id: "version-2",
      versionNumber: 2,
      changeKind: "FULFILLED",
      status: "FULFILLED",
      fulfillmentOperationalWorkDate: new Date("2026-07-29T00:00:00.000Z"),
      fulfilledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
      fulfilledLocalTime: "02:20",
      fulfillmentNote: "Complete",
    });
    rootFindUnique.mockResolvedValue(root(fulfilled));
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, "request-1"),
    ).resolves.toMatchObject({
      versionNumber: 2,
      status: "FULFILLED",
      fulfillmentOperationalWorkDate: "2026-07-29",
      fulfilledLocalDate: "2026-07-29",
      fulfilledLocalTime: "02:20",
      fulfillmentNote: "Complete",
      cancellationLocalDate: null,
      cancellationReason: null,
    });
  });

  it("maps complete Cancelled facts and no fulfillment facts", async () => {
    const cancelled = version({
      id: "version-2",
      versionNumber: 2,
      changeKind: "CANCELLED",
      status: "CANCELLED",
      cancelledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
      cancelledLocalTime: "02:20",
      cancellationReason: "No longer needed",
    });
    rootFindUnique.mockResolvedValue(root(cancelled));
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, "request-1"),
    ).resolves.toMatchObject({
      versionNumber: 2,
      status: "CANCELLED",
      cancellationLocalDate: "2026-07-29",
      cancellationLocalTime: "02:20",
      cancellationReason: "No longer needed",
      fulfilledLocalDate: null,
      fulfillmentNote: null,
    });
  });

  it("rejects incomplete or mutually inconsistent terminal facts", async () => {
    rootFindUnique.mockResolvedValue(
      root(
        version({
          id: "version-2",
          versionNumber: 2,
          changeKind: "FULFILLED",
          status: "FULFILLED",
          fulfilledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
          fulfilledLocalTime: "02:20",
        }),
      ),
    );
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, "request-1"),
    ).resolves.toBeNull();

    rootFindUnique.mockResolvedValue(
      root(
        version({
          id: "version-2",
          versionNumber: 2,
          changeKind: "CANCELLED",
          status: "FULFILLED",
          fulfillmentOperationalWorkDate: new Date(
            "2026-07-29T00:00:00.000Z",
          ),
          fulfilledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
          fulfilledLocalTime: "02:20",
        }),
      ),
    );
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, "request-1"),
    ).resolves.toBeNull();

    rootFindUnique.mockResolvedValue(
      root(
        version({
          id: "version-2",
          versionNumber: 2,
          changeKind: "CANCELLED",
          status: "CANCELLED",
          cancelledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
          cancelledLocalTime: "02:20",
          fulfillmentNote: "impossible",
        }),
      ),
    );
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, "request-1"),
    ).resolves.toBeNull();
  });

  it("rejects malformed lifecycle times, chronology, versions, and item order", async () => {
    for (const malformed of [
      version({ submittedLocalTime: "1:15" }),
      version({ versionNumber: 0 }),
      version({
        items: [
          {
            ...version().items[0],
            sequence: 2,
          },
        ],
      }),
      version({
        id: "version-2",
        versionNumber: 2,
        changeKind: "FULFILLED",
        status: "FULFILLED",
        fulfillmentOperationalWorkDate: new Date(
          "2026-07-27T00:00:00.000Z",
        ),
        fulfilledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
        fulfilledLocalTime: "01:14",
      }),
      version({
        id: "version-2",
        versionNumber: 2,
        changeKind: "CANCELLED",
        status: "CANCELLED",
        cancelledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
        cancelledLocalTime: "invalid",
      }),
    ]) {
      rootFindUnique.mockResolvedValue(root(malformed));
      await expect(
        getCurrentSupplyRequestDetailWithClient(client, "request-1"),
      ).resolves.toBeNull();
    }
  });

  it("returns terminal action context as blocked context rather than not-found", async () => {
    const cancelled = version({
      id: "version-2",
      versionNumber: 2,
      changeKind: "CANCELLED",
      status: "CANCELLED",
      cancelledLocalDate: new Date("2026-07-29T00:00:00.000Z"),
      cancelledLocalTime: "02:20",
    });
    rootFindUnique.mockResolvedValue(root(cancelled));
    await expect(
      getSupplyRequestLifecycleActionContextWithClient(client, "request-1"),
    ).resolves.toMatchObject({
      status: "CANCELLED",
      versionNumber: 2,
      operationalWorkDate: "2026-07-28",
    });
  });

  it("keeps original version 1 Requested after the current pointer advances", async () => {
    versionFindUnique.mockResolvedValue({
      ...version(),
      supplyRequest: {
        id: "request-1",
        namReference: "SR-2026-0001",
      },
    });
    await expect(
      getOriginalSupplyRequestDetailWithClient(client, "request-1", "1"),
    ).resolves.toMatchObject({
      versionNumber: 1,
      changeKind: "CREATED",
      status: "REQUESTED",
      fulfilledLocalDate: null,
      cancellationLocalDate: null,
    });
  });
});
