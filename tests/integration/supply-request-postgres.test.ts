import { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

const expectedTestDatabaseName = "nam_supply_request_test";

function guardedDatabaseUrl() {
  const value = process.env.SUPPLY_REQUEST_TEST_DATABASE_URL;
  if (!value) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "SUPPLY_REQUEST_TEST_DATABASE_URL must be a valid PostgreSQL URL.",
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    databaseName !== expectedTestDatabaseName
  ) {
    throw new Error(
      `Supply Requests PostgreSQL tests require the disposable ${expectedTestDatabaseName} database.`,
    );
  }

  return value;
}

const databaseUrl = guardedDatabaseUrl();
const describePostgres = databaseUrl ? describe : describe.skip;

class RollbackProbe extends Error {}

function uniquePrefix(label: string) {
  return `supply-request-${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function fixtureReferenceSequence(prefix: string, ordinal: number) {
  let hash = 2_166_136_261;
  for (const character of prefix) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return ((hash >>> 0) % 20_000_000) * 100 + ordinal;
}

function expectSingleUniqueConflict(
  results: PromiseSettledResult<unknown>[],
) {
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect(rejected[0].reason).toMatchObject({ code: "P2002" });
}

function versionData(
  prefix: string,
  supplyRequestId: string,
  supervisorId: string,
  versionNumber = 1,
) {
  return {
    id: `${prefix}-version-${versionNumber}`,
    supplyRequestId,
    versionNumber,
    changeKind: "CREATED" as const,
    status: "REQUESTED" as const,
    operationalWorkDate: new Date("2026-07-28T00:00:00.000Z"),
    submittedLocalDate: new Date("2026-07-29T00:00:00.000Z"),
    submittedLocalTime: "01:15",
    equipmentDisplayNameSnapshot: "Historic Dragline",
    equipmentNumberSnapshot: "101133",
    equipmentCategorySnapshot: "DRAGLINE" as const,
    mineNameSnapshot: "Historic Mine",
    cityNameSnapshot: "Historic City",
    cityStateSnapshot: "WY",
    requesterDisplayNameSnapshot: "Alain Alemany",
    requesterEmployeeNumberSnapshot: "911601",
    supervisorId,
    supervisorNameSnapshot: "Historic Supervisor",
    supervisorEmailSnapshot: "historic.supervisor@example.com",
  };
}

async function createSupervisor(client: PrismaClient, prefix: string) {
  return client.supplyRequestSupervisor.create({
    data: {
      id: `${prefix}-supervisor`,
      fullName: "Historic Supervisor",
      email: `${prefix}@example.com`,
      normalizedEmail: `${prefix}@example.com`,
    },
  });
}

async function createRoot(
  client: PrismaClient,
  prefix: string,
  sequence: number,
  year = 2026,
) {
  const referenceSequence = fixtureReferenceSequence(prefix, sequence);

  return client.supplyRequest.create({
    data: {
      id: `${prefix}-request-${year}-${sequence}`,
      namReference: `SR-${year}-${String(referenceSequence).padStart(4, "0")}`,
      referenceYear: year,
      referenceSequence,
    },
  });
}

async function allocateSequence(
  client: PrismaClient | Prisma.TransactionClient,
  referenceYear: number,
) {
  const rows = await client.$queryRaw<Array<{ lastSequence: number }>>(
    Prisma.sql`
      INSERT INTO "SupplyRequestReferenceCounter"
        ("referenceYear", "lastSequence", "createdAt", "updatedAt")
      VALUES
        (${referenceYear}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("referenceYear")
      DO UPDATE SET
        "lastSequence" = "SupplyRequestReferenceCounter"."lastSequence" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "lastSequence"
    `,
  );

  return rows[0].lastSequence;
}

describePostgres("Supply Requests PostgreSQL persistence integrity", () => {
  it("exposes the migrated models and physical composite ownership constraint", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await expect(client.supplyItem.count()).resolves.toBeGreaterThanOrEqual(0);
      await expect(
        client.supplyRequestSupervisor.count(),
      ).resolves.toBeGreaterThanOrEqual(0);
      await expect(
        client.supplyRequestReferenceCounter.count(),
      ).resolves.toBeGreaterThanOrEqual(0);
      await expect(client.supplyRequest.count()).resolves.toBeGreaterThanOrEqual(
        0,
      );
      await expect(
        client.supplyRequestVersion.count(),
      ).resolves.toBeGreaterThanOrEqual(0);
      await expect(
        client.supplyRequestVersionItem.count(),
      ).resolves.toBeGreaterThanOrEqual(0);

      const constraints = await client.$queryRaw<
        Array<{ constraint_name: string }>
      >(Prisma.sql`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = current_schema()
          AND table_name = 'SupplyRequest'
          AND constraint_name = 'SupplyRequest_currentVersion_owner_fkey'
          AND constraint_type = 'FOREIGN KEY'
      `);
      expect(constraints).toEqual([
        { constraint_name: "SupplyRequest_currentVersion_owner_fkey" },
      ]);
    } finally {
      await client.$disconnect();
    }
  });

  it("enforces normalized Supply Item uniqueness, including concurrent inserts", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix("items");
    try {
      await client.supplyItem.create({
        data: {
          id: `${prefix}-first`,
          itemNumber: " AB-12 ",
          normalizedItemNumber: `${prefix}-ab-12`,
          description: "First formatting",
          unitOfMeasure: "Each",
        },
      });
      await expect(
        client.supplyItem.create({
          data: {
            id: `${prefix}-duplicate`,
            itemNumber: "ab-12",
            normalizedItemNumber: `${prefix}-ab-12`,
            description: "Different display formatting",
            unitOfMeasure: "Each",
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });

      const normalizedItemNumber = `${prefix}-concurrent`;
      const results = await Promise.allSettled(
        [1, 2].map((number) =>
          client.supplyItem.create({
            data: {
              id: `${prefix}-concurrent-${number}`,
              itemNumber: `Concurrent ${number}`,
              normalizedItemNumber,
              description: "Concurrent insert",
              unitOfMeasure: "Each",
            },
          }),
        ),
      );
      expectSingleUniqueConflict(results);
      expect(
        await client.supplyItem.count({ where: { normalizedItemNumber } }),
      ).toBe(1);
    } finally {
      await client.supplyItem.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.$disconnect();
    }
  });

  it("enforces normalized supervisor email uniqueness but permits shared names", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix("supervisors");
    try {
      await client.supplyRequestSupervisor.create({
        data: {
          id: `${prefix}-first`,
          fullName: "Shared Name",
          email: "Supervisor.One@Example.com",
          normalizedEmail: `${prefix}-one@example.com`,
        },
      });
      await client.supplyRequestSupervisor.create({
        data: {
          id: `${prefix}-same-name`,
          fullName: "Shared Name",
          email: "supervisor.two@example.com",
          normalizedEmail: `${prefix}-two@example.com`,
        },
      });
      await expect(
        client.supplyRequestSupervisor.create({
          data: {
            id: `${prefix}-duplicate`,
            fullName: "Another Name",
            email: "SUPERVISOR.ONE@example.com",
            normalizedEmail: `${prefix}-one@example.com`,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });

      const normalizedEmail = `${prefix}-concurrent@example.com`;
      const results = await Promise.allSettled(
        [1, 2].map((number) =>
          client.supplyRequestSupervisor.create({
            data: {
              id: `${prefix}-concurrent-${number}`,
              fullName: `Concurrent ${number}`,
              email: `concurrent-${number}@example.com`,
              normalizedEmail,
            },
          }),
        ),
      );
      expectSingleUniqueConflict(results);
      expect(
        await client.supplyRequestSupervisor.count({
          where: { normalizedEmail },
        }),
      ).toBe(1);
    } finally {
      await client.supplyRequestSupervisor.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.$disconnect();
    }
  });

  it("enforces NAM Reference and annual sequence uniqueness", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix("references");
    try {
      const first = await createRoot(client, prefix, 1, 4101);
      await expect(
        client.supplyRequest.create({
          data: {
            id: `${prefix}-duplicate-reference`,
            namReference: first.namReference,
            referenceYear: 4101,
            referenceSequence: first.referenceSequence + 1,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      await expect(
        client.supplyRequest.create({
          data: {
            id: `${prefix}-duplicate-sequence`,
            namReference: `${prefix}-different-reference`,
            referenceYear: 4101,
            referenceSequence: first.referenceSequence,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      const second = await createRoot(client, prefix, 2, 4101);
      await expect(
        client.supplyRequest.update({
          where: { id: second.id },
          data: { namReference: first.namReference },
        }),
      ).rejects.toMatchObject({ code: "P2002" });

      await createRoot(client, prefix, 1, 4102);
      expect(
        await client.supplyRequest.count({
          where: { id: { startsWith: prefix } },
        }),
      ).toBe(3);
    } finally {
      await client.supplyRequest.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.$disconnect();
    }
  });

  it("allocates annual sequences atomically, independently, and rollback-safely", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const year = 4200 + Math.floor(Math.random() * 100_000);
    const otherYear = year + 1;
    try {
      expect(await allocateSequence(client, year)).toBe(1);
      expect(await allocateSequence(client, year)).toBe(2);

      const concurrent = await Promise.all(
        Array.from({ length: 12 }, () => allocateSequence(client, year)),
      );
      expect(new Set(concurrent).size).toBe(12);
      expect([...concurrent].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 12 }, (_, index) => index + 3),
      );
      expect(
        (
          await client.supplyRequestReferenceCounter.findUniqueOrThrow({
            where: { referenceYear: year },
          })
        ).lastSequence,
      ).toBe(14);

      expect(await allocateSequence(client, otherYear)).toBe(1);
      await expect(
        client.$transaction(async (transaction) => {
          expect(await allocateSequence(transaction, year)).toBe(15);
          throw new RollbackProbe();
        }),
      ).rejects.toBeInstanceOf(RollbackProbe);
      expect(await allocateSequence(client, year)).toBe(15);
    } finally {
      await client.supplyRequestReferenceCounter.deleteMany({
        where: { referenceYear: { in: [year, otherYear] } },
      });
      await client.$disconnect();
    }
  });

  it("enforces version numbering and same-request current-version ownership", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix("versions");
    try {
      const supervisor = await createSupervisor(client, prefix);
      const firstRoot = await createRoot(client, prefix, 1, 4301);
      const secondRoot = await createRoot(client, prefix, 2, 4301);
      const firstVersion = await client.supplyRequestVersion.create({
        data: versionData(prefix, firstRoot.id, supervisor.id),
      });
      const secondVersion = await client.supplyRequestVersion.create({
        data: {
          ...versionData(`${prefix}-second`, secondRoot.id, supervisor.id),
          id: `${prefix}-second-version-1`,
        },
      });

      await expect(
        client.supplyRequestVersion.create({
          data: {
            ...versionData(`${prefix}-duplicate`, firstRoot.id, supervisor.id),
            id: `${prefix}-duplicate-version`,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });

      await client.supplyRequest.update({
        where: { id: firstRoot.id },
        data: { currentVersionId: firstVersion.id },
      });
      await expect(
        client.supplyRequest.update({
          where: { id: firstRoot.id },
          data: { currentVersionId: secondVersion.id },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
      await expect(
        client.supplyRequestVersion.delete({ where: { id: firstVersion.id } }),
      ).rejects.toThrow("SupplyRequest_currentVersion_owner_fkey");

      const candidateKey = await client.$queryRaw<
        Array<{ indexname: string }>
      >(Prisma.sql`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = 'SupplyRequestVersion'
          AND indexname = 'SupplyRequestVersion_id_request_key'
      `);
      expect(candidateKey).toHaveLength(1);
    } finally {
      await client.supplyRequest.updateMany({
        where: { id: { startsWith: prefix } },
        data: { currentVersionId: null },
      });
      await client.supplyRequest.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.supplyRequestSupervisor.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.$disconnect();
    }
  });

  it("enforces ordered item uniqueness and cascades owned lines", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix("version-items");
    try {
      const supervisor = await createSupervisor(client, prefix);
      const root = await createRoot(client, prefix, 1, 4401);
      const firstVersion = await client.supplyRequestVersion.create({
        data: versionData(prefix, root.id, supervisor.id),
      });
      const secondVersion = await client.supplyRequestVersion.create({
        data: {
          ...versionData(`${prefix}-v2`, root.id, supervisor.id, 2),
          changeKind: "CORRECTED",
          correctionReason: "Corrected quantity",
          correctedByDisplayNameSnapshot: "Alain Alemany",
          correctionLocalDate: new Date("2026-07-29T00:00:00.000Z"),
          correctionLocalTime: "02:00",
        },
      });
      const firstItem = await client.supplyItem.create({
        data: {
          id: `${prefix}-item-1`,
          itemNumber: "ITEM-1",
          normalizedItemNumber: `${prefix}-item-1`,
          description: "Item one",
          unitOfMeasure: "Each",
        },
      });
      const secondItem = await client.supplyItem.create({
        data: {
          id: `${prefix}-item-2`,
          itemNumber: "ITEM-2",
          normalizedItemNumber: `${prefix}-item-2`,
          description: "Item two",
          unitOfMeasure: "Box",
        },
      });
      const line = {
        quantity: 1,
        itemNumberSnapshot: "ITEM-1",
        normalizedItemNumberSnapshot: `${prefix}-item-1`,
        descriptionSnapshot: "Historic item one",
        unitOfMeasureSnapshot: "Each",
      };
      await client.supplyRequestVersionItem.create({
        data: {
          id: `${prefix}-line-1`,
          versionId: firstVersion.id,
          supplyItemId: firstItem.id,
          sequence: 1,
          ...line,
        },
      });
      await expect(
        client.supplyRequestVersionItem.create({
          data: {
            id: `${prefix}-duplicate-sequence`,
            versionId: firstVersion.id,
            supplyItemId: secondItem.id,
            sequence: 1,
            ...line,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      await expect(
        client.supplyRequestVersionItem.create({
          data: {
            id: `${prefix}-duplicate-item`,
            versionId: firstVersion.id,
            supplyItemId: firstItem.id,
            sequence: 2,
            ...line,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });

      await client.supplyRequestVersionItem.create({
        data: {
          id: `${prefix}-line-v2`,
          versionId: secondVersion.id,
          supplyItemId: firstItem.id,
          sequence: 1,
          ...line,
        },
      });
      await client.supplyRequestVersion.delete({
        where: { id: firstVersion.id },
      });
      expect(
        await client.supplyRequestVersionItem.count({
          where: { versionId: firstVersion.id },
        }),
      ).toBe(0);
      expect(
        await client.supplyRequestVersionItem.count({
          where: { versionId: secondVersion.id },
        }),
      ).toBe(1);
    } finally {
      await client.supplyRequest.updateMany({
        where: { id: { startsWith: prefix } },
        data: { currentVersionId: null },
      });
      await client.supplyRequest.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.supplyItem.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.supplyRequestSupervisor.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.$disconnect();
    }
  });

  it("sets deleted Equipment references to null while preserving snapshots", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix("equipment");
    try {
      const city = await client.city.create({
        data: { id: `${prefix}-city`, name: "Live City", state: "WY" },
      });
      const mine = await client.mine.create({
        data: { id: `${prefix}-mine`, name: "Live Mine", cityId: city.id },
      });
      const equipment = await client.equipment.create({
        data: {
          id: `${prefix}-equipment`,
          displayName: "Live Dragline",
          equipmentNumber: "LIVE-1",
          category: "DRAGLINE",
          mineId: mine.id,
        },
      });
      const supervisor = await createSupervisor(client, prefix);
      const root = await createRoot(client, prefix, 1, 4501);
      const version = await client.supplyRequestVersion.create({
        data: {
          ...versionData(prefix, root.id, supervisor.id),
          equipmentId: equipment.id,
        },
      });

      await client.equipment.delete({ where: { id: equipment.id } });
      const persisted = await client.supplyRequestVersion.findUniqueOrThrow({
        where: { id: version.id },
      });
      expect(persisted.equipmentId).toBeNull();
      expect(persisted.equipmentDisplayNameSnapshot).toBe("Historic Dragline");
      expect(persisted.mineNameSnapshot).toBe("Historic Mine");
      expect(persisted.cityNameSnapshot).toBe("Historic City");
    } finally {
      await client.supplyRequest.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.supplyRequestSupervisor.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.mine.deleteMany({ where: { id: { startsWith: prefix } } });
      await client.city.deleteMany({ where: { id: { startsWith: prefix } } });
      await client.$disconnect();
    }
  });

  it("restricts used reference deletion while allowing inactivation", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix("restrict");
    try {
      const supervisor = await createSupervisor(client, prefix);
      const item = await client.supplyItem.create({
        data: {
          id: `${prefix}-item`,
          itemNumber: "USED-1",
          normalizedItemNumber: `${prefix}-used-1`,
          description: "Used item",
          unitOfMeasure: "Each",
        },
      });
      const root = await createRoot(client, prefix, 1, 4601);
      const version = await client.supplyRequestVersion.create({
        data: versionData(prefix, root.id, supervisor.id),
      });
      await client.supplyRequestVersionItem.create({
        data: {
          id: `${prefix}-line`,
          versionId: version.id,
          supplyItemId: item.id,
          sequence: 1,
          quantity: 2,
          itemNumberSnapshot: "USED-1",
          normalizedItemNumberSnapshot: `${prefix}-used-1`,
          descriptionSnapshot: "Historic used item",
          unitOfMeasureSnapshot: "Each",
        },
      });

      await expect(
        client.supplyItem.delete({ where: { id: item.id } }),
      ).rejects.toThrow("SupplyRequestVersionItem_supplyItem_fkey");
      await expect(
        client.supplyRequestSupervisor.delete({
          where: { id: supervisor.id },
        }),
      ).rejects.toThrow("SupplyRequestVersion_supervisor_fkey");
      await client.supplyItem.update({
        where: { id: item.id },
        data: { active: false },
      });
      await client.supplyRequestSupervisor.update({
        where: { id: supervisor.id },
        data: { active: false },
      });
      expect(
        await client.supplyRequestVersionItem.count({
          where: { versionId: version.id },
        }),
      ).toBe(1);
    } finally {
      await client.supplyRequest.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.supplyItem.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.supplyRequestSupervisor.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.$disconnect();
    }
  });

  it("supports exceptional aggregate removal with a populated current pointer", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix("root-removal");
    const counterYear = 4700 + Math.floor(Math.random() * 100_000);
    try {
      const city = await client.city.create({
        data: { id: `${prefix}-city`, name: "Independent City", state: "WY" },
      });
      const mine = await client.mine.create({
        data: {
          id: `${prefix}-mine`,
          cityId: city.id,
          name: "Independent Mine",
        },
      });
      const equipment = await client.equipment.create({
        data: {
          id: `${prefix}-equipment`,
          mineId: mine.id,
          displayName: "Independent Equipment",
          category: "DRAGLINE",
        },
      });
      const supervisor = await createSupervisor(client, prefix);
      const item = await client.supplyItem.create({
        data: {
          id: `${prefix}-item`,
          itemNumber: "PRESERVED-1",
          normalizedItemNumber: `${prefix}-preserved-1`,
          description: "Preserved catalog item",
          unitOfMeasure: "Each",
        },
      });
      const root = await createRoot(client, prefix, 1, counterYear);
      const version = await client.supplyRequestVersion.create({
        data: {
          ...versionData(prefix, root.id, supervisor.id),
          equipmentId: equipment.id,
        },
      });
      await client.supplyRequestVersionItem.create({
        data: {
          id: `${prefix}-line`,
          versionId: version.id,
          supplyItemId: item.id,
          sequence: 1,
          quantity: 1,
          itemNumberSnapshot: "PRESERVED-1",
          normalizedItemNumberSnapshot: `${prefix}-preserved-1`,
          descriptionSnapshot: "Historic preserved item",
          unitOfMeasureSnapshot: "Each",
        },
      });
      await client.supplyRequestReferenceCounter.create({
        data: { referenceYear: counterYear, lastSequence: 1 },
      });
      await client.supplyRequest.update({
        where: { id: root.id },
        data: { currentVersionId: version.id },
      });

      await client.supplyRequest.delete({ where: { id: root.id } });

      expect(
        await client.supplyRequestVersion.count({
          where: { supplyRequestId: root.id },
        }),
      ).toBe(0);
      expect(
        await client.supplyRequestVersionItem.count({
          where: { versionId: version.id },
        }),
      ).toBe(0);
      await expect(
        client.supplyRequestReferenceCounter.findUniqueOrThrow({
          where: { referenceYear: counterYear },
        }),
      ).resolves.toMatchObject({ lastSequence: 1 });
      await expect(
        client.supplyItem.findUniqueOrThrow({ where: { id: item.id } }),
      ).resolves.toBeTruthy();
      await expect(
        client.supplyRequestSupervisor.findUniqueOrThrow({
          where: { id: supervisor.id },
        }),
      ).resolves.toBeTruthy();
      await expect(
        client.equipment.findUniqueOrThrow({ where: { id: equipment.id } }),
      ).resolves.toBeTruthy();
    } finally {
      await client.supplyRequest.updateMany({
        where: { id: { startsWith: prefix } },
        data: { currentVersionId: null },
      });
      await client.supplyRequest.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.supplyItem.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.supplyRequestSupervisor.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.equipment.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.mine.deleteMany({ where: { id: { startsWith: prefix } } });
      await client.city.deleteMany({ where: { id: { startsWith: prefix } } });
      await client.supplyRequestReferenceCounter.deleteMany({
        where: { referenceYear: counterYear },
      });
      await client.$disconnect();
    }
  });

  it("round-trips date-only and local wall-clock values without timezone conversion", async () => {
    const client = new PrismaClient({ datasourceUrl: databaseUrl });
    const prefix = uniquePrefix("wall-clock");
    try {
      const supervisor = await createSupervisor(client, prefix);
      const root = await createRoot(client, prefix, 1, 4801);
      const version = await client.supplyRequestVersion.create({
        data: {
          ...versionData(prefix, root.id, supervisor.id),
          operationalWorkDate: new Date("2026-07-28T00:00:00.000Z"),
          submittedLocalDate: new Date("2026-07-29T00:00:00.000Z"),
          submittedLocalTime: "01:15",
          fulfillmentOperationalWorkDate: null,
          fulfilledLocalDate: null,
          fulfilledLocalTime: null,
          cancelledLocalDate: null,
          cancelledLocalTime: null,
          correctionLocalDate: null,
          correctionLocalTime: null,
        },
      });

      const raw = await client.$queryRaw<
        Array<{
          operationalWorkDate: string;
          submittedLocalDate: string;
          submittedLocalTime: string;
          fulfilledLocalDate: string | null;
          fulfilledLocalTime: string | null;
          cancelledLocalDate: string | null;
          cancelledLocalTime: string | null;
          correctionLocalDate: string | null;
          correctionLocalTime: string | null;
        }>
      >(Prisma.sql`
        SELECT
          "operationalWorkDate"::text AS "operationalWorkDate",
          "submittedLocalDate"::text AS "submittedLocalDate",
          "submittedLocalTime",
          "fulfilledLocalDate"::text AS "fulfilledLocalDate",
          "fulfilledLocalTime",
          "cancelledLocalDate"::text AS "cancelledLocalDate",
          "cancelledLocalTime",
          "correctionLocalDate"::text AS "correctionLocalDate",
          "correctionLocalTime"
        FROM "SupplyRequestVersion"
        WHERE "id" = ${version.id}
      `);
      expect(raw[0]).toEqual({
        operationalWorkDate: "2026-07-28",
        submittedLocalDate: "2026-07-29",
        submittedLocalTime: "01:15",
        fulfilledLocalDate: null,
        fulfilledLocalTime: null,
        cancelledLocalDate: null,
        cancelledLocalTime: null,
        correctionLocalDate: null,
        correctionLocalTime: null,
      });
    } finally {
      await client.supplyRequest.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.supplyRequestSupervisor.deleteMany({
        where: { id: { startsWith: prefix } },
      });
      await client.$disconnect();
    }
  });
});
