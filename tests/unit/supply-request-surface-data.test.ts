import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentSupplyRequestDetailWithClient,
  getOriginalSupplyRequestDetailWithClient,
  getSupplyRequestCreatePageDataWithClient,
  searchActiveSupplyRequestEquipmentWithClient,
  searchActiveSupplyRequestItemsWithClient,
  searchActiveSupplyRequestSupervisorsWithClient,
  supplyRequestOptionLimit,
} from "@/features/supply-requests/surface-data-internal";

const mocks = {
  equipmentFindMany: vi.fn(),
  equipmentCount: vi.fn(),
  supervisorFindMany: vi.fn(),
  supervisorCount: vi.fn(),
  itemFindMany: vi.fn(),
  itemCount: vi.fn(),
  rootFindUnique: vi.fn(),
  versionFindUnique: vi.fn(),
};

const client = {
  equipment: {
    findMany: mocks.equipmentFindMany,
    count: mocks.equipmentCount,
  },
  supplyRequestSupervisor: {
    findMany: mocks.supervisorFindMany,
    count: mocks.supervisorCount,
  },
  supplyItem: {
    findMany: mocks.itemFindMany,
    count: mocks.itemCount,
  },
  supplyRequest: { findUnique: mocks.rootFindUnique },
  supplyRequestVersion: { findUnique: mocks.versionFindUnique },
} as never;

function versionRecord(overrides: Record<string, unknown> = {}) {
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
    notes: null,
    fulfillmentOperationalWorkDate: null,
    fulfilledLocalDate: null,
    fulfilledLocalTime: null,
    cancelledLocalDate: null,
    cancelledLocalTime: null,
    fulfillmentNote: null,
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

describe("Supply Request create option and detail queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.equipmentFindMany.mockResolvedValue([]);
    mocks.supervisorFindMany.mockResolvedValue([]);
    mocks.itemFindMany.mockResolvedValue([]);
    mocks.equipmentCount.mockResolvedValue(0);
    mocks.supervisorCount.mockResolvedValue(0);
    mocks.itemCount.mockResolvedValue(0);
    mocks.rootFindUnique.mockResolvedValue(null);
    mocks.versionFindUnique.mockResolvedValue(null);
  });

  it("builds an active-only bounded deterministic Equipment search", async () => {
    mocks.equipmentFindMany.mockResolvedValue([
      {
        id: "equipment-1",
        displayName: "Dragline",
        equipmentNumber: "101",
        mine: {
          name: "Mine A",
          city: { name: "Wright", state: "WY" },
        },
      },
    ]);
    await expect(
      searchActiveSupplyRequestEquipmentWithClient(client, " drag "),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "equipment-1",
        label: "Dragline · 101",
        mineName: "Mine A",
      }),
    ]);
    expect(mocks.equipmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
        take: supplyRequestOptionLimit,
      }),
    );
  });

  it("builds active-only supervisor and item searches in PostgreSQL", async () => {
    await searchActiveSupplyRequestSupervisorsWithClient(
      client,
      "Pablo@Example.com",
    );
    expect(mocks.supervisorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          OR: expect.arrayContaining([
            { normalizedEmail: { contains: "pablo@example.com" } },
          ]),
        }),
        orderBy: [{ fullName: "asc" }, { id: "asc" }],
        take: supplyRequestOptionLimit,
      }),
    );

    await searchActiveSupplyRequestItemsWithClient(client, " ab-1 ");
    expect(mocks.itemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          OR: expect.arrayContaining([
            { normalizedItemNumber: { contains: "AB-1" } },
          ]),
        }),
        orderBy: [{ itemNumber: "asc" }, { id: "asc" }],
        take: supplyRequestOptionLimit,
      }),
    );
  });

  it("returns create blocking facts independently of the initial result limit", async () => {
    mocks.equipmentCount.mockResolvedValue(21);
    mocks.supervisorCount.mockResolvedValue(1);
    mocks.itemCount.mockResolvedValue(100);
    await expect(
      getSupplyRequestCreatePageDataWithClient(client),
    ).resolves.toMatchObject({
      hasActiveEquipment: true,
      hasActiveSupervisors: true,
      hasActiveItems: true,
      loadError: null,
    });
  });

  it("follows the explicit current pointer and returns narrow snapshots", async () => {
    mocks.rootFindUnique.mockResolvedValue({
      id: "request-1",
      namReference: "SR-2026-0001",
      currentVersionId: "version-1",
      currentVersion: versionRecord(),
    });
    const result = await getCurrentSupplyRequestDetailWithClient(
      client,
      " request-1 ",
    );
    expect(result).toMatchObject({
      supplyRequestId: "request-1",
      namReference: "SR-2026-0001",
      versionId: "version-1",
      equipmentLabel: "Dragline 101 · 101",
      items: [{ sequence: 1, itemNumber: "A-1", unit: "Each" }],
    });
    expect(mocks.rootFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "request-1" } }),
    );
  });

  it("rejects null, missing, and cross-owner current pointers without guessing", async () => {
    mocks.rootFindUnique.mockResolvedValue({
      id: "request-1",
      namReference: "SR-2026-0001",
      currentVersionId: null,
      currentVersion: null,
    });
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, "request-1"),
    ).resolves.toBeNull();

    mocks.rootFindUnique.mockResolvedValue({
      id: "request-1",
      namReference: "SR-2026-0001",
      currentVersionId: "version-2",
      currentVersion: versionRecord({ id: "version-1" }),
    });
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, "request-1"),
    ).resolves.toBeNull();

    mocks.rootFindUnique.mockResolvedValue({
      id: "request-1",
      namReference: "SR-2026-0001",
      currentVersionId: "version-2",
      currentVersion: versionRecord({ supplyRequestId: "request-2" }),
    });
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, "request-1"),
    ).resolves.toBeNull();
  });

  it("loads only original version 1 through request/version ownership", async () => {
    mocks.versionFindUnique.mockResolvedValue({
      ...versionRecord(),
      supplyRequest: {
        id: "request-1",
        namReference: "SR-2026-0001",
      },
    });
    await expect(
      getOriginalSupplyRequestDetailWithClient(client, "request-1", "1"),
    ).resolves.toMatchObject({
      supplyRequestId: "request-1",
      versionNumber: 1,
    });
    expect(mocks.versionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          supplyRequestId_versionNumber: {
            supplyRequestId: "request-1",
            versionNumber: 1,
          },
        },
      }),
    );

    await expect(
      getOriginalSupplyRequestDetailWithClient(client, "request-1", "2"),
    ).resolves.toBeNull();
  });

  it("uses snapshots even when the live Equipment relation is absent", async () => {
    mocks.rootFindUnique.mockResolvedValue({
      id: "request-1",
      namReference: "SR-2026-0001",
      currentVersionId: "version-1",
      currentVersion: versionRecord({ equipmentId: null, equipment: null }),
    });
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, "request-1"),
    ).resolves.toMatchObject({
      equipmentAvailable: false,
      equipmentLabel: "Dragline 101 · 101",
      mineName: "Black Thunder",
    });
  });
});
