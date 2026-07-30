import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { SupplyRequestLifecycleError } from "@/features/supply-requests/lifecycle-errors";
import {
  cancelSupplyRequestWithDependencies,
  fulfillSupplyRequestWithDependencies,
} from "@/features/supply-requests/lifecycle-persistence-internal";
import { createSupplyRequestWithDependencies } from "@/features/supply-requests/persistence-internal";
import {
  getCurrentSupplyRequestDetailWithClient,
  getOriginalSupplyRequestDetailWithClient,
} from "@/features/supply-requests/surface-data-internal";

const expectedTestDatabaseName = "nam_supply_request_test";
const testPrefix = "supply-lifecycle-";
const normalizedTestPrefix = testPrefix.toUpperCase();
const reservedYears = Array.from({ length: 30 }, (_, index) => 6750 + index);

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
      `Supply Request lifecycle tests require the disposable ${expectedTestDatabaseName} database.`,
    );
  }
  return value;
}

const databaseUrl = guardedDatabaseUrl();
const describePostgres = databaseUrl ? describe : describe.skip;
const client = databaseUrl
  ? new PrismaClient({ datasourceUrl: databaseUrl })
  : undefined;

let ordinal = 0;
function uniqueLabel(label: string) {
  ordinal += 1;
  return `${testPrefix}${label}-${Date.now().toString(36)}-${ordinal}`;
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
    where: { normalizedItemNumber: { startsWith: normalizedTestPrefix } },
  });
  await client.supplyRequestSupervisor.deleteMany({
    where: { normalizedEmail: { startsWith: testPrefix } },
  });
  await client.equipment.deleteMany({
    where: { id: { startsWith: testPrefix } },
  });
  await client.mine.deleteMany({ where: { id: { startsWith: testPrefix } } });
  await client.city.deleteMany({ where: { id: { startsWith: testPrefix } } });
}

async function fixture(label: string, itemCount = 2) {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  const prefix = uniqueLabel(label);
  const city = await client.city.create({
    data: { id: `${prefix}-city`, name: `${prefix} City`, state: "WY" },
  });
  const mine = await client.mine.create({
    data: { id: `${prefix}-mine`, cityId: city.id, name: `${prefix} Mine` },
  });
  const equipment = await client.equipment.create({
    data: {
      id: `${prefix}-equipment`,
      mineId: mine.id,
      displayName: `${prefix} Dragline`,
      equipmentNumber: "101",
      category: "DRAGLINE",
    },
  });
  const supervisor = await client.supplyRequestSupervisor.create({
    data: {
      id: `${prefix}-supervisor`,
      fullName: `${prefix} Supervisor`,
      email: `${prefix}@Example.com`,
      normalizedEmail: `${prefix}@example.com`,
    },
  });
  const items = await Promise.all(
    Array.from({ length: itemCount }, (_, index) =>
      client.supplyItem.create({
        data: {
          id: `${prefix}-item-${index}`,
          itemNumber: `${prefix} Item ${index}`,
          normalizedItemNumber: `${prefix.toUpperCase()} ITEM ${index}`,
          description: `Description ${index}`,
          unitOfMeasure: index === 0 ? "Each" : "Case",
        },
      }),
    ),
  );
  return { prefix, city, mine, equipment, supervisor, items };
}

async function requested(
  year: number,
  references: Awaited<ReturnType<typeof fixture>>,
) {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  return createSupplyRequestWithDependencies(
    {
      operationalWorkDate: `${year}-01-01`,
      submittedLocalDate: `${year}-01-02`,
      submittedLocalTime: "09:15",
      equipmentId: references.equipment.id,
      supervisorId: references.supervisor.id,
      notes: "Original Notes",
      corporateSubmissionConfirmed: true,
      items: references.items.map((item, index) => ({
        supplyItemId: item.id,
        quantity: index + 2,
      })),
    },
    { client },
  );
}

