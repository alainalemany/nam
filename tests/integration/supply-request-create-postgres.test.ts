import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSupplyRequestWithDependencies as createSupplyRequest } from "@/features/supply-requests/persistence-internal";
import type { CreateSupplyRequestInput } from "@/features/supply-requests/validation";

const expectedTestDatabaseName = "nam_supply_request_test";
const testPrefix = "supply-create-";
const reservedYears = Array.from({ length: 60 }, (_, index) => 6200 + index);

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
const client = databaseUrl
  ? new PrismaClient({ datasourceUrl: databaseUrl })
  : undefined;

let fixtureOrdinal = 0;

function uniquePrefix(label: string) {
  fixtureOrdinal += 1;
  return `${testPrefix}${label}-${Date.now().toString(36)}-${fixtureOrdinal}`;
}

async function cleanPhaseData() {
  if (!client) return;
  await client.supplyRequest.deleteMany({
    where: { referenceYear: { in: reservedYears } },
  });
  await client.supplyRequestReferenceCounter.deleteMany({
    where: { referenceYear: { in: reservedYears } },
  });
  await client.supplyItem.deleteMany({
    where: { id: { startsWith: testPrefix } },
  });
  await client.supplyRequestSupervisor.deleteMany({
    where: { id: { startsWith: testPrefix } },
  });
  await client.equipment.deleteMany({
    where: { id: { startsWith: testPrefix } },
  });
  await client.mine.deleteMany({
    where: { id: { startsWith: testPrefix } },
  });
  await client.city.deleteMany({
    where: { id: { startsWith: testPrefix } },
  });
}

async function createReferences(label: string, itemCount = 2) {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  const prefix = uniquePrefix(label);
  const city = await client.city.create({
    data: {
      id: `${prefix}-city`,
      name: `${prefix} Gillette`,
      state: "WY",
    },
  });
  const mine = await client.mine.create({
    data: {
      id: `${prefix}-mine`,
      cityId: city.id,
      name: `${prefix} North Mine`,
    },
  });
  const equipment = await client.equipment.create({
    data: {
      id: `${prefix}-equipment`,
      mineId: mine.id,
      displayName: "Dragline 101133",
      equipmentNumber: "101133",
      category: "DRAGLINE",
    },
  });
  const supervisor = await client.supplyRequestSupervisor.create({
    data: {
      id: `${prefix}-supervisor`,
      fullName: "Pablo Gonzalez",
      email: "Pablo.Gonzalez@Example.com",
      normalizedEmail: `${prefix}@example.com`,
    },
  });
  const items = await Promise.all(
    Array.from({ length: itemCount }, (_, index) =>
      client.supplyItem.create({
        data: {
          id: `${prefix}-item-${index + 1}`,
          itemNumber: `SUP-${index + 1}`,
          normalizedItemNumber: `${prefix.toUpperCase()}-SUP-${index + 1}`,
          description: `Authoritative item ${index + 1}`,
          unitOfMeasure: index % 2 === 0 ? "Each" : "Case",
        },
      }),
    ),
  );
  return { prefix, city, mine, equipment, supervisor, items };
}

function validInput(
  year: number,
  references: Awaited<ReturnType<typeof createReferences>>,
  overrides: Partial<CreateSupplyRequestInput> = {},
): CreateSupplyRequestInput {
  return {
    operationalWorkDate: `${year}-07-28`,
    submittedLocalDate: `${year}-07-29`,
    submittedLocalTime: "01:15",
    equipmentId: references.equipment.id,
    supervisorId: references.supervisor.id,
    notes: "  Upcoming scheduled PM  ",
    corporateSubmissionConfirmed: true,
    items: references.items.slice(0, 2).map((item, index) => ({
      supplyItemId: item.id,
      quantity: index + 2,
    })),
    ...overrides,
  };
}

async function expectNoAggregateOrCounter(year: number) {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  expect(
    await client.supplyRequest.count({ where: { referenceYear: year } }),
  ).toBe(0);
  expect(
    await client.supplyRequestVersion.count({
      where: { supplyRequest: { referenceYear: year } },
    }),
  ).toBe(0);
  expect(
    await client.supplyRequestVersionItem.count({
      where: { version: { supplyRequest: { referenceYear: year } } },
    }),
  ).toBe(0);
  expect(
    await client.supplyRequestReferenceCounter.findUnique({
      where: { referenceYear: year },
    }),
  ).toBeNull();
}

