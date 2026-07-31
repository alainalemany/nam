import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSupplyRequestHistoryPageWithClient } from "@/features/supply-requests/history-data-internal";

const mocks = {
  count: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  equipment: vi.fn(),
  supervisors: vi.fn(),
  transaction: vi.fn(),
};

function currentVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-2",
    supplyRequestId: "request-1",
    versionNumber: 2,
    changeKind: "CORRECTED",
    status: "REQUESTED",
    operationalWorkDate: new Date("2026-07-15T00:00:00.000Z"),
    submittedLocalDate: new Date("2026-07-16T00:00:00.000Z"),
    submittedLocalTime: "09:30",
    equipmentDisplayNameSnapshot: "Historic Dragline",
    equipmentNumberSnapshot: "DL-7",
    equipmentCategorySnapshot: "DRAGLINE",
    mineNameSnapshot: "Historic Mine",
    cityNameSnapshot: "Gillette",
    cityStateSnapshot: "WY",
    requesterDisplayNameSnapshot: "Alain Alemany",
    requesterEmployeeNumberSnapshot: "911601",
    supervisorNameSnapshot: "Historic Supervisor",
    supervisorEmailSnapshot: "historic@example.com",
    notes: "Historic current notes",
    fulfillmentOperationalWorkDate: null,
    fulfilledLocalDate: null,
    fulfilledLocalTime: null,
    fulfillmentNote: null,
    cancelledLocalDate: null,
    cancelledLocalTime: null,
    cancellationReason: null,
    correctionReason: "Corrected record",
    correctedByDisplayNameSnapshot: "Alain Alemany",
    correctionLocalDate: new Date("2026-07-17T00:00:00.000Z"),
    correctionLocalTime: "10:00",
    _count: { items: 2 },
    ...overrides,
  };
}

function client() {
  const tx = {
    supplyRequest: {
      count: mocks.count,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
    },
    equipment: { findMany: mocks.equipment },
    supplyRequestSupervisor: { findMany: mocks.supervisors },
  };
  mocks.transaction.mockImplementation(async (callback, options) => {
    expect(options).toEqual({ isolationLevel: "RepeatableRead" });
    return callback(tx);
  });
  return { $transaction: mocks.transaction } as never;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.count.mockResolvedValue(0);
  mocks.findFirst.mockResolvedValue(null);
  mocks.findMany.mockResolvedValue([]);
  mocks.equipment.mockResolvedValue([]);
  mocks.supervisors.mockResolvedValue([]);
});