function nowFor(year: number, hour = "15:30") {
  return () => new Date(`${year}-01-02T${hour}:00.000Z`);
}

async function versions(supplyRequestId: string) {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  return client.supplyRequestVersion.findMany({
    where: { supplyRequestId },
    include: { items: { orderBy: { sequence: "asc" } } },
    orderBy: { versionNumber: "asc" },
  });
}

function parentSnapshots(record: Awaited<ReturnType<typeof versions>>[number]) {
  return {
    operationalWorkDate: record.operationalWorkDate,
    submittedLocalDate: record.submittedLocalDate,
    submittedLocalTime: record.submittedLocalTime,
    equipmentId: record.equipmentId,
    equipmentDisplayNameSnapshot: record.equipmentDisplayNameSnapshot,
    equipmentNumberSnapshot: record.equipmentNumberSnapshot,
    equipmentCategorySnapshot: record.equipmentCategorySnapshot,
    mineNameSnapshot: record.mineNameSnapshot,
    cityNameSnapshot: record.cityNameSnapshot,
    cityStateSnapshot: record.cityStateSnapshot,
    requesterDisplayNameSnapshot: record.requesterDisplayNameSnapshot,
    requesterEmployeeNumberSnapshot: record.requesterEmployeeNumberSnapshot,
    supervisorId: record.supervisorId,
    supervisorNameSnapshot: record.supervisorNameSnapshot,
    supervisorEmailSnapshot: record.supervisorEmailSnapshot,
    notes: record.notes,
  };
}

function lineSnapshots(record: Awaited<ReturnType<typeof versions>>[number]) {
  return record.items.map((line) => ({
    supplyItemId: line.supplyItemId,
    sequence: line.sequence,
    quantity: line.quantity,
    itemNumberSnapshot: line.itemNumberSnapshot,
    normalizedItemNumberSnapshot: line.normalizedItemNumberSnapshot,
    descriptionSnapshot: line.descriptionSnapshot,
    unitOfMeasureSnapshot: line.unitOfMeasureSnapshot,
  }));
}

async function aggregateShape(supplyRequestId: string) {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  const root = await client.supplyRequest.findUniqueOrThrow({
    where: { id: supplyRequestId },
  });
  return {
    currentVersionId: root.currentVersionId,
    versionCount: await client.supplyRequestVersion.count({
      where: { supplyRequestId },
    }),
    lineCount: await client.supplyRequestVersionItem.count({
      where: { version: { supplyRequestId } },
    }),
    counter: await client.supplyRequestReferenceCounter.findUniqueOrThrow({
      where: { referenceYear: root.referenceYear },
    }),
  };
}