describePostgres(
  "Supply Requests transactional initial-create PostgreSQL persistence",
  () => {
    beforeAll(async () => {
      await cleanPhaseData();
    });

    afterAll(async () => {
      await cleanPhaseData();
      await client?.$disconnect();
    });

    it("creates one complete initial aggregate and establishes its owned current version", async () => {
      if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
      const year = 6200;
      const references = await createReferences("complete");

      const result = await createSupplyRequest(validInput(year, references), {
        client,
      });
      const root = await client.supplyRequest.findUniqueOrThrow({
        where: { id: result.supplyRequestId },
        include: {
          versions: {
            include: { items: { orderBy: { sequence: "asc" } } },
          },
        },
      });

      expect(result).toEqual({
        supplyRequestId: root.id,
        namReference: `SR-${year}-0001`,
        currentVersionId: root.versions[0].id,
        versionNumber: 1,
        status: "REQUESTED",
      });
      expect(root).toMatchObject({
        namReference: `SR-${year}-0001`,
        referenceYear: year,
        referenceSequence: 1,
        currentVersionId: root.versions[0].id,
      });
      expect(root.versions).toHaveLength(1);
      expect(root.versions[0]).toMatchObject({
        versionNumber: 1,
        changeKind: "CREATED",
        status: "REQUESTED",
        operationalWorkDate: new Date(`${year}-07-28T00:00:00.000Z`),
        submittedLocalDate: new Date(`${year}-07-29T00:00:00.000Z`),
        submittedLocalTime: "01:15",
        equipmentId: references.equipment.id,
        equipmentDisplayNameSnapshot: "Dragline 101133",
        equipmentNumberSnapshot: "101133",
        equipmentCategorySnapshot: "DRAGLINE",
        mineNameSnapshot: references.mine.name,
        cityNameSnapshot: references.city.name,
        cityStateSnapshot: "WY",
        requesterDisplayNameSnapshot: "Alain Alemany",
        requesterEmployeeNumberSnapshot: "911601",
        supervisorId: references.supervisor.id,
        supervisorNameSnapshot: "Pablo Gonzalez",
        supervisorEmailSnapshot: "Pablo.Gonzalez@Example.com",
        notes: "Upcoming scheduled PM",
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
      });
      expect(root.versions[0].items).toMatchObject([
        {
          sequence: 1,
          supplyItemId: references.items[0].id,
          quantity: 2,
          itemNumberSnapshot: "SUP-1",
          normalizedItemNumberSnapshot:
            references.items[0].normalizedItemNumber,
          descriptionSnapshot: "Authoritative item 1",
          unitOfMeasureSnapshot: "Each",
        },
        {
          sequence: 2,
          supplyItemId: references.items[1].id,
          quantity: 3,
          itemNumberSnapshot: "SUP-2",
          normalizedItemNumberSnapshot:
            references.items[1].normalizedItemNumber,
          descriptionSnapshot: "Authoritative item 2",
          unitOfMeasureSnapshot: "Case",
        },
      ]);
    });

    it("uses only server-owned snapshots and rejects caller-owned aggregate fields", async () => {
      if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
      const rejectedYear = 6201;
      const acceptedYear = 6202;
      const references = await createReferences("server-snapshots");

      await expect(
        createSupplyRequest(
          {
            ...validInput(rejectedYear, references),
            namReference: "CALLER-REF",
            requesterDisplayNameSnapshot: "Caller",
            supervisorEmailSnapshot: "caller@example.com",
            status: "FULFILLED",
          } as CreateSupplyRequestInput,
          { client },
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expectNoAggregateOrCounter(rejectedYear);

      const result = await createSupplyRequest(
        validInput(acceptedYear, references),
        { client },
      );
      const version = await client.supplyRequestVersion.findUniqueOrThrow({
        where: { id: result.currentVersionId },
        include: { items: true },
      });
      expect(version).toMatchObject({
        requesterDisplayNameSnapshot: "Alain Alemany",
        requesterEmployeeNumberSnapshot: "911601",
        supervisorNameSnapshot: references.supervisor.fullName,
        supervisorEmailSnapshot: references.supervisor.email,
        status: "REQUESTED",
      });
      expect(version.items[0].itemNumberSnapshot).toBe(
        references.items[0].itemNumber,
      );
    });

    it("rejects missing or inactive authoritative references without allocating", async () => {
      if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
      const references = await createReferences("active-references");
      const cases: Array<{
        year: number;
        code: string;
        prepare?: () => Promise<void>;
        restore?: () => Promise<void>;
        input: () => CreateSupplyRequestInput;
      }> = [
        {
          year: 6203,
          code: "EQUIPMENT_NOT_FOUND",
          input: () =>
            validInput(6203, references, { equipmentId: "missing-equipment" }),
        },
        {
          year: 6204,
          code: "EQUIPMENT_INACTIVE",
          prepare: () =>
            client.equipment
              .update({
                where: { id: references.equipment.id },
                data: { status: "INACTIVE" },
              })
              .then(() => undefined),
          restore: () =>
            client.equipment
              .update({
                where: { id: references.equipment.id },
                data: { status: "ACTIVE" },
              })
              .then(() => undefined),
          input: () => validInput(6204, references),
        },
        {
          year: 6205,
          code: "SUPERVISOR_NOT_FOUND",
          input: () =>
            validInput(6205, references, { supervisorId: "missing-supervisor" }),
        },
        {
          year: 6206,
          code: "SUPERVISOR_INACTIVE",
          prepare: () =>
            client.supplyRequestSupervisor
              .update({
                where: { id: references.supervisor.id },
                data: { active: false },
              })
              .then(() => undefined),
          restore: () =>
            client.supplyRequestSupervisor
              .update({
                where: { id: references.supervisor.id },
                data: { active: true },
              })
              .then(() => undefined),
          input: () => validInput(6206, references),
        },
        {
          year: 6207,
          code: "SUPPLY_ITEM_NOT_FOUND",
          input: () =>
            validInput(6207, references, {
              items: [{ supplyItemId: "missing-item", quantity: 1 }],
            }),
        },
        {
          year: 6208,
          code: "SUPPLY_ITEM_INACTIVE",
          prepare: () =>
            client.supplyItem
              .update({
                where: { id: references.items[0].id },
                data: { active: false },
              })
              .then(() => undefined),
          restore: () =>
            client.supplyItem
              .update({
                where: { id: references.items[0].id },
                data: { active: true },
              })
              .then(() => undefined),
          input: () => validInput(6208, references),
        },
      ];

      for (const testCase of cases) {
        await testCase.prepare?.();
        try {
          await expect(
            createSupplyRequest(testCase.input(), { client }),
          ).rejects.toMatchObject({ code: testCase.code });
          await expectNoAggregateOrCounter(testCase.year);
        } finally {
          await testCase.restore?.();
        }
      }
    });

    it("rejects duplicate Supply Item input before persistence", async () => {
      if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
      const year = 6209;
      const references = await createReferences("duplicate-items");
      await expect(
        createSupplyRequest(
          validInput(year, references, {
            items: [
              { supplyItemId: references.items[0].id, quantity: 1 },
              { supplyItemId: references.items[0].id, quantity: 2 },
            ],
          }),
          { client },
        ),
      ).rejects.toMatchObject({ code: "DUPLICATE_ITEM_SELECTION" });
      await expectNoAggregateOrCounter(year);
    });

    it("rejects every bounded validation failure before persistence", async () => {
      if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
      const year = 6210;
      const references = await createReferences("validation", 51);
      const base = validInput(year, references);
      const { corporateSubmissionConfirmed: _confirmation, ...withoutConfirmation } =
        base;
      const invalidInputs: CreateSupplyRequestInput[] = [
        { ...base, corporateSubmissionConfirmed: false },
        withoutConfirmation as CreateSupplyRequestInput,
        { ...base, operationalWorkDate: `${year}-02-30` },
        { ...base, submittedLocalDate: `${year}-13-01` },
        { ...base, submittedLocalTime: "24:00" },
        { ...base, items: [] },
        {
          ...base,
          items: references.items.map((item) => ({
            supplyItemId: item.id,
            quantity: 1,
          })),
        },
        {
          ...base,
          items: [{ supplyItemId: references.items[0].id, quantity: 1.5 }],
        },
        {
          ...base,
          items: [{ supplyItemId: references.items[0].id, quantity: 0 }],
        },
        {
          ...base,
          items: [{ supplyItemId: references.items[0].id, quantity: -1 }],
        },
        {
          ...base,
          items: [{ supplyItemId: references.items[0].id, quantity: 1_000_000 }],
        },
        { ...base, notes: "x".repeat(2_001) },
      ];

      for (const input of invalidInputs) {
        await expect(
          createSupplyRequest(input, { client }),
        ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      }
      await expectNoAggregateOrCounter(year);
    });

    it("rolls back an allocated sequence and every partial row after a later constraint failure", async () => {
      if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
      const year = 6211;
      const references = await createReferences("rollback");
      const conflictId = `${references.prefix}-conflicting-root`;
      await client.supplyRequestReferenceCounter.create({
        data: { referenceYear: year, lastSequence: 1 },
      });
      await client.supplyRequest.create({
        data: {
          id: conflictId,
          namReference: `SR-${year}-0002`,
          referenceYear: year,
          referenceSequence: 2,
        },
      });

      await expect(
        createSupplyRequest(validInput(year, references), { client }),
      ).rejects.toMatchObject({ code: "RETRY_EXHAUSTED" });
      expect(
        await client.supplyRequestReferenceCounter.findUniqueOrThrow({
          where: { referenceYear: year },
        }),
      ).toMatchObject({ lastSequence: 1 });
      expect(
        await client.supplyRequest.count({ where: { referenceYear: year } }),
      ).toBe(1);
      expect(
        await client.supplyRequestVersion.count({
          where: { supplyRequest: { referenceYear: year } },
        }),
      ).toBe(0);
      expect(
        await client.supplyRequestVersionItem.count({
          where: { version: { supplyRequest: { referenceYear: year } } },
        }),
      ).toBe(0);

      await client.supplyRequest.delete({ where: { id: conflictId } });
      const result = await createSupplyRequest(validInput(year, references), {
        client,
      });
      expect(result.namReference).toBe(`SR-${year}-0002`);
      expect(
        await client.supplyRequestReferenceCounter.findUniqueOrThrow({
          where: { referenceYear: year },
        }),
      ).toMatchObject({ lastSequence: 2 });
    });

    it("creates twelve complete same-year aggregates concurrently without duplicates or partial state", async () => {
      if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
      const year = 6212;
      const references = await createReferences("same-year");
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          createSupplyRequest(
            validInput(year, references, { notes: `Concurrent ${index + 1}` }),
            { client },
          ),
        ),
      );

      expect(new Set(results.map((result) => result.supplyRequestId)).size).toBe(
        12,
      );
      expect(new Set(results.map((result) => result.namReference)).size).toBe(
        12,
      );
      expect(
        results
          .map((result) => Number(result.namReference.split("-")[2]))
          .sort((a, b) => a - b),
      ).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));

      const roots = await client.supplyRequest.findMany({
        where: { referenceYear: year },
        include: { versions: { include: { items: true } } },
      });
      expect(roots).toHaveLength(12);
      for (const root of roots) {
        expect(root.currentVersionId).not.toBeNull();
        expect(root.versions).toHaveLength(1);
        expect(root.versions[0]).toMatchObject({
          id: root.currentVersionId,
          supplyRequestId: root.id,
          versionNumber: 1,
          status: "REQUESTED",
        });
        expect(root.versions[0].items).toHaveLength(2);
      }
      expect(
        await client.supplyRequestReferenceCounter.findUniqueOrThrow({
          where: { referenceYear: year },
        }),
      ).toMatchObject({ lastSequence: 12 });
      expect(
        await client.supplyRequest.count({
          where: { referenceYear: year, currentVersionId: null },
        }),
      ).toBe(0);
    });

    it("allocates concurrent creates independently for different submission years", async () => {
      if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
      const years = [6213, 6214];
      const references = await createReferences("different-years");
      const results = await Promise.all(
        years.flatMap((year) =>
          Array.from({ length: 6 }, () =>
            createSupplyRequest(validInput(year, references), { client }),
          ),
        ),
      );

      for (const year of years) {
        const yearResults = results.filter((result) =>
          result.namReference.startsWith(`SR-${year}-`),
        );
        expect(
          yearResults
            .map((result) => Number(result.namReference.split("-")[2]))
            .sort((a, b) => a - b),
        ).toEqual([1, 2, 3, 4, 5, 6]);
        expect(
          await client.supplyRequestReferenceCounter.findUniqueOrThrow({
            where: { referenceYear: year },
          }),
        ).toMatchObject({ lastSequence: 6 });
      }
    });

    it("uses submitted local year rather than overnight operational work date", async () => {
      if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
      const referenceYear = 6216;
      const references = await createReferences("overnight");
      const result = await createSupplyRequest(
        validInput(referenceYear, references, {
          operationalWorkDate: "6215-12-31",
          submittedLocalDate: "6216-01-01",
          submittedLocalTime: "01:00",
        }),
        { client },
      );
      const root = await client.supplyRequest.findUniqueOrThrow({
        where: { id: result.supplyRequestId },
        include: { currentVersion: true },
      });
      expect(root).toMatchObject({
        referenceYear,
        referenceSequence: 1,
        namReference: "SR-6216-0001",
      });
      expect(root.currentVersion?.operationalWorkDate).toEqual(
        new Date("6215-12-31T00:00:00.000Z"),
      );
      expect(root.currentVersion?.submittedLocalDate).toEqual(
        new Date("6216-01-01T00:00:00.000Z"),
      );
    });

    it("preserves version-one snapshots after current reference edits and retirement", async () => {
      if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
      const year = 6217;
      const references = await createReferences("snapshot-stability");
      const result = await createSupplyRequest(validInput(year, references), {
        client,
      });

      await client.equipment.update({
        where: { id: references.equipment.id },
        data: {
          displayName: "Renamed Equipment",
          equipmentNumber: "NEW-9",
          category: "WORK_TRUCK",
          status: "INACTIVE",
        },
      });
      await client.mine.update({
        where: { id: references.mine.id },
        data: { name: "Renamed Mine" },
      });
      await client.city.update({
        where: { id: references.city.id },
        data: { name: "Renamed City", state: "CO" },
      });
      await client.supplyRequestSupervisor.update({
        where: { id: references.supervisor.id },
        data: {
          fullName: "Renamed Supervisor",
          email: "renamed@example.com",
          normalizedEmail: `${references.prefix}-renamed@example.com`,
          active: false,
        },
      });
      await client.supplyItem.update({
        where: { id: references.items[0].id },
        data: {
          itemNumber: "RENAMED-1",
          normalizedItemNumber: `${references.prefix.toUpperCase()}-RENAMED-1`,
          description: "Renamed description",
          unitOfMeasure: "Pallet",
          active: false,
        },
      });

      const version = await client.supplyRequestVersion.findUniqueOrThrow({
        where: { id: result.currentVersionId },
        include: { items: { orderBy: { sequence: "asc" } } },
      });
      expect(version).toMatchObject({
        equipmentDisplayNameSnapshot: "Dragline 101133",
        equipmentNumberSnapshot: "101133",
        equipmentCategorySnapshot: "DRAGLINE",
        mineNameSnapshot: references.mine.name,
        cityNameSnapshot: references.city.name,
        cityStateSnapshot: "WY",
        supervisorNameSnapshot: "Pablo Gonzalez",
        supervisorEmailSnapshot: "Pablo.Gonzalez@Example.com",
      });
      expect(version.items[0]).toMatchObject({
        itemNumberSnapshot: "SUP-1",
        normalizedItemNumberSnapshot:
          references.items[0].normalizedItemNumber,
        descriptionSnapshot: "Authoritative item 1",
        unitOfMeasureSnapshot: "Each",
      });
    });

    it("returns only the committed stable identity and current-version facts", async () => {
      if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
      const year = 6218;
      const references = await createReferences("return-value");
      const result = await createSupplyRequest(validInput(year, references), {
        client,
      });

      expect(Object.keys(result).sort()).toEqual([
        "currentVersionId",
        "namReference",
        "status",
        "supplyRequestId",
        "versionNumber",
      ]);
      const root = await client.supplyRequest.findUniqueOrThrow({
        where: { id: result.supplyRequestId },
      });
      expect(root.currentVersionId).toBe(result.currentVersionId);
      expect(root.namReference).toBe(result.namReference);
      expect(
        await client.supplyRequestVersion.count({
          where: {
            id: result.currentVersionId,
            supplyRequestId: result.supplyRequestId,
            versionNumber: 1,
            status: "REQUESTED",
          },
        }),
      ).toBe(1);
    });
  },
);
