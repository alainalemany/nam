import { PrismaClient, type Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.OPERATIONAL_SAFETY_CHECKLIST_TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

class RollbackOnly extends Error {}

function uniquePrefix() {
  return `checklist-meter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function withRollback(
  client: PrismaClient,
  run: (transaction: Prisma.TransactionClient, prefix: string) => Promise<void>,
) {
  const prefix = uniquePrefix();
  try {
    await client.$transaction(async (transaction) => {
      await run(transaction, prefix);
      throw new RollbackOnly();
    });
  } catch (error) {
    if (!(error instanceof RollbackOnly)) throw error;
  }
  expect(
    await client.operationalSafetyChecklist.count({ where: { id: { startsWith: prefix } } }),
  ).toBe(0);
}

async function references(transaction: Prisma.TransactionClient, prefix: string) {
  const city = await transaction.city.create({
    data: { id: `${prefix}-city`, name: `${prefix} City`, state: "FL" },
  });
  const mine = await transaction.mine.create({
    data: { id: `${prefix}-mine`, cityId: city.id, name: `${prefix} Mine` },
  });
  const equipment = await Promise.all(
    [
      ["dragline", "DRAGLINE"],
      ["truck", "WORK_TRUCK"],
      ["tractor", "TRACTOR"],
    ].map(([suffix, category]) =>
      transaction.equipment.create({
        data: {
          id: `${prefix}-${suffix}`,
          mineId: mine.id,
          displayName: `${prefix} ${suffix}`,
          equipmentNumber: suffix.toUpperCase(),
          category: category as "DRAGLINE" | "WORK_TRUCK" | "TRACTOR",
        },
      }),
    ),
  );
  return { city, mine, equipment };
}

function checklistData(
  prefix: string,
  equipmentId: string,
  equipmentCategory: "DRAGLINE" | "WORK_TRUCK" | "TRACTOR",
  meterKind: "HOURS" | "MILES",
  suffix: string,
) {
  return {
    id: `${prefix}-checklist-${suffix}`,
    inspectionDate: new Date("2026-07-16T00:00:00.000Z"),
    shift: "NIGHT" as const,
    equipmentId,
    equipmentDisplayName: `${prefix} ${suffix}`,
    equipmentNumber: suffix.toUpperCase(),
    equipmentCategory,
    mineName: `${prefix} Mine`,
    cityName: `${prefix} City`,
    cityState: "FL",
    templateKey: equipmentCategory === "DRAGLINE" ? "DRAGLINE_INSPECTION" as const : "MOBILE_INSPECTION" as const,
    templateVersion: 1,
    templateName: equipmentCategory === "DRAGLINE" ? "Dragline Inspection" : "Mobile Inspection",
    meterKind,
    startingMeter: meterKind === "HOURS" ? 0 : 999999,
    operatorDisplayName: "Integration Operator",
    supervisorDisplayName: "Integration Supervisor",
  };
}

describePostgres("Operational Safety Checklist meter PostgreSQL invariants", () => {
  it("persists HOURS and MILES while allowing distinct Equipment on one shift", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const { equipment } = await references(transaction, prefix);
        await transaction.operationalSafetyChecklist.create({
          data: checklistData(prefix, equipment[0].id, "DRAGLINE", "HOURS", "dragline"),
        });
        await transaction.operationalSafetyChecklist.create({
          data: checklistData(prefix, equipment[1].id, "WORK_TRUCK", "MILES", "truck"),
        });
        await transaction.operationalSafetyChecklist.create({
          data: checklistData(prefix, equipment[2].id, "TRACTOR", "HOURS", "tractor"),
        });
        const rows = await transaction.operationalSafetyChecklist.findMany({
          where: { id: { startsWith: `${prefix}-checklist-` } },
          orderBy: { id: "asc" },
        });
        expect(rows).toHaveLength(3);
        expect(new Set(rows.map((row) => row.meterKind))).toEqual(new Set(["HOURS", "MILES"]));
        expect(new Set(rows.map((row) => row.recordVersion))).toEqual(new Set([1]));
        expect(new Set(rows.map((row) => row.inspectionDate.toISOString()))).toEqual(
          new Set(["2026-07-16T00:00:00.000Z"]),
        );
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("increments record versions atomically and rolls failed correction state back", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const { equipment } = await references(transaction, prefix);
        const created = await transaction.operationalSafetyChecklist.create({
          data: checklistData(prefix, equipment[0].id, "DRAGLINE", "HOURS", "dragline"),
        });
        expect(created.recordVersion).toBe(1);

        const second = await transaction.operationalSafetyChecklist.update({
          where: { id: created.id },
          data: { recordVersion: { increment: 1 }, startingMeter: 1 },
        });
        const third = await transaction.operationalSafetyChecklist.update({
          where: { id: created.id },
          data: { recordVersion: { increment: 1 }, startingMeter: 2 },
        });
        expect([second.recordVersion, third.recordVersion]).toEqual([2, 3]);
        expect(third.equipmentDisplayName).toBe(created.equipmentDisplayName);

        await transaction.$executeRawUnsafe("SAVEPOINT failed_correction");
        await transaction.operationalSafetyChecklist.update({
          where: { id: created.id },
          data: { recordVersion: { increment: 1 }, startingMeter: 3 },
        });
        await transaction.$executeRawUnsafe("ROLLBACK TO SAVEPOINT failed_correction");

        const afterRollback = await transaction.operationalSafetyChecklist.findUniqueOrThrow({
          where: { id: created.id },
        });
        expect(afterRollback.recordVersion).toBe(3);
        expect(afterRollback.startingMeter).toBe(2);
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("keeps same-Equipment/date/shift uniqueness authoritative", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix();
    try {
      await expect(
        client.$transaction(async (transaction) => {
          const { equipment } = await references(transaction, prefix);
          const data = checklistData(prefix, equipment[0].id, "DRAGLINE", "HOURS", "dragline");
          await transaction.operationalSafetyChecklist.create({ data });
          await transaction.operationalSafetyChecklist.create({
            data: { ...data, id: `${prefix}-duplicate`, meterKind: "MILES" },
          });
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      expect(
        await client.operationalSafetyChecklist.count({ where: { id: { startsWith: prefix } } }),
      ).toBe(0);
    } finally {
      await client.$disconnect();
    }
  });
});