describe("Supply Request history page query", () => {
  it("loads count, pointer-owned rows, and options in one Repeatable Read transaction", async () => {
    mocks.count.mockResolvedValueOnce(60).mockResolvedValueOnce(80);
    mocks.findMany.mockResolvedValue([
      {
        id: "request-1",
        namReference: "SR-2026-0042",
        currentVersionId: "version-2",
        currentVersion: currentVersion(),
      },
    ]);
    mocks.equipment.mockResolvedValue([
      {
        id: "equipment-1",
        displayName: "Live Dragline",
        equipmentNumber: "DL-7",
        status: "INACTIVE",
      },
    ]);
    mocks.supervisors.mockResolvedValue([
      {
        id: "supervisor-1",
        fullName: "Live Supervisor",
        email: "live@example.com",
        active: false,
      },
    ]);

    const result = await getSupplyRequestHistoryPageWithClient(client(), {
      page: 2,
      status: "REQUESTED",
    });

    expect(mocks.count).toHaveBeenNthCalledWith(1, {
      where: { AND: [{ currentVersion: { is: { status: "REQUESTED" } } }] },
    });
    expect(mocks.count).toHaveBeenNthCalledWith(2, {
      where: { currentVersion: { is: {} } },
    });
    expect(mocks.count.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.findMany.mock.invocationCallOrder[0],
    );
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { currentVersionId: null },
      select: { id: true },
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ currentVersion: { is: { status: "REQUESTED" } } }] },
        orderBy: [
          { currentVersion: { operationalWorkDate: "desc" } },
          { currentVersion: { submittedLocalDate: "desc" } },
          { currentVersion: { submittedLocalTime: "desc" } },
          { namReference: "desc" },
          { id: "desc" },
        ],
        skip: 50,
        take: 50,
      }),
    );
    const select = mocks.findMany.mock.calls[0][0].select.currentVersion.select;
    expect(select).toHaveProperty("_count", { select: { items: true } });
    expect(select).not.toHaveProperty("items");
    expect(result).toMatchObject({
      status: "ready",
      totalCount: 80,
      matchingCount: 60,
      page: 2,
      hasPreviousPage: true,
      hasNextPage: false,
      rows: [
        {
          supplyRequestId: "request-1",
          namReference: "SR-2026-0042",
          statusLabel: "Requested",
          equipmentLabel: "Historic Dragline · DL-7",
          supervisorName: "Historic Supervisor",
          itemCount: 2,
          detailHref: "/supply-requests/request-1",
        },
      ],
      equipmentOptions: [
        { id: "equipment-1", label: "Live Dragline · DL-7", active: false },
      ],
      supervisorOptions: [
        {
          id: "supervisor-1",
          label: "Live Supervisor · live@example.com",
          active: false,
        },
      ],
    });
  });

  it("selects active and pointer-used inactive options with deterministic ordering", async () => {
    await getSupplyRequestHistoryPageWithClient(client(), { page: 1 });
    expect(mocks.equipment).toHaveBeenCalledWith({
      where: {
        OR: [
          { status: "ACTIVE" },
          {
            supplyRequestVersions: {
              some: { currentForRequest: { isNot: null } },
            },
          },
        ],
      },
      select: expect.any(Object),
      orderBy: [
        { displayName: "asc" },
        { equipmentNumber: "asc" },
        { id: "asc" },
      ],
    });
    expect(mocks.supervisors).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { active: true },
            { versions: { some: { currentForRequest: { isNot: null } } } },
          ],
        },
      }),
    );
  });

  it("skips the row query for out-of-range and huge safe pages", async () => {
    mocks.count.mockResolvedValue(51);
    const result = await getSupplyRequestHistoryPageWithClient(client(), {
      page: Number.MAX_SAFE_INTEGER,
    });
    expect(result).toMatchObject({
      matchingCount: 51,
      rows: [],
      hasPreviousPage: true,
      hasNextPage: false,
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("rejects an inconsistent pointer or malformed current aggregate", async () => {
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([
      {
        id: "request-1",
        namReference: "SR-2026-0001",
        currentVersionId: "version-2",
        currentVersion: currentVersion({ submittedLocalTime: "25:00" }),
      },
    ]);
    await expect(
      getSupplyRequestHistoryPageWithClient(client(), { page: 1 }),
    ).rejects.toThrow("Invalid persisted Supply Request current aggregate");
  });

  it("rejects a persisted root without a current pointer instead of reporting no results", async () => {
    mocks.findFirst.mockResolvedValue({ id: "request-without-current" });
    await expect(
      getSupplyRequestHistoryPageWithClient(client(), {
        page: 1,
        reference: "SR-2026-0099",
      }),
    ).rejects.toThrow("Invalid persisted Supply Request current aggregate");
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.equipment).not.toHaveBeenCalled();
    expect(mocks.supervisors).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid version", { versionNumber: 0 }],
    ["invalid item count", { _count: { items: 0 } }],
    [
      "incomplete lifecycle",
      { status: "FULFILLED", changeKind: "FULFILLED" },
    ],
    [
      "invalid correction metadata",
      { correctionReason: null, correctedByDisplayNameSnapshot: null },
    ],
  ])("rejects %s rather than returning a misleading current row", async (_name, patch) => {
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([
      {
        id: "request-1",
        namReference: "SR-2026-0001",
        currentVersionId: "version-2",
        currentVersion: currentVersion(patch),
      },
    ]);
    await expect(
      getSupplyRequestHistoryPageWithClient(client(), { page: 1 }),
    ).rejects.toThrow("Invalid persisted Supply Request current aggregate");
  });
});
