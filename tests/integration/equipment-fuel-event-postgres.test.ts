import { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.EQUIPMENT_FUEL_TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

class RollbackOnly extends Error {}

function uniqueTestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function withRollback(
  client: PrismaClient,
  run: (transaction: Prisma.TransactionClient, prefix: string) => Promise<void>,
) {
  const prefix = `fuel-review-${uniqueTestId()}`;
  try {
    await client.$transaction(async (transaction) => {
      await run(transaction, prefix);
      throw new RollbackOnly();
    }, { timeout: 20_000 });
  } catch (error) {
    if (!(error instanceof RollbackOnly)) throw error;
  }
  expect(await client.equipmentFuelEvent.count({ where: { id: { startsWith: prefix } } })).toBe(0);
  expect(await client.fuelServicePerson.count({ where: { id: { startsWith: prefix } } })).toBe(0);
}

async function createBase(transaction: Prisma.TransactionClient, prefix: string) {
  const city = await transaction.city.create({
    data: { id: `${prefix}-city`, name: `${prefix} City`, state: "FL" },
  });
  const mine = await transaction.mine.create({
    data: { id: `${prefix}-mine`, cityId: city.id, name: `${prefix} Mine` },
  });
  const equipment = await transaction.equipment.create({
    data: {
      id: `${prefix}-equipment-a`, mineId: mine.id, displayName: `${prefix} Equipment A`,
      equipmentNumber: "A-1", category: "DRAGLINE", powerType: "DIESEL",
    },
  });
  const replacement = await transaction.equipment.create({
    data: {
      id: `${prefix}-equipment-b`, mineId: mine.id, displayName: `${prefix} Equipment B`,
      equipmentNumber: "B-1", category: "TRACTOR", powerType: "DIESEL",
    },
  });
  const dailyLog = await transaction.dailyLog.create({
    data: { id: `${prefix}-log`, logDate: new Date("2026-07-16T00:00:00Z"), shift: "DAY" },
  });
  const activity = await transaction.dailyLogActivity.create({
    data: {
      id: `${prefix}-activity`, dailyLogId: dailyLog.id,
      activityDate: new Date("2026-07-16T00:00:00Z"), sequence: 1,
      activityType: "FUEL_SERVICE", title: "Fueling", equipmentId: equipment.id,
    },
  });
  return { city, mine, equipment, replacement, activity };
}

function eventData(prefix: string, equipmentId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `${prefix}-event`, operationalWorkDate: new Date("2026-07-16T00:00:00Z"), eventTime: "23:55",
    equipmentId, equipmentDisplayName: "Historic Equipment", equipmentNumber: "H-1", equipmentCategory: "DRAGLINE" as const,
    mineName: "Historic Mine", cityName: "Historic City", cityState: "FL", fuelType: "DIESEL" as const,
    totalGallons: 100, ...overrides,
  };
}

