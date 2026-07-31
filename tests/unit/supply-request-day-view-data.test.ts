import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { supplyRequest: { findMany: mocks.findMany } },
}));

import {
  getSupplyRequestDayViewItems,
  supplyRequestDayViewHistoryHref,
} from "@/features/supply-requests/day-view-data";
import {
  getSupplyRequestDayViewItemsWithClient,
  supplyRequestDayViewOrderBy,
  supplyRequestDayViewSelect,
} from "@/features/supply-requests/day-view-data-internal";
import { SupplyRequestDayViewError } from "@/features/supply-requests/day-view-types";

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    namReference: "SR-2026-0001",
    currentVersionId: "version-1",
    currentVersion: {
      id: "version-1",
      supplyRequestId: "request-1",
      versionNumber: 1,
      changeKind: "CREATED",
      status: "REQUESTED",
      operationalWorkDate: new Date("2026-07-31T00:00:00.000Z"),
      submittedLocalDate: new Date("2026-07-30T00:00:00.000Z"),
      submittedLocalTime: "08:15",
      equipmentId: null,
      equipmentDisplayNameSnapshot: "Deleted Work Truck",
      equipmentNumberSnapshot: "WT-9",
      equipmentCategorySnapshot: "WORK_TRUCK",
      mineNameSnapshot: "Historic Mine",
      cityNameSnapshot: "Historic City",
      cityStateSnapshot: "WY",
      requesterDisplayNameSnapshot: "Alain Alemany",
      requesterEmployeeNumberSnapshot: "1001",
      supervisorNameSnapshot: "Historic Supervisor",
      supervisorEmailSnapshot: "supervisor@example.com",
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
      _count: { items: 1 },
    },
    ...overrides,
  };
}

describe("Supply Request Day View query composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
  });

  it("owns one stable-root query with exact current-date relation and ordering", async () => {
    await getSupplyRequestDayViewItems("2026-07-31");
    expect(mocks.findMany).toHaveBeenCalledOnce();
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        currentVersion: {
          is: {
            operationalWorkDate: new Date("2026-07-31T00:00:00.000Z"),
          },
        },
      },
      select: supplyRequestDayViewSelect,
      orderBy: supplyRequestDayViewOrderBy,
    });
  });

  it("selects pointer identity and current item count without versions, items, or links", () => {
    expect(supplyRequestDayViewSelect).toMatchObject({
      id: true,
      namReference: true,
      currentVersionId: true,
      currentVersion: {
        select: {
          id: true,
          supplyRequestId: true,
          operationalWorkDate: true,
          _count: { select: { items: true } },
        },
      },
    });
    expect(supplyRequestDayViewSelect).not.toHaveProperty("versions");
    expect(supplyRequestDayViewSelect).not.toHaveProperty("dailyLogLinks");
    expect(supplyRequestDayViewSelect.currentVersion.select).not.toHaveProperty("items");
    expect(supplyRequestDayViewSelect.currentVersion.select).not.toHaveProperty(
      "equipmentId",
    );
  });

  it("maps immutable SetNull snapshots into the narrow public result", async () => {
    mocks.findMany.mockResolvedValue([record()]);
    await expect(getSupplyRequestDayViewItems("2026-07-31")).resolves.toEqual([
      {
        supplyRequestId: "request-1",
        namReference: "SR-2026-0001",
        equipmentLabel: "Deleted Work Truck · WT-9",
        itemCount: 1,
        supervisorName: "Historic Supervisor",
        statusLabel: "Requested",
        submittedLocalDate: "2026-07-30",
        submittedLocalTime: "08:15",
        detailHref: "/supply-requests/request-1",
      },
    ]);
  });

  it("rejects invalid input and persisted integrity without an empty fallback", async () => {
    await expect(
      getSupplyRequestDayViewItemsWithClient(
        { supplyRequest: { findMany: mocks.findMany } } as never,
        " 2026-07-31",
      ),
    ).rejects.toMatchObject({ code: "INVALID_DATE" });
    expect(mocks.findMany).not.toHaveBeenCalled();

    mocks.findMany.mockResolvedValue([
      record({ currentVersionId: null, currentVersion: null }),
    ]);
    await expect(getSupplyRequestDayViewItems("2026-07-31")).rejects.toMatchObject({
      code: "INVALID_CURRENT_STATE",
    });
  });

  it("isolates unexpected query failures and builds normalized history URLs", async () => {
    mocks.findMany.mockRejectedValue(
      new Error("P2024 SQLSTATE 53300 connection-detail-redacted"),
    );
    await expect(getSupplyRequestDayViewItems("2026-07-31")).rejects.toEqual(
      expect.objectContaining({
        code: "QUERY_UNAVAILABLE",
        message: "Supply Request Day View data is temporarily unavailable.",
      }),
    );
    expect(supplyRequestDayViewHistoryHref("2026-07-31")).toBe(
      "/supply-requests?dateFrom=2026-07-31&dateTo=2026-07-31&page=1",
    );
    expect(() => supplyRequestDayViewHistoryHref("2026-02-31")).toThrow(
      SupplyRequestDayViewError,
    );
  });
});
