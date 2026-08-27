import { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  completeDraglineDelayReportInTransaction,
  correctDraglineDelayReportInTransaction,
  persistDraglineDelayReportInTransaction,
} from "@/features/dragline-delay-reports/persistence";
import {
  draglineDelayReportCompletionSchema,
  draglineDelayReportSubmissionSchema,
} from "@/features/dragline-delay-reports/validation";
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
  const otherMine = await transaction.mine.create({
    data: { id: `${prefix}-other-mine`, cityId: city.id, name: `${prefix} Other Mine` },
  });
  const lake = await transaction.lake.create({
    data: { id: `${prefix}-lake`, mineId: mine.id, name: "Lake 12" },
  });
  const inactiveLake = await transaction.lake.create({
    data: {
      id: `${prefix}-inactive-lake`,
      mineId: mine.id,
      name: "Inactive Lake",
      status: "INACTIVE",
    },
  });
  const otherMineLake = await transaction.lake.create({
    data: { id: `${prefix}-other-lake`, mineId: otherMine.id, name: "Other Lake" },
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
    otherMine,
    lake,
    inactiveLake,
    otherMineLake,
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
    lakeId: references.lake.id,
    normalDiggingBuckets: 120,
    benchfillBuckets: 15,
    stationStart: "50+60",
    stationEnd: "50+30",
    depthFeet: 65,
    fuelGallons: 500,
    cableDragFeet: 12,
    hoistFeet: 8,
    comments: "End-of-shift Draft comment",
    safetyItemsFound: "Ground crack monitored",
    actionTaken: "Kept dragline outside marked boundary",
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
    groundChecks: [
      { sequence: 1, startTime: "23:00", dayOffset: 0 },
      { sequence: 2, startTime: "02:00", dayOffset: 1 },
    ],
    ...overrides,
  });
}

function validCompletionInput(
  references: Awaited<ReturnType<typeof createReferences>>,
  overrides: Record<string, unknown> = {},
) {
  const draft = validInput(references);
  return draglineDelayReportCompletionSchema.parse({
    ...draft,
    endingHourMeter: 12012,
    timelineEntries: [
      ...draft.timelineEntries,
      {
        sequence: draft.timelineEntries.length + 1,
        startTime: "04:59",
        dayOffset: 1,
        catalogVersion: 1,
        delayCode: "13",
        description: "Shift Change",
        durationMinutes: "",
        causesDowntime: false,
      },
    ],
    ...overrides,
  });
}