describePostgres("Equipment Fuel Event PostgreSQL invariants", () => {
  it("validates repeated identity, SetNull behavior, snapshots, and child cascade in a rollback-only transaction", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const base = await createBase(transaction, prefix);
        const person = await transaction.fuelServicePerson.create({
          data: { id: `${prefix}-person`, displayName: "Review Person", normalizedKey: `${prefix} person` },
        });
        const first = await transaction.equipmentFuelEvent.create({
          data: {
            ...eventData(prefix, base.equipment.id), fuelServicePersonId: person.id,
            fuelServicePersonDisplayNameSnapshot: "Historic Review Person", dailyLogActivityId: base.activity.id,
            tankFills: { create: { id: `${prefix}-fill`, sequence: 1, tankLabel: "Main Tank", normalizedTankLabel: "main tank", gallons: 100 } },
          },
        });
        await transaction.equipmentFuelEvent.create({
          data: { ...eventData(prefix, base.equipment.id, { id: `${prefix}-event-2`, totalGallons: 50 }), tankFills: { create: { sequence: 1, tankLabel: "Main Tank", normalizedTankLabel: "main tank", gallons: 50 } } },
        });
        expect(await transaction.equipmentFuelEvent.count({ where: { operationalWorkDate: new Date("2026-07-16T00:00:00Z"), eventTime: "23:55" } })).toBeGreaterThanOrEqual(2);

        await transaction.dailyLogActivity.delete({ where: { id: base.activity.id } });
        expect((await transaction.equipmentFuelEvent.findUniqueOrThrow({ where: { id: first.id } })).dailyLogActivityId).toBeNull();
        await transaction.equipment.delete({ where: { id: base.equipment.id } });
        const historical = await transaction.equipmentFuelEvent.findUniqueOrThrow({ where: { id: first.id } });
        expect(historical).toMatchObject({ equipmentId: null, equipmentDisplayName: "Historic Equipment", mineName: "Historic Mine", fuelServicePersonDisplayNameSnapshot: "Historic Review Person" });
        await transaction.equipmentFuelEvent.delete({ where: { id: first.id } });
        expect(await transaction.equipmentFuelEventTankFill.count({ where: { equipmentFuelEventId: first.id } })).toBe(0);
      });
    } finally {
      await client.$disconnect();
    }
  });

  it("enforces one-to-one Daily Log links and normalized service-person uniqueness", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await expect(client.$transaction(async (transaction) => {
        const prefix = `fuel-review-${uniqueTestId()}`;
        const base = await createBase(transaction, prefix);
        await transaction.equipmentFuelEvent.create({ data: { ...eventData(prefix, base.equipment.id), dailyLogActivityId: base.activity.id } });
        await transaction.equipmentFuelEvent.create({ data: { ...eventData(prefix, base.equipment.id, { id: `${prefix}-event-2` }), dailyLogActivityId: base.activity.id } });
      })).rejects.toMatchObject({ code: "P2002" });

      await expect(client.$transaction(async (transaction) => {
        const prefix = `fuel-review-${uniqueTestId()}`;
        await transaction.fuelServicePerson.create({ data: { id: `${prefix}-person-a`, displayName: "Pat Smith", normalizedKey: `${prefix} pat smith` } });
        await transaction.fuelServicePerson.create({ data: { id: `${prefix}-person-b`, displayName: "PAT SMITH", normalizedKey: `${prefix} pat smith` } });
      })).rejects.toMatchObject({ code: "P2002" });
    } finally {
      await client.$disconnect();
    }
  });

  it("restricts deletion of a historically used Fuel Service Person", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await expect(client.$transaction(async (transaction) => {
        const prefix = `fuel-review-${uniqueTestId()}`;
        const base = await createBase(transaction, prefix);
        const person = await transaction.fuelServicePerson.create({ data: { id: `${prefix}-person`, displayName: "Pat Smith", normalizedKey: `${prefix} pat smith` } });
        await transaction.equipmentFuelEvent.create({ data: { ...eventData(prefix, base.equipment.id), fuelServicePersonId: person.id, fuelServicePersonDisplayNameSnapshot: "Pat Smith" } });
        await transaction.fuelServicePerson.delete({ where: { id: person.id } });
      })).rejects.toThrow(/violates RESTRICT setting[\s\S]*FuelEvent_servicePerson_fkey/);
    } finally {
      await client.$disconnect();
    }
  });

  it("preserves unchanged snapshots, refreshes changed Equipment, replaces fills, and rolls back partial aggregates", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await withRollback(client, async (transaction, prefix) => {
        const base = await createBase(transaction, prefix);
        const created = await transaction.equipmentFuelEvent.create({
          data: { ...eventData(prefix, base.equipment.id), tankFills: { create: { sequence: 1, tankLabel: "Stale Tank", normalizedTankLabel: "stale tank", gallons: 100 } } },
        });
        await transaction.equipmentFuelEvent.update({ where: { id: created.id }, data: { eventTime: "23:56" } });
        expect(await transaction.equipmentFuelEvent.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ equipmentDisplayName: "Historic Equipment", mineName: "Historic Mine" });

        await transaction.equipmentFuelEvent.update({ where: { id: created.id }, data: { equipmentId: base.replacement.id, equipmentDisplayName: base.replacement.displayName, equipmentNumber: base.replacement.equipmentNumber, equipmentCategory: base.replacement.category, mineName: base.mine.name, cityName: base.city.name, cityState: base.city.state, totalGallons: 200 } });
        await transaction.equipmentFuelEventTankFill.deleteMany({ where: { equipmentFuelEventId: created.id } });
        await transaction.equipmentFuelEventTankFill.create({ data: { equipmentFuelEventId: created.id, sequence: 1, tankLabel: "Replacement Tank", normalizedTankLabel: "replacement tank", gallons: 200 } });
        const corrected = await transaction.equipmentFuelEvent.findUniqueOrThrow({ where: { id: created.id }, include: { tankFills: true } });
        expect(corrected).toMatchObject({ equipmentId: base.replacement.id, equipmentDisplayName: base.replacement.displayName, mineName: base.mine.name });
        expect(corrected.tankFills.map((fill) => fill.tankLabel)).toEqual(["Replacement Tank"]);
      });

      const prefix = `fuel-review-${uniqueTestId()}`;
      await expect(client.$transaction(async (transaction) => {
        const base = await createBase(transaction, prefix);
        await transaction.equipmentFuelEvent.create({ data: { ...eventData(prefix, base.equipment.id), tankFills: { create: { sequence: 1, tankLabel: "Partial Tank", normalizedTankLabel: "partial tank", gallons: 100 } } } });
        throw new Error("forced rollback");
      })).rejects.toThrow("forced rollback");
      expect(await client.equipmentFuelEvent.count({ where: { id: { startsWith: prefix } } })).toBe(0);
      expect(await client.equipmentFuelEventTankFill.count({ where: { equipmentFuelEventId: { startsWith: prefix } } })).toBe(0);
    } finally {
      await client.$disconnect();
    }
  });
});
