import { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildTimesheetHistoryWhere } from "@/features/timesheets/filters";

const databaseUrl = process.env.TIMESHEET_HISTORY_TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

class RollbackOnly extends Error {}

function uniqueTestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function withRollback(
  client: PrismaClient,
  run: (
    transaction: Prisma.TransactionClient,
    prefix: string,
  ) => Promise<void>,
) {
  const prefix = `timesheet-history-${uniqueTestId()}`;
  try {
    await client.$transaction(
      async (transaction) => {
        await run(transaction, prefix);
        throw new RollbackOnly();
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    if (!(error instanceof RollbackOnly)) {
      throw error;
    }
  }

  expect(
    await client.weeklyTimesheet.count({
      where: { id: { startsWith: prefix } },
    }),
  ).toBe(0);
}

function entrySnapshots(equipmentNumber: string) {
  return {
    clockIn: "07:00",
    clockOut: "15:00",
    unpaidBreakMinutes: 0,
    workedMinutes: 480,
    regularMinutes: 420,
    overtimeMinutes: 60,
    primaryEquipmentDisplayNameSnapshot: "Historic Dragline",
    primaryEquipmentNumberSnapshot: equipmentNumber,
    primaryEquipmentCategorySnapshot: "DRAGLINE" as const,
    primaryMineNameSnapshot: "Historic Mine",
    primaryCityNameSnapshot: "Historic City",
    primaryCityStateSnapshot: "WY",
  };
}

function allocation(
  prefix: string,
  suffix: string,
  workCodeId: string,
  workOrderId: string,
  supportPersonId?: string,
) {
  return {
    id: `${prefix}-${suffix}`,
    sequence: Number(suffix.match(/\d+$/)?.[0] ?? 1),
    workCodeId,
    workCodeSnapshot: `Historic ${workCodeId}`,
    workCodeDescriptionSnapshot: "Historic Work Code",
    workOrderId,
    workOrderSnapshot: `Historic ${workOrderId}`,
    workOrderDescriptionSnapshot: "Historic Work Order",
    allocatedMinutes: 480,
    supportPersonnel: supportPersonId
      ? {
          create: {
            id: `${prefix}-${suffix}-support`,
            supportPersonId,
            supportPersonDisplayNameSnapshot: "Historic Support Person",
            supportPersonTradeOrRoleSnapshot: "Mechanic",
          },
        }
      : undefined,
  };
}

describePostgres("Timesheet History PostgreSQL filtering", () => {
  it("enforces same-entry and same-allocation matching with inactive references", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const city = await transaction.city.create({
          data: {
            id: `${prefix}-city`,
            name: `${prefix} City`,
            state: "WY",
          },
        });
        const mine = await transaction.mine.create({
          data: {
            id: `${prefix}-mine`,
            cityId: city.id,
            name: `${prefix} Mine`,
          },
        });
        const equipmentA = await transaction.equipment.create({
          data: {
            id: `${prefix}-equipment-a`,
            mineId: mine.id,
            displayName: `${prefix} Equipment A`,
            equipmentNumber: "A-1",
            category: "DRAGLINE",
          },
        });
        const equipmentB = await transaction.equipment.create({
          data: {
            id: `${prefix}-equipment-b`,
            mineId: mine.id,
            displayName: `${prefix} Equipment B`,
            equipmentNumber: "B-1",
            category: "DRAGLINE",
          },
        });
        const codeA = await transaction.timesheetWorkCode.create({
          data: {
            id: `${prefix}-code-a`,
            code: `${prefix}-A`,
            normalizedCode: `${prefix}-A`,
            description: "Code A",
            active: false,
          },
        });
        const codeB = await transaction.timesheetWorkCode.create({
          data: {
            id: `${prefix}-code-b`,
            code: `${prefix}-B`,
            normalizedCode: `${prefix}-B`,
            description: "Code B",
          },
        });
        const orderA = await transaction.timesheetWorkOrder.create({
          data: {
            id: `${prefix}-order-a`,
            workOrderNumber: `${prefix}-WO-A`,
            normalizedWorkOrderNumber: `${prefix}-WO-A`,
            description: "Order A",
            active: false,
          },
        });
        const orderB = await transaction.timesheetWorkOrder.create({
          data: {
            id: `${prefix}-order-b`,
            workOrderNumber: `${prefix}-WO-B`,
            normalizedWorkOrderNumber: `${prefix}-WO-B`,
            description: "Order B",
          },
        });
        const personA = await transaction.timesheetSupportPerson.create({
          data: {
            id: `${prefix}-person-a`,
            displayName: `${prefix} Person A`,
            normalizedIdentity: `${prefix} person a|mechanic|`,
            tradeOrRole: "Mechanic",
            active: false,
          },
        });

        await transaction.weeklyTimesheet.create({
          data: {
            id: `${prefix}-coherent`,
            payrollWeekStartDate: new Date("2026-07-13T00:00:00.000Z"),
            payrollWeekEndDate: new Date("2026-07-19T00:00:00.000Z"),
            primaryEmployeeDisplayName: "Alex Coherent",
            primaryEmployeeKey: `${prefix}-coherent`,
            workedMinutesTotal: 480,
            regularMinutesTotal: 420,
            overtimeMinutesTotal: 60,
            entries: {
              create: {
                id: `${prefix}-coherent-entry`,
                workDate: new Date("2026-07-13T00:00:00.000Z"),
                primaryEquipmentId: equipmentA.id,
                ...entrySnapshots("A-1"),
                allocations: {
                  create: allocation(
                    prefix,
                    "coherent-allocation-1",
                    codeA.id,
                    orderA.id,
                    personA.id,
                  ),
                },
              },
            },
          },
        });

        await transaction.weeklyTimesheet.create({
          data: {
            id: `${prefix}-split-entry`,
            payrollWeekStartDate: new Date("2026-07-13T00:00:00.000Z"),
            payrollWeekEndDate: new Date("2026-07-19T00:00:00.000Z"),
            primaryEmployeeDisplayName: "Blair Split Entry",
            primaryEmployeeKey: `${prefix}-split-entry`,
            workedMinutesTotal: 960,
            regularMinutesTotal: 900,
            overtimeMinutesTotal: 60,
            entries: {
              create: [
                {
                  id: `${prefix}-split-entry-a`,
                  workDate: new Date("2026-07-14T00:00:00.000Z"),
                  primaryEquipmentId: equipmentA.id,
                  ...entrySnapshots("A-1"),
                  allocations: {
                    create: allocation(
                      prefix,
                      "split-entry-a-allocation-1",
                      codeB.id,
                      orderB.id,
                    ),
                  },
                },
                {
                  id: `${prefix}-split-entry-b`,
                  workDate: new Date("2026-07-15T00:00:00.000Z"),
                  primaryEquipmentId: equipmentB.id,
                  ...entrySnapshots("B-1"),
                  allocations: {
                    create: allocation(
                      prefix,
                      "split-entry-b-allocation-1",
                      codeA.id,
                      orderA.id,
                      personA.id,
                    ),
                  },
                },
              ],
            },
          },
        });

        await transaction.weeklyTimesheet.create({
          data: {
            id: `${prefix}-split-allocation`,
            payrollWeekStartDate: new Date("2026-07-13T00:00:00.000Z"),
            payrollWeekEndDate: new Date("2026-07-19T00:00:00.000Z"),
            primaryEmployeeDisplayName: "Casey Split Allocation",
            primaryEmployeeKey: `${prefix}-split-allocation`,
            workedMinutesTotal: 480,
            regularMinutesTotal: 480,
            overtimeMinutesTotal: 0,
            entries: {
              create: {
                id: `${prefix}-split-allocation-entry`,
                workDate: new Date("2026-07-16T00:00:00.000Z"),
                primaryEquipmentId: equipmentA.id,
                ...entrySnapshots("A-1"),
                overtimeMinutes: 0,
                allocations: {
                  create: [
                    allocation(
                      prefix,
                      "split-allocation-1",
                      codeA.id,
                      orderA.id,
                    ),
                    allocation(
                      prefix,
                      "split-allocation-2",
                      codeB.id,
                      orderB.id,
                      personA.id,
                    ),
                  ],
                },
              },
            },
          },
        });

        const coherentWhere = buildTimesheetHistoryWhere({
          page: 1,
          equipmentId: equipmentA.id,
          workCodeId: codeA.id,
          workOrderId: orderA.id,
          supportPersonId: personA.id,
          hasOvertime: true,
        });
        expect(
          await transaction.weeklyTimesheet.findMany({
            where: {
              id: { startsWith: prefix },
              AND: coherentWhere.AND,
            },
            select: { id: true },
          }),
        ).toEqual([{ id: `${prefix}-coherent` }]);

        const splitEntryWhere = buildTimesheetHistoryWhere({
          page: 1,
          equipmentId: equipmentA.id,
          workCodeId: codeA.id,
        });
        const entryMatches = await transaction.weeklyTimesheet.findMany({
          where: {
            id: { startsWith: prefix },
            AND: splitEntryWhere.AND,
          },
          select: { id: true },
        });
        expect(entryMatches.map((item) => item.id)).not.toContain(
          `${prefix}-split-entry`,
        );

        const splitCodeAndOrderWhere = buildTimesheetHistoryWhere({
          page: 1,
          workCodeId: codeA.id,
          workOrderId: orderB.id,
        });
        const splitCodeAndOrderMatches =
          await transaction.weeklyTimesheet.findMany({
            where: {
              id: { startsWith: prefix },
              AND: splitCodeAndOrderWhere.AND,
            },
            select: { id: true },
          });
        expect(
          splitCodeAndOrderMatches.map((item) => item.id),
        ).not.toContain(`${prefix}-split-allocation`);

        const splitSupportWhere = buildTimesheetHistoryWhere({
          page: 1,
          workCodeId: codeA.id,
          workOrderId: orderA.id,
          supportPersonId: personA.id,
        });
        const splitSupportMatches = await transaction.weeklyTimesheet.findMany({
          where: {
            id: { startsWith: prefix },
            AND: splitSupportWhere.AND,
          },
          select: { id: true },
        });
        expect(splitSupportMatches.map((item) => item.id)).not.toContain(
          `${prefix}-split-allocation`,
        );

        await transaction.equipment.delete({ where: { id: equipmentA.id } });
        const historical = await transaction.dailyTimeEntry.findUniqueOrThrow({
          where: { id: `${prefix}-coherent-entry` },
        });
        expect(historical).toMatchObject({
          primaryEquipmentId: null,
          primaryEquipmentDisplayNameSnapshot: "Historic Dragline",
          primaryEquipmentNumberSnapshot: "A-1",
          primaryEquipmentCategorySnapshot: "DRAGLINE",
          primaryMineNameSnapshot: "Historic Mine",
          primaryCityNameSnapshot: "Historic City",
          primaryCityStateSnapshot: "WY",
        });
        expect(
          await transaction.weeklyTimesheet.count({
            where: {
              id: `${prefix}-coherent`,
              AND: buildTimesheetHistoryWhere({
                page: 1,
                equipmentId: equipmentA.id,
              }).AND,
            },
          }),
        ).toBe(0);
      });
    } finally {
      await client.$disconnect();
    }
  });
});