describePostgres("Supply Request lifecycle PostgreSQL behavior", () => {
  beforeAll(cleanPhaseData);
  afterAll(async () => {
    await cleanPhaseData();
    await client?.$disconnect();
  });

  it("appends one complete immutable Fulfilled version and advances the owned pointer", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const refs = await fixture("fulfill");
    const created = await requested(6750, refs);
    const before = await versions(created.supplyRequestId);
    const counterBefore = await client.supplyRequestReferenceCounter.findUniqueOrThrow({
      where: { referenceYear: 6750 },
    });
    const result = await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "6750-01-03",
        fulfillmentNote: "  Received completely.  ",
      },
      { client, now: nowFor(6750) },
    );
    const root = await client.supplyRequest.findUniqueOrThrow({
      where: { id: created.supplyRequestId },
    });
    const after = await versions(created.supplyRequestId);
    const counterAfter = await client.supplyRequestReferenceCounter.findUniqueOrThrow({
      where: { referenceYear: 6750 },
    });

    expect(root).toMatchObject({
      namReference: created.namReference,
      currentVersionId: result.currentVersionId,
    });
    expect(after).toHaveLength(2);
    expect(after[0]).toEqual(before[0]);
    expect(after[1]).toMatchObject({
      versionNumber: 2,
      changeKind: "FULFILLED",
      status: "FULFILLED",
      fulfillmentOperationalWorkDate: new Date("6750-01-03T00:00:00.000Z"),
      fulfilledLocalDate: new Date("6750-01-02T00:00:00.000Z"),
      fulfilledLocalTime: "10:30",
      fulfillmentNote: "Received completely.",
      cancelledLocalDate: null,
      cancelledLocalTime: null,
      cancellationReason: null,
      correctionReason: null,
      correctedByDisplayNameSnapshot: null,
      correctionLocalDate: null,
      correctionLocalTime: null,
    });
    expect(parentSnapshots(after[1])).toEqual(parentSnapshots(after[0]));
    expect(lineSnapshots(after[1])).toEqual(lineSnapshots(after[0]));
    expect(after[1].items.map((line) => line.id)).not.toEqual(
      after[0].items.map((line) => line.id),
    );
    expect(counterAfter.lastSequence).toBe(counterBefore.lastSequence);
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, created.supplyRequestId),
    ).resolves.toMatchObject({ status: "FULFILLED", versionNumber: 2 });
    await expect(
      getOriginalSupplyRequestDetailWithClient(
        client,
        created.supplyRequestId,
        "1",
      ),
    ).resolves.toMatchObject({ status: "REQUESTED", versionNumber: 1 });
  });

  it("appends one complete immutable Cancelled version with no fulfillment facts", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const refs = await fixture("cancel");
    const created = await requested(6751, refs);
    const before = await versions(created.supplyRequestId);
    const rootBefore = await client.supplyRequest.findUniqueOrThrow({
      where: { id: created.supplyRequestId },
    });
    const counterBefore = await client.supplyRequestReferenceCounter.findUniqueOrThrow({
      where: { referenceYear: 6751 },
    });
    await cancelSupplyRequestWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        cancellationReason: "  No longer needed.  ",
      },
      { client, now: nowFor(6751) },
    );
    const after = await versions(created.supplyRequestId);
    const rootAfter = await client.supplyRequest.findUniqueOrThrow({
      where: { id: created.supplyRequestId },
    });
    const counterAfter = await client.supplyRequestReferenceCounter.findUniqueOrThrow({
      where: { referenceYear: 6751 },
    });
    expect(after).toHaveLength(2);
    expect(after[0]).toEqual(before[0]);
    expect(rootAfter.namReference).toBe(rootBefore.namReference);
    expect(rootAfter.currentVersionId).toBe(after[1].id);
    expect(counterAfter.lastSequence).toBe(counterBefore.lastSequence);
    expect(after[1]).toMatchObject({
      versionNumber: 2,
      changeKind: "CANCELLED",
      status: "CANCELLED",
      cancelledLocalDate: new Date("6751-01-02T00:00:00.000Z"),
      cancelledLocalTime: "10:30",
      cancellationReason: "No longer needed.",
      fulfillmentOperationalWorkDate: null,
      fulfilledLocalDate: null,
      fulfilledLocalTime: null,
      fulfillmentNote: null,
      correctionReason: null,
      correctedByDisplayNameSnapshot: null,
      correctionLocalDate: null,
      correctionLocalTime: null,
    });
    expect(parentSnapshots(after[1])).toEqual(parentSnapshots(after[0]));
    expect(lineSnapshots(after[1])).toEqual(lineSnapshots(after[0]));
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, created.supplyRequestId),
    ).resolves.toMatchObject({ status: "CANCELLED", versionNumber: 2 });
  });

  it("rejects fulfillment and cancellation validation without versions, lines, pointers, or counters changing", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const refs = await fixture("validation");
    const created = await requested(6752, refs);
    const baseline = await aggregateShape(created.supplyRequestId);
    const invalidOperations = [
      () =>
        fulfillSupplyRequestWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            expectedCurrentVersionNumber: 1,
            fulfillmentOperationalWorkDate: "6751-12-31",
          },
          { client, now: nowFor(6752) },
        ),
      () =>
        fulfillSupplyRequestWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            expectedCurrentVersionNumber: 1,
            fulfillmentOperationalWorkDate: "6752-02-30",
          },
          { client, now: nowFor(6752) },
        ),
      () =>
        fulfillSupplyRequestWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            expectedCurrentVersionNumber: 1,
            fulfillmentOperationalWorkDate: "6752-01-01",
          },
          { client, now: nowFor(6752, "13:00") },
        ),
      () =>
        fulfillSupplyRequestWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            expectedCurrentVersionNumber: 0,
            fulfillmentOperationalWorkDate: "6752-01-01",
          },
          { client, now: nowFor(6752) },
        ),
      () =>
        fulfillSupplyRequestWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            expectedCurrentVersionNumber: 1,
            fulfillmentOperationalWorkDate: "6752-01-01",
            fulfillmentNote: "x".repeat(1001),
          },
          { client, now: nowFor(6752) },
        ),
      () =>
        cancelSupplyRequestWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            expectedCurrentVersionNumber: 1,
            cancellationReason: "x".repeat(1001),
          },
          { client, now: nowFor(6752) },
        ),
      () =>
        cancelSupplyRequestWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            expectedCurrentVersionNumber: 1,
          },
          { client, now: nowFor(6752, "13:00") },
        ),
    ];
    for (const operation of invalidOperations) {
      await expect(operation()).rejects.toBeInstanceOf(
        SupplyRequestLifecycleError,
      );
      expect(await aggregateShape(created.supplyRequestId)).toEqual(baseline);
    }
  });

  it("serializes concurrent fulfillment and concurrent cancellation to one winner each", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    for (const [year, kind] of [
      [6753, "fulfill"],
      [6754, "cancel"],
    ] as const) {
      const refs = await fixture(`concurrent-${kind}`);
      const created = await requested(year, refs);
      const operation =
        kind === "fulfill"
          ? () =>
              fulfillSupplyRequestWithDependencies(
                {
                  supplyRequestId: created.supplyRequestId,
                  expectedCurrentVersionNumber: 1,
                  fulfillmentOperationalWorkDate: `${year}-01-02`,
                },
                { client, now: nowFor(year) },
              )
          : () =>
              cancelSupplyRequestWithDependencies(
                {
                  supplyRequestId: created.supplyRequestId,
                  expectedCurrentVersionNumber: 1,
                },
                { client, now: nowFor(year) },
              );
      const outcomes = await Promise.allSettled([operation(), operation()]);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      const loser = outcomes.find((outcome) => outcome.status === "rejected");
      expect((loser as PromiseRejectedResult).reason).toMatchObject({
        code: "STALE_VERSION",
      });
      const records = await versions(created.supplyRequestId);
      expect(records.map((record) => record.versionNumber)).toEqual([1, 2]);
      expect(records[1].items).toHaveLength(refs.items.length);
      const root = await client.supplyRequest.findUniqueOrThrow({
        where: { id: created.supplyRequestId },
      });
      expect(root.currentVersionId).toBe(records[1].id);
    }
  });

  it("allows exactly one winner in a fulfillment-versus-cancellation race", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const refs = await fixture("mixed-race");
    const created = await requested(6755, refs);
    const outcomes = await Promise.allSettled([
      fulfillSupplyRequestWithDependencies(
        {
          supplyRequestId: created.supplyRequestId,
          expectedCurrentVersionNumber: 1,
          fulfillmentOperationalWorkDate: "6755-01-02",
        },
        { client, now: nowFor(6755) },
      ),
      cancelSupplyRequestWithDependencies(
        {
          supplyRequestId: created.supplyRequestId,
          expectedCurrentVersionNumber: 1,
        },
        { client, now: nowFor(6755) },
      ),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect((outcomes.find((outcome) => outcome.status === "rejected") as PromiseRejectedResult).reason)
      .toMatchObject({ code: "STALE_VERSION" });
    const records = await versions(created.supplyRequestId);
    expect(records).toHaveLength(2);
    expect(records[1].status).toMatch(/FULFILLED|CANCELLED/);
    expect(await client.supplyRequestVersion.count({
      where: { supplyRequestId: created.supplyRequestId, versionNumber: 3 },
    })).toBe(0);
  });

  it("rejects explicit stale and all terminal-state transitions without appending history", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    for (const [year, terminal] of [
      [6756, "FULFILLED"],
      [6757, "CANCELLED"],
    ] as const) {
      const refs = await fixture(`terminal-${terminal}`);
      const created = await requested(year, refs);
      if (terminal === "FULFILLED") {
        await fulfillSupplyRequestWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            expectedCurrentVersionNumber: 1,
            fulfillmentOperationalWorkDate: `${year}-01-02`,
          },
          { client, now: nowFor(year) },
        );
      } else {
        await cancelSupplyRequestWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            expectedCurrentVersionNumber: 1,
          },
          { client, now: nowFor(year) },
        );
      }
      const stale = () =>
        cancelSupplyRequestWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            expectedCurrentVersionNumber: 1,
          },
          { client, now: nowFor(year) },
        );
      await expect(stale()).rejects.toMatchObject({ code: "STALE_VERSION" });

      const actions = [
        () =>
          fulfillSupplyRequestWithDependencies(
            {
              supplyRequestId: created.supplyRequestId,
              expectedCurrentVersionNumber: 2,
              fulfillmentOperationalWorkDate: `${year}-01-02`,
            },
            { client, now: nowFor(year) },
          ),
        () =>
          cancelSupplyRequestWithDependencies(
            {
              supplyRequestId: created.supplyRequestId,
              expectedCurrentVersionNumber: 2,
            },
            { client, now: nowFor(year) },
          ),
      ];
      for (const action of actions) {
        await expect(action()).rejects.toMatchObject({
          code: "INVALID_TRANSITION",
        });
      }
      expect(await versions(created.supplyRequestId)).toHaveLength(2);
    }
  });

  it("transitions with inactive and edited live references while preserving historical snapshots", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const refs = await fixture("inactive");
    const created = await requested(6758, refs);
    const original = (await versions(created.supplyRequestId))[0];
    await client.equipment.update({
      where: { id: refs.equipment.id },
      data: { status: "INACTIVE", displayName: "Changed Equipment" },
    });
    await client.supplyRequestSupervisor.update({
      where: { id: refs.supervisor.id },
      data: { active: false, fullName: "Changed Supervisor" },
    });
    await client.supplyItem.updateMany({
      where: { id: { in: refs.items.map((item) => item.id) } },
      data: { active: false, description: "Changed Description" },
    });
    await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "6758-01-02",
      },
      { client, now: nowFor(6758) },
    );
    const terminal = (await versions(created.supplyRequestId))[1];
    expect(parentSnapshots(terminal)).toEqual(parentSnapshots(original));
    expect(lineSnapshots(terminal)).toEqual(lineSnapshots(original));
    expect(terminal.equipmentDisplayNameSnapshot).not.toBe("Changed Equipment");
    expect(terminal.supervisorNameSnapshot).not.toBe("Changed Supervisor");
    expect(terminal.items[0].descriptionSnapshot).not.toBe("Changed Description");
  });

  it("transitions after Equipment SetNull and keeps Equipment and location snapshots readable", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const refs = await fixture("set-null");
    const created = await requested(6759, refs);
    await client.equipment.delete({ where: { id: refs.equipment.id } });
    const originalBefore = (await versions(created.supplyRequestId))[0];
    expect(originalBefore.equipmentId).toBeNull();
    await cancelSupplyRequestWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        expectedCurrentVersionNumber: 1,
      },
      { client, now: nowFor(6759) },
    );
    const records = await versions(created.supplyRequestId);
    expect(records[1].equipmentId).toBeNull();
    expect(parentSnapshots(records[1])).toEqual(parentSnapshots(records[0]));
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, created.supplyRequestId),
    ).resolves.toMatchObject({
      status: "CANCELLED",
      equipmentAvailable: false,
      equipmentLabel: expect.stringContaining(refs.prefix),
      mineName: refs.mine.name,
      cityName: refs.city.name,
    });
    await expect(
      getOriginalSupplyRequestDetailWithClient(
        client,
        created.supplyRequestId,
        "1",
      ),
    ).resolves.toMatchObject({ equipmentAvailable: false, status: "REQUESTED" });
  });

  it("rolls back a real line constraint failure after version creation and reuses version 2", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const refs = await fixture("rollback", 2);
    const created = await requested(6760, refs);
    const ids = ["rollback-version", "duplicate-line", "duplicate-line"];
    await expect(
      fulfillSupplyRequestWithDependencies(
        {
          supplyRequestId: created.supplyRequestId,
          expectedCurrentVersionNumber: 1,
          fulfillmentOperationalWorkDate: "6760-01-02",
        },
        {
          client,
          now: nowFor(6760),
          generateId: () => ids.shift() ?? "unexpected",
        },
      ),
    ).rejects.toMatchObject({ code: "UNEXPECTED_PERSISTENCE" });
    const rolledBack = await aggregateShape(created.supplyRequestId);
    expect(rolledBack).toMatchObject({
      currentVersionId: created.currentVersionId,
      versionCount: 1,
      lineCount: 2,
    });
    const success = await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "6760-01-02",
      },
      { client, now: nowFor(6760) },
    );
    expect(success.newVersionNumber).toBe(2);
    expect((await versions(created.supplyRequestId))).toHaveLength(2);
  });

  it("retries a complete rolled-back transaction with a stable timestamp and fresh IDs", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const refs = await fixture("retry");
    const created = await requested(6761, refs);
    let transactionAttempt = 0;
    const attemptedVersionIds: string[] = [];
    const wrapped = {
      $transaction: async (
        operation: (transaction: unknown) => Promise<unknown>,
        options: unknown,
      ) => {
        transactionAttempt += 1;
        if (transactionAttempt === 1) {
          return client.$transaction(async (transaction) => {
            const proxy = {
              ...transaction,
              $queryRaw: transaction.$queryRaw.bind(transaction),
              supplyRequest: transaction.supplyRequest,
              supplyRequestVersion: {
                create: async (args: Parameters<typeof transaction.supplyRequestVersion.create>[0]) => {
                  const record = await transaction.supplyRequestVersion.create(args);
                  attemptedVersionIds.push(record.id);
                  throw { code: "P2034" };
                },
              },
            };
            return operation(proxy);
          }, options as never);
        }
        return client.$transaction(operation as never, options as never);
      },
    } as unknown as PrismaClient;
    const now = vi.fn(nowFor(6761));
    let idOrdinal = 0;
    const result = await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "6761-01-02",
      },
      {
        client: wrapped,
        now,
        generateId: () => `supply-lifecycle-retry-id-${++idOrdinal}`,
      },
    );
    expect(transactionAttempt).toBe(2);
    expect(now).toHaveBeenCalledOnce();
    expect(attemptedVersionIds).toHaveLength(1);
    expect(attemptedVersionIds[0]).not.toBe(result.currentVersionId);
    const records = await versions(created.supplyRequestId);
    expect(records).toHaveLength(2);
    expect(records[1].fulfilledLocalTime).toBe("10:30");
  });

  it("keeps current-pointer authority over a higher decoy version and creates no later-slice records", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const refs = await fixture("pointer");
    const created = await requested(6762, refs);
    const dailyLogsBefore = await client.dailyLog.count();
    const activitiesBefore = await client.dailyLogActivity.count();
    const original = (await versions(created.supplyRequestId))[0];
    await client.supplyRequestVersion.create({
      data: {
        ...parentSnapshots(original),
        id: `${refs.prefix}-decoy-version`,
        supplyRequestId: created.supplyRequestId,
        versionNumber: 99,
        changeKind: "CREATED",
        status: "REQUESTED",
        items: {
          create: lineSnapshots(original).map((line, index) => ({
            ...line,
            id: `${refs.prefix}-decoy-line-${index}`,
          })),
        },
      },
    });
    await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "6762-01-02",
      },
      { client, now: nowFor(6762) },
    );
    const records = await versions(created.supplyRequestId);
    const current = records[1];
    expect(records.map((record) => record.versionNumber)).toEqual([1, 2, 99]);
    expect(parentSnapshots(current)).toEqual(parentSnapshots(original));
    expect(lineSnapshots(current)).toEqual(lineSnapshots(original));
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, created.supplyRequestId),
    ).resolves.toMatchObject({ versionId: current.id, versionNumber: 2 });
    await expect(
      getOriginalSupplyRequestDetailWithClient(
        client,
        created.supplyRequestId,
        "1",
      ),
    ).resolves.toMatchObject({ versionNumber: 1, status: "REQUESTED" });
    await client.supplyRequest.update({
      where: { id: created.supplyRequestId },
      data: { currentVersionId: null },
    });
    await expect(
      fulfillSupplyRequestWithDependencies(
        {
          supplyRequestId: created.supplyRequestId,
          expectedCurrentVersionNumber: 2,
          fulfillmentOperationalWorkDate: "6762-01-02",
        },
        { client, now: nowFor(6762) },
      ),
    ).rejects.toMatchObject({ code: "CURRENT_VERSION_INVALID" });
    await client.supplyRequest.update({
      where: { id: created.supplyRequestId },
      data: { currentVersionId: current.id },
    });

    const otherRefs = await fixture("wrong-owner");
    const other = await requested(6763, otherRefs);
    await expect(
      client.supplyRequest.update({
        where: { id: created.supplyRequestId },
        data: { currentVersionId: other.currentVersionId },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      client.supplyRequest.findUniqueOrThrow({
        where: { id: created.supplyRequestId },
        select: { currentVersionId: true },
      }),
    ).resolves.toEqual({ currentVersionId: current.id });
    expect(await client.supplyRequestVersion.count({
      where: {
        supplyRequestId: created.supplyRequestId,
        OR: [
          { changeKind: "CORRECTED" },
          { correctionReason: { not: null } },
          { correctedByDisplayNameSnapshot: { not: null } },
          { correctionLocalDate: { not: null } },
          { correctionLocalTime: { not: null } },
        ],
      },
    })).toBe(0);
    expect(await client.dailyLog.count()).toBe(dailyLogsBefore);
    expect(await client.dailyLogActivity.count()).toBe(activitiesBefore);
  });

  it("leaves no phase-owned rows after bounded cleanup", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    await cleanPhaseData();
    expect(await client.supplyRequest.count({
      where: { referenceYear: { in: reservedYears } },
    })).toBe(0);
    expect(await client.supplyRequestVersion.count({
      where: { supplyRequest: { referenceYear: { in: reservedYears } } },
    })).toBe(0);
    expect(await client.supplyRequestVersionItem.count({
      where: { version: { supplyRequest: { referenceYear: { in: reservedYears } } } },
    })).toBe(0);
    expect(await client.supplyRequestReferenceCounter.count({
      where: { referenceYear: { in: reservedYears } },
    })).toBe(0);
    expect(await client.supplyItem.count({
      where: { normalizedItemNumber: { startsWith: normalizedTestPrefix } },
    })).toBe(0);
    expect(await client.supplyRequestSupervisor.count({
      where: { normalizedEmail: { startsWith: testPrefix } },
    })).toBe(0);
    expect(await client.equipment.count({
      where: { id: { startsWith: testPrefix } },
    })).toBe(0);
    expect(await client.mine.count({
      where: { id: { startsWith: testPrefix } },
    })).toBe(0);
    expect(await client.city.count({
      where: { id: { startsWith: testPrefix } },
    })).toBe(0);
  });
});