describePostgres("Dragline Delay Report DDR-1 through DDR-3 PostgreSQL workflow", () => {
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
          include: {
            operators: true,
            timelineEntries: { orderBy: { sequence: "asc" } },
            groundChecks: { orderBy: { sequence: "asc" } },
          },
        });
        expect(initial).toMatchObject({
          status: "DRAFT",
          shift: "NIGHT",
          startingHourMeter: 12000,
          endingHourMeter: null,
          downTimeMinutes: 110,
          runTimeMinutes: 610,
          recordVersion: 1,
          equipmentDisplayName: references.dragline.displayName,
          mineName: references.mine.name,
          supervisorDisplayName: references.supervisor.displayName,
          lakeId: references.lake.id,
          lakeDisplayNameSnapshot: references.lake.name,
          normalDiggingBuckets: 120,
          benchfillBuckets: 15,
          stationStartFeet: 5060,
          stationEndFeet: 5030,
          depthFeet: 65,
          fuelGallons: 500,
          cableDragFeet: 12,
          hoistFeet: 8,
        });
        expect(initial.groundChecks.map((groundCheck) => groundCheck.startMinuteOffset)).toEqual([1380, 1560]);
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
        const retainedGroundCheckId = initial.groundChecks[0].id;
        const removedGroundCheckId = initial.groundChecks[1].id;
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
          groundChecks: [
            {
              id: retainedGroundCheckId,
              sequence: 1,
              startTime: "23:30",
              dayOffset: 0,
            },
            { sequence: 2, startTime: "03:00", dayOffset: 1 },
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
            groundChecks: { orderBy: { sequence: "asc" } },
          },
        });
        expect(after).toMatchObject({
          endingHourMeter: 12011,
          recordVersion: 2,
          downTimeMinutes: 40,
          runTimeMinutes: 680,
        });
        expect(after.operators).toHaveLength(2);
        expect(after.operators[0].id).toBe(retainedOperatorId);
        expect(after.timelineEntries).toHaveLength(2);
        expect(after.timelineEntries[0].id).toBe(retainedTimelineId);
        expect(after.timelineEntries.map((entry) => entry.id)).not.toContain(removedTimelineId);
        expect(after.groundChecks).toHaveLength(2);
        expect(after.groundChecks[0].id).toBe(retainedGroundCheckId);
        expect(after.groundChecks.map((entry) => entry.id)).not.toContain(removedGroundCheckId);
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

  it("persists progressive Draft Section states and rejects End-only at the database", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const references = await createReferences(transaction, prefix);
        const neither = await persistDraglineDelayReportInTransaction(
          transaction,
          validInput(references, {
            operationalWorkDate: "2026-08-21",
            stationStart: "",
            stationEnd: "",
          }),
        );
        const startOnly = await persistDraglineDelayReportInTransaction(
          transaction,
          validInput(references, {
            operationalWorkDate: "2026-08-22",
            stationStart: "18+5",
            stationEnd: "",
          }),
        );
        const both = await persistDraglineDelayReportInTransaction(
          transaction,
          validInput(references, {
            operationalWorkDate: "2026-08-23",
            stationStart: "18+5",
            stationEnd: "18+20",
          }),
        );

        expect(
          await transaction.draglineDelayReport.findUniqueOrThrow({
            where: { id: neither.id },
            select: { stationStartFeet: true, stationEndFeet: true },
          }),
        ).toEqual({ stationStartFeet: null, stationEndFeet: null });
        expect(
          await transaction.draglineDelayReport.findUniqueOrThrow({
            where: { id: startOnly.id },
            select: { stationStartFeet: true, stationEndFeet: true },
          }),
        ).toEqual({ stationStartFeet: 1805, stationEndFeet: null });
        expect(
          await transaction.draglineDelayReport.findUniqueOrThrow({
            where: { id: both.id },
            select: { stationStartFeet: true, stationEndFeet: true },
          }),
        ).toEqual({ stationStartFeet: 1805, stationEndFeet: 1820 });

        await transaction.$executeRawUnsafe("SAVEPOINT ddr_end_only_check");
        let endOnlyRejected = false;
        try {
          await transaction.draglineDelayReport.update({
            where: { id: startOnly.id },
            data: { stationStartFeet: null, stationEndFeet: 1820 },
          });
        } catch {
          endOnlyRejected = true;
          await transaction.$executeRawUnsafe(
            "ROLLBACK TO SAVEPOINT ddr_end_only_check",
          );
        }
        expect(endOnlyRejected).toBe(true);
        expect(
          await transaction.draglineDelayReport.findUniqueOrThrow({
            where: { id: startOnly.id },
            select: { stationStartFeet: true, stationEndFeet: true },
          }),
        ).toEqual({ stationStartFeet: 1805, stationEndFeet: null });
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
        await expect(
          persistDraglineDelayReportInTransaction(
            transaction,
            validInput(references, { lakeId: references.otherMineLake.id }),
          ),
        ).rejects.toMatchObject({ field: "lakeId" });
        await expect(
          persistDraglineDelayReportInTransaction(
            transaction,
            validInput(references, { lakeId: references.inactiveLake.id }),
          ),
        ).rejects.toMatchObject({ field: "lakeId" });
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("persists extended factual timelines while retaining scheduled 12-hour totals", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const references = await createReferences(transaction, prefix);
        const dayInput = validInput(references, {
          shift: "DAY",
          groundChecks: [
            { sequence: 1, startTime: "05:00", dayOffset: 0 },
            { sequence: 2, startTime: "16:59", dayOffset: 0 },
          ],
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
              startTime: "16:50",
              dayOffset: 0,
              catalogVersion: 1,
              delayCode: "26",
              description: "Crosses the Day shift boundary",
              durationMinutes: 30,
              causesDowntime: true,
            },
            {
              sequence: 3,
              startTime: "18:00",
              dayOffset: 0,
              catalogVersion: 1,
              delayCode: "13",
              description: "Late Day Shift Change",
              durationMinutes: "",
              causesDowntime: false,
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
              startTime: "04:50",
              dayOffset: 1,
              catalogVersion: 1,
              delayCode: "26",
              description: "Crosses the Night shift boundary",
              durationMinutes: 30,
              causesDowntime: true,
            },
            {
              sequence: 3,
              startTime: "06:00",
              dayOffset: 1,
              catalogVersion: 1,
              delayCode: "13",
              description: "Late Night Shift Change",
              durationMinutes: "",
              causesDowntime: false,
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
          1010,
          1080,
        ]);
        expect(persistedNight?.timelineEntries.map((entry) => entry.startMinuteOffset)).toEqual([
          1020,
          1730,
          1800,
        ]);
        expect(persistedDay).toMatchObject({ downTimeMinutes: 20, runTimeMinutes: 700 });
        expect(persistedNight).toMatchObject({ downTimeMinutes: 10, runTimeMinutes: 710 });

        expect(
          draglineDelayReportSubmissionSchema.safeParse({
            ...dayInput,
            timelineEntries: [
              { ...dayInput.timelineEntries[0], startTime: "17:00" },
            ],
          }).success,
        ).toBe(true);
        expect(
          draglineDelayReportSubmissionSchema.safeParse({
            ...nightInput,
            timelineEntries: [
              {
                ...nightInput.timelineEntries[1],
                sequence: 1,
                startTime: "05:00",
                durationMinutes: "",
                causesDowntime: false,
              },
            ],
          }).success,
        ).toBe(true);
        expect(
          draglineDelayReportSubmissionSchema.safeParse({
            ...nightInput,
            timelineEntries: [
              {
                ...nightInput.timelineEntries[1],
                sequence: 1,
                startTime: "04:31",
                durationMinutes: 30,
              },
            ],
          }).success,
        ).toBe(true);
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("uses the two-calendar-day database bound for timeline starts", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix();
    try {
      const constraints = await client.$queryRaw<Array<{ definition: string }>>`
        SELECT pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conname = 'DraglineDelayReportTimeline_start_check'
          AND conrelid = '"DraglineDelayReportTimelineEntry"'::regclass
      `;
      expect(constraints).toHaveLength(1);
      expect(constraints[0].definition).toContain(
        '"startMinuteOffset" >= 0',
      );
      expect(constraints[0].definition).toContain(
        '"startMinuteOffset" <= 2879',
      );

      await expect(
        client.$transaction(async (transaction) => {
          const references = await createReferences(transaction, prefix);
          const report = await persistDraglineDelayReportInTransaction(
            transaction,
            validInput(references),
          );
          const source = await transaction.draglineDelayReportTimelineEntry.findFirstOrThrow({
            where: { reportId: report.id },
          });
          await transaction.draglineDelayReportTimelineEntry.create({
            data: {
              id: `${prefix}-outside-timeline`,
              reportId: report.id,
              sequence: 99,
              startMinuteOffset: 2880,
              delayCodeCatalogVersion: source.delayCodeCatalogVersion,
              delayCode: source.delayCode,
              delayCodeDescription: source.delayCodeDescription,
              delayCodeCategory: source.delayCodeCategory,
              description: "Outside the supported two-calendar-day timeline",
              causesDowntime: false,
            },
          });
        }),
      ).rejects.toThrow(/DraglineDelayReportTimeline_start_check/);
      expect(
        await client.draglineDelayReport.count({
          where: { equipmentDisplayName: { startsWith: prefix } },
        }),
      ).toBe(0);
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
        await transaction.lake.delete({ where: { id: references.lake.id } });
        const historical = await transaction.draglineDelayReport.findUniqueOrThrow({
          where: { id: created.id },
          include: { operators: true },
        });
        expect(historical).toMatchObject({
          equipmentId: null,
          equipmentDisplayName: references.dragline.displayName,
          supervisorId: null,
          supervisorDisplayName: references.supervisor.displayName,
          lakeId: null,
          lakeDisplayNameSnapshot: references.lake.name,
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
        expect(
          await transaction.draglineDelayReportGroundCheck.count({
            where: { reportId: created.id },
          }),
        ).toBe(0);
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("completes explicitly, preserves child IDs, and keeps optional DDR-2 fields nullable", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const references = await createReferences(transaction, prefix);
        const draftInput = validInput(references, {
          lakeId: "",
          normalDiggingBuckets: "",
          benchfillBuckets: "",
          stationStart: "",
          stationEnd: "",
          depthFeet: "",
          fuelGallons: "",
          cableDragFeet: "",
          hoistFeet: "",
          groundChecks: [],
          comments: "",
          safetyItemsFound: "",
          actionTaken: "",
        });
        const created = await persistDraglineDelayReportInTransaction(
          transaction,
          draftInput,
        );
        const before = await transaction.draglineDelayReport.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            operators: { orderBy: { sequence: "asc" } },
            timelineEntries: { orderBy: { sequence: "asc" } },
          },
        });
        const completion = draglineDelayReportCompletionSchema.parse({
          ...draftInput,
          recordVersion: before.recordVersion,
          endingHourMeter: 12012,
          operators: draftInput.operators.map((operator, index) => ({
            ...operator,
            id: before.operators[index].id,
          })),
          timelineEntries: [
            ...draftInput.timelineEntries.map((entry, index) => ({
              ...entry,
              id: before.timelineEntries[index].id,
            })),
            {
              sequence: draftInput.timelineEntries.length + 1,
              startTime: "04:59",
              dayOffset: 1,
              catalogVersion: 1,
              delayCode: "13",
              description: "Shift Change",
              durationMinutes: "",
              causesDowntime: false,
            },
          ],
        });

        const completed = await completeDraglineDelayReportInTransaction(
          transaction,
          completion,
          before.id,
        );
        expect(completed).toEqual({ id: before.id, recordVersion: 2 });
        const after = await transaction.draglineDelayReport.findUniqueOrThrow({
          where: { id: before.id },
          include: {
            operators: { orderBy: { sequence: "asc" } },
            timelineEntries: { orderBy: { sequence: "asc" } },
            corrections: true,
          },
        });
        expect(after).toMatchObject({
          id: before.id,
          status: "COMPLETED",
          recordVersion: 2,
          lakeId: null,
          normalDiggingBuckets: null,
          benchfillBuckets: null,
          stationStartFeet: null,
          stationEndFeet: null,
          depthFeet: null,
          fuelGallons: null,
          cableDragFeet: null,
          hoistFeet: null,
        });
        expect(after.completedAt).toBeInstanceOf(Date);
        expect(after.operators[0].id).toBe(before.operators[0].id);
        expect(after.timelineEntries.slice(0, -1).map((entry) => entry.id)).toEqual(
          before.timelineEntries.map((entry) => entry.id),
        );
        expect(after.timelineEntries.at(-1)?.delayCode).toBe("13");
        expect(after.corrections).toHaveLength(0);
        await expect(
          persistDraglineDelayReportInTransaction(
            transaction,
            { ...completion, recordVersion: 2 },
            before.id,
          ),
        ).rejects.toThrow("Only Draft reports can be saved or completed");
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("records ordered corrections with stable identity, stable children, and stale-write safety", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const references = await createReferences(transaction, prefix);
        const created = await persistDraglineDelayReportInTransaction(
          transaction,
          validInput(references),
        );
        const draft = await transaction.draglineDelayReport.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            operators: { orderBy: { sequence: "asc" } },
            timelineEntries: { orderBy: { sequence: "asc" } },
            groundChecks: { orderBy: { sequence: "asc" } },
          },
        });
        const completionBase = validCompletionInput(references, {
          recordVersion: 1,
        });
        const completion = draglineDelayReportCompletionSchema.parse({
          ...completionBase,
          operators: completionBase.operators.map((operator, index) => ({
            ...operator,
            id: draft.operators[index].id,
          })),
          timelineEntries: completionBase.timelineEntries.map((entry, index) => ({
            ...entry,
            id: draft.timelineEntries[index]?.id,
          })),
          groundChecks: completionBase.groundChecks.map((groundCheck, index) => ({
            ...groundCheck,
            id: draft.groundChecks[index].id,
          })),
        });
        await completeDraglineDelayReportInTransaction(
          transaction,
          completion,
          draft.id,
        );
        const completed = await transaction.draglineDelayReport.findUniqueOrThrow({
          where: { id: draft.id },
          include: {
            operators: { orderBy: { sequence: "asc" } },
            timelineEntries: { orderBy: { sequence: "asc" } },
            groundChecks: { orderBy: { sequence: "asc" } },
          },
        });
        const correctionInput = draglineDelayReportCompletionSchema.parse({
          ...completion,
          recordVersion: 2,
          endingHourMeter: 12013,
          comments: "First corrected value",
          operators: completion.operators.map((operator, index) => ({
            ...operator,
            id: completed.operators[index].id,
          })),
          timelineEntries: completion.timelineEntries.map((entry, index) => ({
            ...entry,
            id: completed.timelineEntries[index].id,
          })),
          groundChecks: completion.groundChecks.map((groundCheck, index) => ({
            ...groundCheck,
            id: completed.groundChecks[index].id,
          })),
        });
        const first = await correctDraglineDelayReportInTransaction(
          transaction,
          correctionInput,
          completed.id,
          "Corrected Ending Hour Meter from signed shift paperwork.",
        );
        expect(first).toEqual({ id: completed.id, recordVersion: 3 });

        const afterFirst = await transaction.draglineDelayReport.findUniqueOrThrow({
          where: { id: completed.id },
          include: {
            timelineEntries: { orderBy: { sequence: "asc" } },
            groundChecks: { orderBy: { sequence: "asc" } },
            corrections: { orderBy: { sequence: "asc" } },
          },
        });
        expect(afterFirst).toMatchObject({
          id: completed.id,
          status: "COMPLETED",
          recordVersion: 3,
          endingHourMeter: 12013,
        });
        expect(afterFirst.timelineEntries.map((entry) => entry.id)).toEqual(
          completed.timelineEntries.map((entry) => entry.id),
        );
        expect(afterFirst.groundChecks.map((entry) => entry.id)).toEqual(
          completed.groundChecks.map((entry) => entry.id),
        );
        expect(afterFirst.corrections[0]).toMatchObject({
          sequence: 1,
          reason: "Corrected Ending Hour Meter from signed shift paperwork.",
          previousRecordVersion: 2,
          resultingRecordVersion: 3,
        });

        const secondInput = draglineDelayReportCompletionSchema.parse({
          ...correctionInput,
          recordVersion: 3,
          comments: "Second corrected value",
        });
        await correctDraglineDelayReportInTransaction(
          transaction,
          secondInput,
          completed.id,
          "Clarified the report comments.",
        );
        const afterSecond = await transaction.draglineDelayReport.findUniqueOrThrow({
          where: { id: completed.id },
          include: { corrections: { orderBy: { sequence: "asc" } } },
        });
        expect(afterSecond).toMatchObject({ status: "COMPLETED", recordVersion: 4 });
        expect(afterSecond.corrections.map((correction) => ({
          sequence: correction.sequence,
          reason: correction.reason,
          previous: correction.previousRecordVersion,
          resulting: correction.resultingRecordVersion,
        }))).toEqual([
          {
            sequence: 1,
            reason: "Corrected Ending Hour Meter from signed shift paperwork.",
            previous: 2,
            resulting: 3,
          },
          {
            sequence: 2,
            reason: "Clarified the report comments.",
            previous: 3,
            resulting: 4,
          },
        ]);

        await expect(
          correctDraglineDelayReportInTransaction(
            transaction,
            correctionInput,
            completed.id,
            "Stale correction must not persist.",
          ),
        ).rejects.toMatchObject({ kind: "stale" });
        expect(
          await transaction.draglineDelayReportCorrection.count({
            where: { reportId: completed.id },
          }),
        ).toBe(2);
        await expect(
          correctDraglineDelayReportInTransaction(
            transaction,
            { ...secondInput, recordVersion: 4 },
            completed.id,
            "   ",
          ),
        ).rejects.toMatchObject({ field: "correctionReason" });
        expect(
          await transaction.draglineDelayReportCorrection.count({
            where: { reportId: completed.id },
          }),
        ).toBe(2);
        expect(
          await transaction.dailyLogActivity.findUnique({
            where: { id: references.dailyLogActivity.id },
          }),
        ).toBeTruthy();
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("rejects stale completion without changing Draft status", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const references = await createReferences(transaction, prefix);
        const created = await persistDraglineDelayReportInTransaction(
          transaction,
          validInput(references),
        );
        await persistDraglineDelayReportInTransaction(
          transaction,
          validInput(references, { recordVersion: 1, comments: "Newer Draft" }),
          created.id,
        );
        await expect(
          completeDraglineDelayReportInTransaction(
            transaction,
            validCompletionInput(references, { recordVersion: 1 }),
            created.id,
          ),
        ).rejects.toMatchObject({ kind: "stale" });
        const after = await transaction.draglineDelayReport.findUniqueOrThrow({
          where: { id: created.id },
          include: { corrections: true },
        });
        expect(after).toMatchObject({ status: "DRAFT", recordVersion: 2 });
        expect(after.completedAt).toBeNull();
        expect(after.corrections).toHaveLength(0);
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("has the complete migration chain including DDR-1 through DDR-3", async () => {
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
      expect(rows.map((row) => row.migration_name)).toContain(
        "20260819000100_dragline_delay_reports_ddr2",
      );
      expect(rows.map((row) => row.migration_name)).toContain(
        "20260819000200_dragline_delay_reports_ddr3",
      );
      expect(rows.map((row) => row.migration_name)).toContain(
        "20260826000100_dragline_delay_report_draft_section_start",
      );
    } finally {
      await client.$disconnect();
    }
  });

  it("installs the DDR-2 constraints and intended deletion behavior", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const constraints = await client.$queryRaw<
        Array<{ conname: string; confdeltype: string; definition: string }>
      >`
        SELECT conname, confdeltype::text, pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conname IN (
          'Lake_mine_fkey',
          'DraglineDelayReport_lake_fkey',
          'DraglineDelayReportGroundCheck_report_fkey',
          'DraglineDelayReport_station_pair_check',
          'DraglineDelayReport_normal_buckets_check',
          'DraglineDelayReport_depth_check',
          'DraglineDelayReport_fuel_check',
          'DraglineDelayReportGroundCheck_sequence_check',
          'DraglineDelayReportGroundCheck_start_check'
        )
      `;
      const byName = new Map(
        constraints.map((constraint) => [constraint.conname, constraint]),
      );
      expect([...byName.keys()]).toHaveLength(9);
      expect(byName.get("Lake_mine_fkey")?.confdeltype).toBe("r");
      expect(byName.get("DraglineDelayReport_lake_fkey")?.confdeltype).toBe("n");
      expect(
        byName.get("DraglineDelayReportGroundCheck_report_fkey")?.confdeltype,
      ).toBe("c");
      expect(
        byName.get("DraglineDelayReport_station_pair_check")?.definition,
      ).toMatch(
        /"stationEndFeet" IS NULL.*OR.*"stationStartFeet" IS NOT NULL/,
      );
    } finally {
      await client.$disconnect();
    }
  });

  it("installs the DDR-3 completion and correction-history constraints", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const constraints = await client.$queryRaw<
        Array<{ conname: string; confdeltype: string }>
      >`
        SELECT conname, confdeltype::text
        FROM pg_constraint
        WHERE conname IN (
          'DraglineDelayReport_completion_state_check',
          'DraglineDelayReportCorrection_report_fkey',
          'DraglineDelayReportCorrection_sequence_check',
          'DraglineDelayReportCorrection_reason_check',
          'DraglineDelayReportCorrection_version_check'
        )
      `;
      const byName = new Map(
        constraints.map((constraint) => [constraint.conname, constraint.confdeltype]),
      );
      expect([...byName.keys()]).toHaveLength(5);
      expect(byName.get("DraglineDelayReportCorrection_report_fkey")).toBe("c");
    } finally {
      await client.$disconnect();
    }
  });
});
