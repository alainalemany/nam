import { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  persistDraglineDelayReportInTransaction,
} from "@/features/dragline-delay-reports/persistence";
import { draglineDelayReportSubmissionSchema } from "@/features/dragline-delay-reports/validation";
import { guardedDraglineDelayReportDatabaseUrl } from "../helpers/dragline-delay-report-postgres-guard";

const databaseUrl = guardedDraglineDelayReportDatabaseUrl();
const describePostgres = databaseUrl ? describe : describe.skip;

class RollbackOnly extends Error {}

function uniquePrefix() {
  return `ddr1-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function withRollback(
  client: PrismaClient,
  run: (transaction: Prisma.TransactionClient, prefix: string) => Promise<void>,
) {
  const prefix = uniquePrefix();
  try {
    await client.$transaction(
      async (transaction) => {
        await run(transaction, prefix);
        throw new RollbackOnly();
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    if (!(error instanceof RollbackOnly)) throw error;
  }
  expect(
    await client.draglineDelayReport.count({
      where: { equipmentDisplayName: { startsWith: prefix } },
    }),
  ).toBe(0);
}

async function createReferences(
  transaction: Prisma.TransactionClient,
  prefix: string,
) {
  const city = await transaction.city.create({
    data: { id: `${prefix}-city`, name: `${prefix} City`, state: "FL" },
  });
  const mine = await transaction.mine.create({
    data: { id: `${prefix}-mine`, cityId: city.id, name: `${prefix} Mine` },
  });
  const dragline = await transaction.equipment.create({
    data: {
      id: `${prefix}-dragline`,
      mineId: mine.id,
      displayName: `${prefix} Dragline`,
      equipmentNumber: "DL-1",
      category: "DRAGLINE",
    },
  });
  const otherEquipment = await transaction.equipment.create({
    data: {
      id: `${prefix}-truck`,
      mineId: mine.id,
      displayName: `${prefix} Truck`,
      equipmentNumber: "TR-1",
      category: "WORK_TRUCK",
    },
  });
  const inactiveDragline = await transaction.equipment.create({
    data: {
      id: `${prefix}-inactive-dragline`,
      mineId: mine.id,
      displayName: `${prefix} Inactive Dragline`,
      category: "DRAGLINE",
      status: "INACTIVE",
    },
  });
  const operator = await transaction.employee.create({
    data: {
      id: `${prefix}-operator`,
      displayName: "Integration Operator",
      employeeCode: `${prefix}-100`,
    },
  });
  const secondOperator = await transaction.employee.create({
    data: {
      id: `${prefix}-operator-2`,
      displayName: "Second Operator",
      employeeCode: `${prefix}-101`,
    },
  });
  const inactiveOperator = await transaction.employee.create({
    data: {
      id: `${prefix}-inactive-operator`,
      displayName: "Inactive Operator",
      isActive: false,
    },
  });
  const supervisor = await transaction.employee.create({
    data: {
      id: `${prefix}-supervisor`,
      displayName: "Integration Supervisor",
      employeeCode: `${prefix}-200`,
      isSupervisor: true,
    },
  });
  const nonsupervisor = await transaction.employee.create({
    data: {
      id: `${prefix}-nonsupervisor`,
      displayName: "Not Supervisor Eligible",
    },
  });
  const dailyLog = await transaction.dailyLog.create({
    data: {
      id: `${prefix}-daily-log`,
      logDate: new Date("2026-08-18T00:00:00.000Z"),
      shift: "NIGHT",
    },
  });
  const dailyLogActivity = await transaction.dailyLogActivity.create({
    data: {
      id: `${prefix}-daily-log-activity`,
      dailyLogId: dailyLog.id,
      activityDate: dailyLog.logDate,
      sequence: 1,
      activityType: "GENERAL_NOTE",
      title: "Existing Daily Log remains independent",
    },
  });

  return {
    city,
    mine,
    dragline,
    otherEquipment,
    inactiveDragline,
    operator,
    secondOperator,
    inactiveOperator,
    supervisor,
    nonsupervisor,
    dailyLog,
    dailyLogActivity,
  };
}

function validInput(
  references: Awaited<ReturnType<typeof createReferences>>,
  overrides: Record<string, unknown> = {},
) {
  return draglineDelayReportSubmissionSchema.parse({
    operationalWorkDate: "2026-08-18",
    shift: "NIGHT",
    equipmentId: references.dragline.id,
    startingHourMeter: 12000,
    endingHourMeter: "",
    supervisorId: references.supervisor.id,
    operators: [{ sequence: 1, employeeId: references.operator.id }],
    timelineEntries: [
      {
        sequence: 1,
        startTime: "23:30",
        dayOffset: 0,
        catalogVersion: 1,
        delayCode: "26",
        description: "Surveying",
        durationMinutes: 60,
        causesDowntime: true,
      },
      {
        sequence: 2,
        startTime: "00:00",
        dayOffset: 1,
        catalogVersion: 1,
        delayCode: "37",
        description: "Drag ropes",
        durationMinutes: 60,
        causesDowntime: true,
      },
      {
        sequence: 3,
        startTime: "00:00",
        dayOffset: 1,
        catalogVersion: 1,
        delayCode: "34",
        description: "Concurrent cleanup",
        durationMinutes: 20,
        causesDowntime: false,
      },
    ],
    ...overrides,
  });
}

describePostgres("Dragline Delay Report DDR-1 PostgreSQL workflow", () => {
  it("creates and edits a Draft while preserving retained child IDs and authoritative totals", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const references = await createReferences(transaction, prefix);
        const created = await persistDraglineDelayReportInTransaction(
          transaction,
          validInput(references),
        );
        const initial = await transaction.draglineDelayReport.findUniqueOrThrow({
          where: { id: created.id },
          include: { operators: true, timelineEntries: { orderBy: { sequence: "asc" } } },
        });
        expect(initial).toMatchObject({
          status: "DRAFT",
          shift: "NIGHT",
          startingHourMeter: 12000,
          endingHourMeter: null,
          downTimeMinutes: 90,
          runTimeMinutes: 630,
          recordVersion: 1,
          equipmentDisplayName: references.dragline.displayName,
          mineName: references.mine.name,
          supervisorDisplayName: references.supervisor.displayName,
        });
        expect(initial.timelineEntries.map((entry) => entry.startMinuteOffset)).toEqual([
          1410,
          1440,
          1440,
        ]);
        expect(initial.timelineEntries[0]).toMatchObject({
          delayCodeCatalogVersion: 1,
          delayCode: "26",
          delayCodeDescription: "Surveying",
          delayCodeCategory: "OPERATIONAL",
        });

        const retainedOperatorId = initial.operators[0].id;
        const retainedTimelineId = initial.timelineEntries[0].id;
        const removedTimelineId = initial.timelineEntries[1].id;
        const updatedInput = validInput(references, {
          recordVersion: 1,
          endingHourMeter: 12011,
          operators: [
            {
              id: retainedOperatorId,
              sequence: 1,
              employeeId: references.operator.id,
            },
            { sequence: 2, employeeId: references.secondOperator.id },
          ],
          timelineEntries: [
            {
              id: retainedTimelineId,
              sequence: 1,
              startTime: "23:30",
              dayOffset: 0,
              catalogVersion: 1,
              delayCode: "26",
              description: "Updated surveying context",
              durationMinutes: 30,
              causesDowntime: true,
            },
            {
              sequence: 2,
              startTime: "23:30",
              dayOffset: 0,
              catalogVersion: 1,
              delayCode: "35",
              description: "Concurrent startup check",
              durationMinutes: "",
              causesDowntime: false,
            },
          ],
        });
        const updated = await persistDraglineDelayReportInTransaction(
          transaction,
          updatedInput,
          initial.id,
        );
        expect(updated.recordVersion).toBe(2);

        const after = await transaction.draglineDelayReport.findUniqueOrThrow({
          where: { id: initial.id },
          include: {
            operators: { orderBy: { sequence: "asc" } },
            timelineEntries: { orderBy: { sequence: "asc" } },
          },
        });
        expect(after).toMatchObject({
          endingHourMeter: 12011,
          recordVersion: 2,
          downTimeMinutes: 30,
          runTimeMinutes: 690,
        });
        expect(after.operators).toHaveLength(2);
        expect(after.operators[0].id).toBe(retainedOperatorId);
        expect(after.timelineEntries).toHaveLength(2);
        expect(after.timelineEntries[0].id).toBe(retainedTimelineId);
        expect(after.timelineEntries.map((entry) => entry.id)).not.toContain(removedTimelineId);
        expect(
          await transaction.dailyLogActivity.findUnique({
            where: { id: references.dailyLogActivity.id },
          }),
        ).toBeTruthy();

        await expect(
          persistDraglineDelayReportInTransaction(
            transaction,
            { ...updatedInput, recordVersion: 1 },
            initial.id,
          ),
        ).rejects.toMatchObject({ kind: "stale" });
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("enforces Dragline-only Equipment and canonical Employee eligibility", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const references = await createReferences(transaction, prefix);
        await expect(
          persistDraglineDelayReportInTransaction(
            transaction,
            validInput(references, { equipmentId: references.otherEquipment.id }),
          ),
        ).rejects.toMatchObject({ field: "equipmentId" });
        await expect(
          persistDraglineDelayReportInTransaction(
            transaction,
            validInput(references, { equipmentId: references.inactiveDragline.id }),
          ),
        ).rejects.toMatchObject({ field: "equipmentId" });
        await expect(
          persistDraglineDelayReportInTransaction(
            transaction,
            validInput(references, {
              operators: [
                { sequence: 1, employeeId: references.inactiveOperator.id },
              ],
            }),
          ),
        ).rejects.toMatchObject({ field: "operators.0.employeeId" });
        await expect(
          persistDraglineDelayReportInTransaction(
            transaction,
            validInput(references, { supervisorId: references.nonsupervisor.id }),
          ),
        ).rejects.toMatchObject({ field: "supervisorId" });
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("persists the confirmed 05:00-to-17:00 Day and 17:00-to-05:00 Night boundaries", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const references = await createReferences(transaction, prefix);
        const dayInput = validInput(references, {
          shift: "DAY",
          timelineEntries: [
            {
              sequence: 1,
              startTime: "05:00",
              dayOffset: 0,
              catalogVersion: 1,
              delayCode: "35",
              description: "Day shift boundary",
              durationMinutes: "",
              causesDowntime: false,
            },
            {
              sequence: 2,
              startTime: "16:30",
              dayOffset: 0,
              catalogVersion: 1,
              delayCode: "26",
              description: "Ends at Day shift boundary",
              durationMinutes: 30,
              causesDowntime: true,
            },
          ],
        });
        const nightInput = validInput(references, {
          shift: "NIGHT",
          timelineEntries: [
            {
              sequence: 1,
              startTime: "17:00",
              dayOffset: 0,
              catalogVersion: 1,
              delayCode: "35",
              description: "Night shift boundary",
              durationMinutes: "",
              causesDowntime: false,
            },
            {
              sequence: 2,
              startTime: "04:30",
              dayOffset: 1,
              catalogVersion: 1,
              delayCode: "26",
              description: "Ends at Night shift boundary",
              durationMinutes: 30,
              causesDowntime: true,
            },
          ],
        });

        const day = await persistDraglineDelayReportInTransaction(
          transaction,
          dayInput,
        );
        const night = await persistDraglineDelayReportInTransaction(
          transaction,
          nightInput,
        );
        const persisted = await transaction.draglineDelayReport.findMany({
          where: { id: { in: [day.id, night.id] } },
          include: { timelineEntries: { orderBy: { sequence: "asc" } } },
          orderBy: { shift: "asc" },
        });

        const persistedDay = persisted.find((report) => report.shift === "DAY");
        const persistedNight = persisted.find((report) => report.shift === "NIGHT");
        expect(persistedDay?.timelineEntries.map((entry) => entry.startMinuteOffset)).toEqual([
          300,
          990,
        ]);
        expect(persistedNight?.timelineEntries.map((entry) => entry.startMinuteOffset)).toEqual([
          1020,
          1710,
        ]);
        expect(persistedDay).toMatchObject({ downTimeMinutes: 30, runTimeMinutes: 690 });
        expect(persistedNight).toMatchObject({ downTimeMinutes: 30, runTimeMinutes: 690 });

        expect(
          draglineDelayReportSubmissionSchema.safeParse({
            ...dayInput,
            timelineEntries: [
              { ...dayInput.timelineEntries[0], startTime: "17:00" },
            ],
          }).success,
        ).toBe(false);
        expect(
          draglineDelayReportSubmissionSchema.safeParse({
            ...nightInput,
            timelineEntries: [
              {
                ...nightInput.timelineEntries[1],
                startTime: "05:00",
                durationMinutes: "",
                causesDowntime: false,
              },
            ],
          }).success,
        ).toBe(false);
        expect(
          draglineDelayReportSubmissionSchema.safeParse({
            ...nightInput,
            timelineEntries: [
              {
                ...nightInput.timelineEntries[1],
                startTime: "04:31",
                durationMinutes: 30,
              },
            ],
          }).success,
        ).toBe(false);
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("enforces one report per Equipment/date/shift", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix();
    try {
      await expect(
        client.$transaction(async (transaction) => {
          const references = await createReferences(transaction, prefix);
          await persistDraglineDelayReportInTransaction(transaction, validInput(references));
          await persistDraglineDelayReportInTransaction(transaction, validInput(references));
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      expect(
        await client.draglineDelayReport.count({
          where: { equipmentDisplayName: { startsWith: prefix } },
        }),
      ).toBe(0);
    } finally {
      await client.$disconnect();
    }
  });

  it("preserves snapshots on SetNull and cascades report-owned children", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const references = await createReferences(transaction, prefix);
        const created = await persistDraglineDelayReportInTransaction(
          transaction,
          validInput(references),
        );
        await transaction.equipment.delete({ where: { id: references.dragline.id } });
        await transaction.employee.delete({ where: { id: references.operator.id } });
        await transaction.employee.delete({ where: { id: references.supervisor.id } });
        const historical = await transaction.draglineDelayReport.findUniqueOrThrow({
          where: { id: created.id },
          include: { operators: true },
        });
        expect(historical).toMatchObject({
          equipmentId: null,
          equipmentDisplayName: references.dragline.displayName,
          supervisorId: null,
          supervisorDisplayName: references.supervisor.displayName,
        });
        expect(historical.operators[0]).toMatchObject({
          employeeId: null,
          employeeDisplayName: references.operator.displayName,
        });

        await transaction.draglineDelayReport.delete({ where: { id: created.id } });
        expect(
          await transaction.draglineDelayReportOperator.count({
            where: { reportId: created.id },
          }),
        ).toBe(0);
        expect(
          await transaction.draglineDelayReportTimelineEntry.count({
            where: { reportId: created.id },
          }),
        ).toBe(0);
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("has the complete migration chain including DDR-1", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const rows = await client.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL
          AND rolled_back_at IS NULL
      `;
      expect(rows.map((row) => row.migration_name)).toContain(
        "20260818000100_dragline_delay_reports_ddr1",
      );
    } finally {
      await client.$disconnect();
    }
  });
});
