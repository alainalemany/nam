import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getTimesheetHistory,
  getTimesheetHistoryFilterOptions,
} from "@/features/timesheets/data";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  equipmentFindMany: vi.fn(),
  workCodeFindMany: vi.fn(),
  workOrderFindMany: vi.fn(),
  supportPersonFindMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    weeklyTimesheet: {
      count: mocks.count,
      findMany: mocks.findMany,
      create: mocks.create,
      update: mocks.update,
      delete: mocks.delete,
    },
    equipment: { findMany: mocks.equipmentFindMany },
    timesheetWorkCode: { findMany: mocks.workCodeFindMany },
    timesheetWorkOrder: { findMany: mocks.workOrderFindMany },
    timesheetSupportPerson: { findMany: mocks.supportPersonFindMany },
  },
}));

function historyRecord(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "timesheet-1",
    payrollWeekStartDate: new Date("2026-07-13T00:00:00.000Z"),
    payrollWeekEndDate: new Date("2026-07-19T00:00:00.000Z"),
    status: "DRAFT",
    primaryEmployeeDisplayName: "Alex Operator",
    primaryEmployeeKey: "alex operator",
    workedMinutesTotal: 690,
    regularMinutesTotal: 600,
    overtimeMinutesTotal: 90,
    createdAt: new Date("2026-07-13T00:00:00.000Z"),
    updatedAt: new Date("2026-07-13T00:00:00.000Z"),
    entries: [
      {
        id: "entry-1",
        workDate: new Date("2026-07-14T00:00:00.000Z"),
        primaryEquipmentDisplayNameSnapshot: "Historic Dragline",
        primaryEquipmentNumberSnapshot: "HD-1",
        primaryEquipmentCategorySnapshot: "DRAGLINE",
        primaryMineNameSnapshot: "Historic Mine",
        primaryCityNameSnapshot: "Historic City",
        primaryCityStateSnapshot: "WY",
        workedMinutes: 690,
        regularMinutes: 600,
        overtimeMinutes: 90,
        allocations: [
          {
            workCodeSnapshot: "P-137",
            workCodeDescriptionSnapshot: "Historic Production",
            workOrderSnapshot: "WO-88",
            workOrderDescriptionSnapshot: "Historic Boom Repair",
            allocatedMinutes: 690,
            supportPersonnel: [
              {
                supportPersonDisplayNameSnapshot: "Historic Pat Smith",
                supportPersonTradeOrRoleSnapshot: "Mechanic",
                supportPersonCompanySnapshot: "Historic Mechanics Co",
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("Timesheet history data", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.count.mockResolvedValue(0);
    mocks.findMany.mockResolvedValue([]);
    mocks.equipmentFindMany.mockResolvedValue([]);
    mocks.workCodeFindMany.mockResolvedValue([]);
    mocks.workOrderFindMany.mockResolvedValue([]);
    mocks.supportPersonFindMany.mockResolvedValue([]);
  });

  it("queries one 50-row page with deterministic ordering and deliberate counts", async () => {
    mocks.count.mockResolvedValueOnce(125).mockResolvedValueOnce(75);
    mocks.findMany.mockResolvedValue([historyRecord()]);

    const history = await getTimesheetHistory({
      page: 2,
      status: "DRAFT",
    });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ status: "DRAFT" }] },
        orderBy: [
          { payrollWeekStartDate: "desc" },
          { primaryEmployeeDisplayName: "asc" },
          { id: "asc" },
        ],
        skip: 50,
        take: 50,
      }),
    );
    expect(history).toMatchObject({
      totalCount: 125,
      matchingCount: 75,
      page: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });

  it("uses the exact 50-result boundary to determine a next page", async () => {
    mocks.count.mockResolvedValueOnce(101).mockResolvedValueOnce(101);

    await expect(getTimesheetHistory({ page: 1 })).resolves.toMatchObject({
      hasPreviousPage: false,
      hasNextPage: true,
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 50 }),
    );
  });

  it("returns an out-of-range requested page without clamping", async () => {
    mocks.count.mockResolvedValueOnce(60).mockResolvedValueOnce(60);

    await expect(getTimesheetHistory({ page: 3 })).resolves.toMatchObject({
      items: [],
      totalCount: 60,
      matchingCount: 60,
      page: 3,
      hasPreviousPage: true,
      hasNextPage: false,
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("does not issue an unsafe Prisma offset for an extremely large page", async () => {
    mocks.count.mockResolvedValue(60);

    await expect(
      getTimesheetHistory({ page: Number.MAX_SAFE_INTEGER }),
    ).resolves.toMatchObject({
      items: [],
      matchingCount: 60,
      page: Number.MAX_SAFE_INTEGER,
      hasPreviousPage: true,
      hasNextPage: false,
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("maps persisted totals and historical snapshots without live reference reads", async () => {
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([historyRecord()]);

    const history = await getTimesheetHistory({ page: 1 });

    expect(history.items[0]).toMatchObject({
      workedMinutesTotal: 690,
      regularMinutesTotal: 600,
      overtimeMinutesTotal: 90,
      entryCount: 1,
      entries: [
        {
          equipmentCategory: "DRAGLINE",
          equipmentIdentity:
            "Historic Dragline #HD-1 (Historic Mine - Historic City, WY)",
          workedMinutes: 690,
          regularMinutes: 600,
          overtimeMinutes: 90,
          allocationSummaries: [
            "P-137 - Historic Production · WO-88 - Historic Boom Repair · Historic Pat Smith (Mechanic, Historic Mechanics Co) · 11:30 allocated",
          ],
        },
      ],
    });
    expect(mocks.findMany.mock.calls[0][0].include.entries.select).not.toHaveProperty(
      "primaryEquipment",
    );
  });

  it("filters deleted Equipment only by its live relationship ID", async () => {
    mocks.count.mockResolvedValue(0);

    await getTimesheetHistory({ page: 1, equipmentId: "deleted-equipment" });

    expect(mocks.count).toHaveBeenNthCalledWith(
      2,
      {
        where: {
          AND: [
            {
              entries: {
                some: { primaryEquipmentId: "deleted-equipment" },
              },
            },
          ],
        },
      },
    );
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("includes inactive historical references in filter option data", async () => {
    mocks.equipmentFindMany.mockResolvedValue([
      {
        id: "equipment-1",
        displayName: "Dragline",
        equipmentNumber: "137",
        status: "INACTIVE",
        mine: { name: "North Mine" },
      },
    ]);
    mocks.workCodeFindMany.mockResolvedValue([
      {
        id: "code-1",
        code: "P-137",
        description: "Production",
        active: false,
      },
    ]);
    mocks.workOrderFindMany.mockResolvedValue([
      {
        id: "order-1",
        workOrderNumber: "WO-88",
        description: "Repair",
        active: false,
      },
    ]);
    mocks.supportPersonFindMany.mockResolvedValue([
      {
        id: "person-1",
        displayName: "Pat Smith",
        tradeOrRole: "Mechanic",
        active: false,
      },
    ]);

    await expect(getTimesheetHistoryFilterOptions()).resolves.toEqual({
      equipment: [
        {
          id: "equipment-1",
          label: "Dragline (#137) - North Mine",
          active: false,
        },
      ],
      workCodes: [
        { id: "code-1", label: "P-137 - Production", active: false },
      ],
      workOrders: [
        { id: "order-1", label: "WO-88 - Repair", active: false },
      ],
      supportPersonnel: [
        { id: "person-1", label: "Pat Smith - Mechanic", active: false },
      ],
    });
  });

  it("performs only read operations and preserves lifecycle data", async () => {
    const record = historyRecord({
      status: "COMPLETED",
      overtimeMinutesTotal: 90,
    });
    const persistedBeforeRead = structuredClone(record);
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([record]);

    await getTimesheetHistory({
      page: 1,
      status: "COMPLETED",
      hasOvertime: true,
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(record).toEqual(persistedBeforeRead);
  });
});
