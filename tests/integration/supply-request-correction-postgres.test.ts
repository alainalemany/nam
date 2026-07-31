import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { correctSupplyRequestWithDependencies } from "@/features/supply-requests/correction-persistence-internal";
import { SupplyRequestCorrectionError } from "@/features/supply-requests/correction-errors";
import {
  cancelSupplyRequestWithDependencies,
  fulfillSupplyRequestWithDependencies,
} from "@/features/supply-requests/lifecycle-persistence-internal";
import { createSupplyRequestWithDependencies } from "@/features/supply-requests/persistence-internal";
import {
  getCurrentSupplyRequestDetailWithClient,
  getImmutableSupplyRequestVersionWithClient,
  getSupplyRequestCorrectionHistoryWithClient,
} from "@/features/supply-requests/surface-data-internal";

const expectedDatabase = "nam_supply_request_test";
const prefix = "supply-correction-";
const normalizedPrefix = prefix.toUpperCase();
const years = Array.from({ length: 30 }, (_, index) => 6800 + index);

function guardedUrl() {
  const value = process.env.SUPPLY_REQUEST_TEST_DATABASE_URL;
  if (!value) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("SUPPLY_REQUEST_TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    name !== expectedDatabase
  ) {
    throw new Error(`Correction tests require the disposable ${expectedDatabase} database.`);
  }
  return value;
}

const databaseUrl = guardedUrl();
const describePostgres = databaseUrl ? describe : describe.skip;
const client = databaseUrl
  ? new PrismaClient({ datasourceUrl: databaseUrl })
  : undefined;
let ordinal = 0;
function label(value: string) {
  ordinal += 1;
  return `${prefix}${value}-${Date.now().toString(36)}-${ordinal}`;
}

async function cleanup() {
  if (!client) return;
  await client.supplyRequest.deleteMany({ where: { referenceYear: { in: years } } });
  await client.supplyRequestReferenceCounter.deleteMany({
    where: { referenceYear: { in: years } },
  });
  await client.supplyItem.deleteMany({
    where: { normalizedItemNumber: { startsWith: normalizedPrefix } },
  });
  await client.supplyRequestSupervisor.deleteMany({
    where: { normalizedEmail: { startsWith: prefix } },
  });
  await client.equipment.deleteMany({ where: { id: { startsWith: prefix } } });
  await client.mine.deleteMany({ where: { id: { startsWith: prefix } } });
  await client.city.deleteMany({ where: { id: { startsWith: prefix } } });
}

async function references(name: string, itemCount = 3) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  const id = label(name);
  const city = await client.city.create({
    data: { id: `${id}-city`, name: `${id} City`, state: "WY" },
  });
  const mine = await client.mine.create({
    data: { id: `${id}-mine`, cityId: city.id, name: `${id} Mine` },
  });
  const equipment = await client.equipment.create({
    data: {
      id: `${id}-equipment`,
      mineId: mine.id,
      displayName: `${id} Dragline`,
      equipmentNumber: "101",
      category: "DRAGLINE",
    },
  });
  const supervisor = await client.supplyRequestSupervisor.create({
    data: {
      id: `${id}-supervisor`,
      fullName: `${id} Supervisor`,
      email: `${id}@example.com`,
      normalizedEmail: `${id}@example.com`,
    },
  });
  const items = await Promise.all(
    Array.from({ length: itemCount }, (_, index) =>
      client.supplyItem.create({
        data: {
          id: `${id}-item-${index}`,
          itemNumber: `${id} Item ${index}`,
          normalizedItemNumber: `${id.toUpperCase()} ITEM ${index}`,
          description: `Description ${index}`,
          unitOfMeasure: index === 0 ? "Each" : "Case",
        },
      }),
    ),
  );
  return { id, city, mine, equipment, supervisor, items };
}

async function requested(
  year: number,
  refs: Awaited<ReturnType<typeof references>>,
) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  return createSupplyRequestWithDependencies(
    {
      operationalWorkDate: `${year}-01-01`,
      submittedLocalDate: `${year}-01-02`,
      submittedLocalTime: "09:15",
      equipmentId: refs.equipment.id,
      supervisorId: refs.supervisor.id,
      notes: "Original Notes",
      corporateSubmissionConfirmed: true,
      items: refs.items.slice(0, 2).map((item, index) => ({
        supplyItemId: item.id,
        quantity: index + 2,
      })),
    },
    { client },
  );
}

function correction(
  year: number,
  refs: Awaited<ReturnType<typeof references>>,
  supplyRequestId: string,
  patch: Record<string, unknown> = {},
) {
  return {
    supplyRequestId,
    expectedCurrentVersionNumber: 1,
    correctionReason: "Correct the NAM record",
    operationalWorkDate: `${year}-01-01`,
    submittedLocalDate: `${year}-01-02`,
    submittedLocalTime: "09:15",
    equipmentId: refs.equipment.id,
    supervisorId: refs.supervisor.id,
    notes: "Corrected Notes",
    resultingStatus: "REQUESTED" as const,
    items: refs.items.slice(0, 2).map((item, index) => ({
      supplyItemId: item.id,
      quantity: index + 3,
    })),
    ...patch,
  };
}

function nowFor(year: number) {
  return () => new Date(`${year}-01-02T15:30:00.000Z`);
}

async function versions(id: string) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  return client.supplyRequestVersion.findMany({
    where: { supplyRequestId: id },
    include: { items: { orderBy: { sequence: "asc" } } },
    orderBy: { versionNumber: "asc" },
  });
}

function parentSnapshots(record: Awaited<ReturnType<typeof versions>>[number]) {
  return {
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
  };
}

async function shape(id: string) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  const root = await client.supplyRequest.findUniqueOrThrow({ where: { id } });
  return {
    pointer: root.currentVersionId,
    versions: await client.supplyRequestVersion.count({
      where: { supplyRequestId: id },
    }),
    lines: await client.supplyRequestVersionItem.count({
      where: { version: { supplyRequestId: id } },
    }),
    counter: await client.supplyRequestReferenceCounter.findUniqueOrThrow({
      where: { referenceYear: root.referenceYear },
    }),
  };
}

describePostgres("Supply Request correction PostgreSQL behavior", () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await client?.$disconnect();
  });

  it("appends a complete Requested correction with item reconciliation and permanent identity", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("requested");
    const created = await requested(6800, refs);
    const before = await versions(created.supplyRequestId);
    const rootBefore = await client.supplyRequest.findUniqueOrThrow({
      where: { id: created.supplyRequestId },
    });
    const counterBefore = await client.supplyRequestReferenceCounter.findUniqueOrThrow({
      where: { referenceYear: 6800 },
    });
    await correctSupplyRequestWithDependencies(
      correction(6800, refs, created.supplyRequestId, {
        operationalWorkDate: "6800-01-03",
        submittedLocalDate: "6801-02-04",
        submittedLocalTime: "11:30",
        items: [
          { supplyItemId: refs.items[1].id, quantity: 8 },
          { supplyItemId: refs.items[2].id, quantity: 9 },
        ],
      }),
      { client, now: nowFor(6800) },
    );
    const after = await versions(created.supplyRequestId);
    const rootAfter = await client.supplyRequest.findUniqueOrThrow({
      where: { id: created.supplyRequestId },
    });
    expect(after).toHaveLength(2);
    expect(after[0]).toEqual(before[0]);
    expect(after[1]).toMatchObject({
      versionNumber: 2,
      changeKind: "CORRECTED",
      status: "REQUESTED",
      correctionReason: "Correct the NAM record",
      correctedByDisplayNameSnapshot: "Alain Alemany",
      correctionLocalDate: new Date("6800-01-02T00:00:00.000Z"),
      correctionLocalTime: "10:30",
      fulfillmentOperationalWorkDate: null,
      cancelledLocalDate: null,
    });
    expect(after[1].items.map((item) => item.supplyItemId)).toEqual([
      refs.items[1].id,
      refs.items[2].id,
    ]);
    expect(after[1].items[0]).toMatchObject({
      sequence: 1,
      quantity: 8,
      itemNumberSnapshot: after[0].items[1].itemNumberSnapshot,
    });
    expect(after[1].items[1]).toMatchObject({
      sequence: 2,
      itemNumberSnapshot: refs.items[2].itemNumber,
      descriptionSnapshot: refs.items[2].description,
      unitOfMeasureSnapshot: refs.items[2].unitOfMeasure,
    });
    expect(rootAfter).toMatchObject({
      namReference: rootBefore.namReference,
      referenceYear: rootBefore.referenceYear,
      referenceSequence: rootBefore.referenceSequence,
      currentVersionId: after[1].id,
    });
    const counterAfter = await client.supplyRequestReferenceCounter.findUniqueOrThrow({
      where: { referenceYear: 6800 },
    });
    expect(counterAfter).toEqual(counterBefore);
  });

  it("refreshes only deliberate Equipment and supervisor replacements", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const original = await references("replacement-original");
    const replacement = await references("replacement-new");
    const created = await requested(6801, original);
    await correctSupplyRequestWithDependencies(
      correction(6801, original, created.supplyRequestId, {
        equipmentId: replacement.equipment.id,
        supervisorId: replacement.supervisor.id,
      }),
      { client, now: nowFor(6801) },
    );
    const records = await versions(created.supplyRequestId);
    expect(records[1]).toMatchObject({
      equipmentId: replacement.equipment.id,
      equipmentDisplayNameSnapshot: replacement.equipment.displayName,
      mineNameSnapshot: replacement.mine.name,
      cityNameSnapshot: replacement.city.name,
      supervisorId: replacement.supervisor.id,
      supervisorNameSnapshot: replacement.supervisor.fullName,
      supervisorEmailSnapshot: replacement.supervisor.email,
      requesterDisplayNameSnapshot: records[0].requesterDisplayNameSnapshot,
    });
    expect(parentSnapshots(records[0])).not.toEqual(parentSnapshots(records[1]));
  });

  it("preserves unchanged inactive snapshots and rejects inactive replacements atomically", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("inactive");
    const replacements = await references("inactive-replacements");
    const created = await requested(6802, refs);
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
      where: { id: { in: refs.items.slice(0, 2).map((item) => item.id) } },
      data: { active: false, description: "Changed Description" },
    });
    await correctSupplyRequestWithDependencies(
      correction(6802, refs, created.supplyRequestId),
      { client, now: nowFor(6802) },
    );
    const corrected = (await versions(created.supplyRequestId))[1];
    expect(parentSnapshots(corrected)).toEqual(parentSnapshots(original));
    expect(corrected.items[0].descriptionSnapshot).toBe(
      original.items[0].descriptionSnapshot,
    );

    await client.equipment.update({
      where: { id: replacements.equipment.id },
      data: { status: "INACTIVE" },
    });
    await client.supplyRequestSupervisor.update({
      where: { id: replacements.supervisor.id },
      data: { active: false },
    });
    await client.supplyItem.update({
      where: { id: replacements.items[0].id },
      data: { active: false },
    });
    const baseline = await shape(created.supplyRequestId);
    for (const patch of [
      { equipmentId: replacements.equipment.id },
      { supervisorId: replacements.supervisor.id },
      {
        items: [
          { supplyItemId: refs.items[0].id, quantity: 2 },
          { supplyItemId: replacements.items[0].id, quantity: 2 },
        ],
      },
    ]) {
      await expect(
        correctSupplyRequestWithDependencies(
          correction(6802, refs, created.supplyRequestId, {
            expectedCurrentVersionNumber: 2,
            ...patch,
          }),
          { client, now: nowFor(6802) },
        ),
      ).rejects.toBeInstanceOf(SupplyRequestCorrectionError);
      expect(await shape(created.supplyRequestId)).toEqual(baseline);
    }
  });

  it("requires an active Equipment replacement after SetNull", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("set-null");
    const replacement = await references("set-null-replacement");
    const created = await requested(6803, refs);
    await client.equipment.delete({ where: { id: refs.equipment.id } });
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, created.supplyRequestId),
    ).resolves.toMatchObject({
      versionNumber: 1,
      equipmentAvailable: false,
      equipmentDisplayName: refs.equipment.displayName,
      mineName: refs.mine.name,
      cityName: refs.city.name,
    });
    await expect(
      correctSupplyRequestWithDependencies(
        correction(6803, refs, created.supplyRequestId, {
          equipmentId: "",
        }),
        { client, now: nowFor(6803) },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      correctSupplyRequestWithDependencies(
        correction(6803, refs, created.supplyRequestId, {
          equipmentId: "missing-equipment",
        }),
        { client, now: nowFor(6803) },
      ),
    ).rejects.toMatchObject({ code: "EQUIPMENT_REPLACEMENT_REQUIRED" });
    await client.equipment.update({
      where: { id: replacement.equipment.id },
      data: { status: "INACTIVE" },
    });
    await expect(
      correctSupplyRequestWithDependencies(
        correction(6803, refs, created.supplyRequestId, {
          equipmentId: replacement.equipment.id,
        }),
        { client, now: nowFor(6803) },
      ),
    ).rejects.toMatchObject({ code: "EQUIPMENT_INACTIVE" });
    await client.equipment.update({
      where: { id: replacement.equipment.id },
      data: { status: "ACTIVE" },
    });
    await correctSupplyRequestWithDependencies(
      correction(6803, refs, created.supplyRequestId, {
        equipmentId: replacement.equipment.id,
      }),
      { client, now: nowFor(6803) },
    );
    const records = await versions(created.supplyRequestId);
    expect(records[0].equipmentId).toBeNull();
    expect(records[1]).toMatchObject({
      equipmentId: replacement.equipment.id,
      equipmentDisplayNameSnapshot: replacement.equipment.displayName,
      mineNameSnapshot: replacement.mine.name,
      cityNameSnapshot: replacement.city.name,
      cityStateSnapshot: replacement.city.state,
    });
    await expect(
      getImmutableSupplyRequestVersionWithClient(
        client,
        created.supplyRequestId,
        "1",
      ),
    ).resolves.toMatchObject({
      role: "original",
      detail: {
        equipmentAvailable: false,
        equipmentDisplayName: refs.equipment.displayName,
        mineName: refs.mine.name,
      },
    });
    await expect(
      getImmutableSupplyRequestVersionWithClient(
        client,
        created.supplyRequestId,
        "2",
      ),
    ).resolves.toMatchObject({
      role: "current",
      detail: {
        equipmentAvailable: true,
        equipmentDisplayName: replacement.equipment.displayName,
      },
    });
  });

  it("corrects status independently to Requested, Fulfilled, and Cancelled", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    for (const [year, status] of [
      [6804, "REQUESTED"],
      [6805, "FULFILLED"],
      [6806, "CANCELLED"],
    ] as const) {
      const refs = await references(`status-${status}`);
      const created = await requested(year, refs);
      if (status === "REQUESTED") {
        await fulfillSupplyRequestWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            expectedCurrentVersionNumber: 1,
            fulfillmentOperationalWorkDate: `${year}-01-02`,
          },
          { client, now: nowFor(year) },
        );
      }
      const patch =
        status === "FULFILLED"
          ? {
              resultingStatus: status,
              fulfillmentOperationalWorkDate: `${year}-01-02`,
              fulfilledLocalDate: `${year}-01-02`,
              fulfilledLocalTime: "10:30",
              fulfillmentNote: "Corrected receipt",
            }
          : status === "CANCELLED"
            ? {
                resultingStatus: status,
                cancelledLocalDate: `${year}-01-02`,
                cancelledLocalTime: "10:30",
                cancellationReason: "Corrected cancellation",
              }
            : { resultingStatus: status };
      await correctSupplyRequestWithDependencies(
        correction(year, refs, created.supplyRequestId, {
          expectedCurrentVersionNumber: status === "REQUESTED" ? 2 : 1,
          ...patch,
        }),
        { client, now: nowFor(year) },
      );
      const current = (await versions(created.supplyRequestId)).at(-1)!;
      expect(current).toMatchObject({
        changeKind: "CORRECTED",
        status,
        correctionReason: "Correct the NAM record",
      });
      if (status === "REQUESTED") {
        expect(current).toMatchObject({
          fulfillmentOperationalWorkDate: null,
          cancelledLocalDate: null,
        });
      } else if (status === "FULFILLED") {
        expect(current.fulfilledLocalTime).toBe("10:30");
        expect(current.cancelledLocalDate).toBeNull();
      } else {
        expect(current.cancelledLocalTime).toBe("10:30");
        expect(current.fulfilledLocalDate).toBeNull();
      }
    }

    const cancelledRefs = await references("status-cancelled-to-requested");
    const cancelledCreated = await requested(6814, cancelledRefs);
    await cancelSupplyRequestWithDependencies(
      {
        supplyRequestId: cancelledCreated.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        cancellationReason: "Mistaken cancellation",
      },
      { client, now: nowFor(6814) },
    );
    const mistakenCancelled = (await versions(cancelledCreated.supplyRequestId))[1];
    await correctSupplyRequestWithDependencies(
      correction(6814, cancelledRefs, cancelledCreated.supplyRequestId, {
        expectedCurrentVersionNumber: 2,
        resultingStatus: "REQUESTED",
      }),
      { client, now: nowFor(6814) },
    );
    const cancelledRecords = await versions(cancelledCreated.supplyRequestId);
    expect(cancelledRecords).toHaveLength(3);
    expect(cancelledRecords[1]).toEqual(mistakenCancelled);
    expect(cancelledRecords[2]).toMatchObject({
      versionNumber: 3,
      changeKind: "CORRECTED",
      status: "REQUESTED",
      fulfillmentOperationalWorkDate: null,
      fulfilledLocalDate: null,
      fulfilledLocalTime: null,
      fulfillmentNote: null,
      cancelledLocalDate: null,
      cancelledLocalTime: null,
      cancellationReason: null,
      correctionReason: "Correct the NAM record",
      correctedByDisplayNameSnapshot: "Alain Alemany",
    });
    const cancelledRoot = await client.supplyRequest.findUniqueOrThrow({
      where: { id: cancelledCreated.supplyRequestId },
    });
    expect(cancelledRoot.currentVersionId).toBe(cancelledRecords[2].id);
    await expect(
      getSupplyRequestCorrectionHistoryWithClient(
        client,
        cancelledCreated.supplyRequestId,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        versionNumber: 2,
        changeKind: "CANCELLED",
        status: "CANCELLED",
      }),
      expect.objectContaining({
        versionNumber: 1,
        changeKind: "CREATED",
        status: "REQUESTED",
      }),
    ]);
  });

  it("serializes concurrent corrections and correction-versus-lifecycle races to one winner", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    for (const [year, race] of [
      [6807, "correction"],
      [6808, "fulfillment"],
      [6809, "cancellation"],
    ] as const) {
      const refs = await references(`race-${race}`);
      const created = await requested(year, refs);
      const correctionCall = () =>
        correctSupplyRequestWithDependencies(
          correction(year, refs, created.supplyRequestId),
          { client, now: nowFor(year) },
        );
      const competing =
        race === "correction"
          ? correctionCall
          : race === "fulfillment"
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
      const outcomes = await Promise.allSettled([
        correctionCall(),
        competing(),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(
        (outcomes.find((outcome) => outcome.status === "rejected") as PromiseRejectedResult)
          .reason,
      ).toMatchObject({ code: "STALE_VERSION" });
      const records = await versions(created.supplyRequestId);
      expect(records.map((record) => record.versionNumber)).toEqual([1, 2]);
      const root = await client.supplyRequest.findUniqueOrThrow({
        where: { id: created.supplyRequestId },
      });
      expect(root.currentVersionId).toBe(records[1].id);
    }
  });

  it("rejects stale and invalid corrections without persistence", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("stale");
    const created = await requested(6810, refs);
    await correctSupplyRequestWithDependencies(
      correction(6810, refs, created.supplyRequestId),
      { client, now: nowFor(6810) },
    );
    const inactiveReplacement = await references("stale-inactive-replacement");
    await client.equipment.update({
      where: { id: inactiveReplacement.equipment.id },
      data: { status: "INACTIVE" },
    });
    const baseline = await shape(created.supplyRequestId);
    await expect(
      correctSupplyRequestWithDependencies(
        correction(6810, refs, created.supplyRequestId, {
          equipmentId: inactiveReplacement.equipment.id,
        }),
        { client, now: nowFor(6810) },
      ),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    await expect(
      correctSupplyRequestWithDependencies(
        correction(6810, refs, created.supplyRequestId, {
          expectedCurrentVersionNumber: 2,
          correctionReason: "",
        }),
        { client, now: nowFor(6810) },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await shape(created.supplyRequestId)).toEqual(baseline);

    const corruptRefs = await references("invalid-current");
    const corrupt = await requested(6815, corruptRefs);
    await client.supplyRequestVersion.update({
      where: { id: corrupt.currentVersionId },
      data: { changeKind: "FULFILLED" },
    });
    const corruptBaseline = await shape(corrupt.supplyRequestId);
    await expect(
      correctSupplyRequestWithDependencies(
        correction(6815, corruptRefs, corrupt.supplyRequestId),
        { client, now: nowFor(6815) },
      ),
    ).rejects.toMatchObject({ code: "CURRENT_VERSION_INVALID" });
    expect(await shape(corrupt.supplyRequestId)).toEqual(corruptBaseline);
  });

  it("rolls back after append begins and retries rollback-certain attempts with stable metadata", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("rollback");
    const created = await requested(6811, refs);
    const duplicateIds = ["version-fail", "duplicate-line", "duplicate-line"];
    await expect(
      correctSupplyRequestWithDependencies(
        correction(6811, refs, created.supplyRequestId),
        {
          client,
          now: nowFor(6811),
          generateId: () => duplicateIds.shift() ?? "unexpected",
        },
      ),
    ).rejects.toMatchObject({ code: "UNEXPECTED_PERSISTENCE" });
    expect(await shape(created.supplyRequestId)).toMatchObject({
      pointer: created.currentVersionId,
      versions: 1,
      lines: 2,
    });

    let attempts = 0;
    const attemptedIds: string[] = [];
    const wrapped = {
      $transaction: async (
        operation: (transaction: unknown) => Promise<unknown>,
        options: unknown,
      ) => {
        attempts += 1;
        if (attempts === 1) {
          return client.$transaction(async (transaction) => {
            const proxy = {
              ...transaction,
              $queryRaw: transaction.$queryRaw.bind(transaction),
              supplyRequest: transaction.supplyRequest,
              equipment: transaction.equipment,
              supplyRequestSupervisor: transaction.supplyRequestSupervisor,
              supplyItem: transaction.supplyItem,
              supplyRequestVersion: {
                create: async (
                  args: Parameters<typeof transaction.supplyRequestVersion.create>[0],
                ) => {
                  const record = await transaction.supplyRequestVersion.create(args);
                  attemptedIds.push(record.id);
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
    const now = vi.fn(nowFor(6811));
    let id = 0;
    const result = await correctSupplyRequestWithDependencies(
      correction(6811, refs, created.supplyRequestId),
      {
        client: wrapped,
        now,
        generateId: () => `supply-correction-retry-${++id}`,
      },
    );
    expect(attempts).toBe(2);
    expect(now).toHaveBeenCalledOnce();
    expect(attemptedIds[0]).not.toBe(result.currentVersionId);
    const records = await versions(created.supplyRequestId);
    expect(records).toHaveLength(2);
    expect(records[1]).toMatchObject({
      versionNumber: 2,
      correctionLocalDate: new Date("6811-01-02T00:00:00.000Z"),
      correctionLocalTime: "10:30",
    });
  });

  it("follows pointer authority over a decoy and exposes complete immutable history", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("history");
    const created = await requested(6812, refs);
    const original = (await versions(created.supplyRequestId))[0];
    await client.supplyRequestVersion.create({
      data: {
        id: `${refs.id}-decoy`,
        supplyRequestId: created.supplyRequestId,
        versionNumber: 99,
        changeKind: "CREATED",
        status: "REQUESTED",
        operationalWorkDate: original.operationalWorkDate,
        submittedLocalDate: original.submittedLocalDate,
        submittedLocalTime: original.submittedLocalTime,
        ...parentSnapshots(original),
        equipmentDisplayNameSnapshot: "Decoy Equipment",
        supervisorNameSnapshot: "Decoy Supervisor",
        notes: "Decoy Notes",
        items: {
          create: original.items.map((item, index) => ({
            id: `${refs.id}-decoy-line-${index}`,
            supplyItemId: item.supplyItemId,
            sequence: item.sequence,
            quantity: item.quantity,
            itemNumberSnapshot: item.itemNumberSnapshot,
            normalizedItemNumberSnapshot: item.normalizedItemNumberSnapshot,
            descriptionSnapshot: `Decoy Description ${index}`,
            unitOfMeasureSnapshot: item.unitOfMeasureSnapshot,
          })),
        },
      },
    });
    await correctSupplyRequestWithDependencies(
      correction(6812, refs, created.supplyRequestId),
      { client, now: nowFor(6812) },
    );
    await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        expectedCurrentVersionNumber: 2,
        fulfillmentOperationalWorkDate: "6812-01-02",
      },
      { client, now: nowFor(6812) },
    );
    await correctSupplyRequestWithDependencies(
      correction(6812, refs, created.supplyRequestId, {
        expectedCurrentVersionNumber: 3,
      }),
      { client, now: nowFor(6812) },
    );
    const records = await versions(created.supplyRequestId);
    expect(records.map((record) => record.versionNumber)).toEqual([
      1, 2, 3, 4, 99,
    ]);
    const root = await client.supplyRequest.findUniqueOrThrow({
      where: { id: created.supplyRequestId },
    });
    expect(root.currentVersionId).toBe(records[3].id);
    expect(records[1].equipmentDisplayNameSnapshot).toBe(
      original.equipmentDisplayNameSnapshot,
    );
    expect(records[1].supervisorNameSnapshot).toBe(
      original.supervisorNameSnapshot,
    );
    expect(records[1].items.map((item) => item.descriptionSnapshot)).toEqual(
      original.items.map((item) => item.descriptionSnapshot),
    );
    await expect(
      getCurrentSupplyRequestDetailWithClient(client, created.supplyRequestId),
    ).resolves.toMatchObject({
      versionNumber: 4,
      changeKind: "CORRECTED",
      status: "REQUESTED",
    });
    const history = await getSupplyRequestCorrectionHistoryWithClient(
      client,
      created.supplyRequestId,
    );
    expect(history?.map((entry) => entry.versionNumber)).toEqual([
      99, 3, 2, 1,
    ]);
    expect(history?.find((entry) => entry.versionNumber === 3)).toMatchObject({
      changeKind: "FULFILLED",
      status: "FULFILLED",
      changeLocalDate: "6812-01-02",
      changeLocalTime: "10:30",
      correctionReason: null,
    });
    expect(history?.find((entry) => entry.versionNumber === 2)).toMatchObject({
      changeKind: "CORRECTED",
      status: "REQUESTED",
      changeLocalDate: "6812-01-02",
      changeLocalTime: "10:30",
      correctionReason: "Correct the NAM record",
    });
    await expect(
      getImmutableSupplyRequestVersionWithClient(
        client,
        created.supplyRequestId,
        "1",
      ),
    ).resolves.toMatchObject({ role: "original" });
    await expect(
      getImmutableSupplyRequestVersionWithClient(
        client,
        created.supplyRequestId,
        "2",
      ),
    ).resolves.toMatchObject({ role: "superseded" });
    await expect(
      getImmutableSupplyRequestVersionWithClient(
        client,
        created.supplyRequestId,
        "3",
      ),
    ).resolves.toMatchObject({
      role: "superseded",
      detail: { changeKind: "FULFILLED", status: "FULFILLED" },
    });
    await expect(
      getImmutableSupplyRequestVersionWithClient(
        client,
        created.supplyRequestId,
        "4",
      ),
    ).resolves.toMatchObject({
      role: "current",
      detail: { changeKind: "CORRECTED", status: "REQUESTED" },
    });
    await expect(
      client.supplyRequest.update({
        where: { id: created.supplyRequestId },
        data: { currentVersionId: (await requested(6813, await references("owner"))).currentVersionId },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("creates no later-slice persistence and leaves no phase-owned rows after cleanup", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const dailyLogs = await client.dailyLog.count();
    const activities = await client.dailyLogActivity.count();
    expect(await client.supplyRequestVersion.count({
      where: {
        supplyRequest: { referenceYear: { in: years } },
        OR: [
          { fulfillmentNote: { contains: "partial", mode: "insensitive" } },
          { correctionReason: { contains: "reopen", mode: "insensitive" } },
        ],
      },
    })).toBe(0);
    expect(await client.dailyLog.count()).toBe(dailyLogs);
    expect(await client.dailyLogActivity.count()).toBe(activities);
    await cleanup();
    expect(await client.supplyRequest.count({
      where: { referenceYear: { in: years } },
    })).toBe(0);
    expect(await client.supplyRequestVersion.count({
      where: { supplyRequest: { referenceYear: { in: years } } },
    })).toBe(0);
    expect(await client.supplyRequestVersionItem.count({
      where: { version: { supplyRequest: { referenceYear: { in: years } } } },
    })).toBe(0);
    expect(await client.supplyRequestReferenceCounter.count({
      where: { referenceYear: { in: years } },
    })).toBe(0);
    expect(await client.supplyItem.count({
      where: { normalizedItemNumber: { startsWith: normalizedPrefix } },
    })).toBe(0);
    expect(await client.supplyRequestSupervisor.count({
      where: { normalizedEmail: { startsWith: prefix } },
    })).toBe(0);
    expect(await client.equipment.count({ where: { id: { startsWith: prefix } } })).toBe(0);
    expect(await client.mine.count({ where: { id: { startsWith: prefix } } })).toBe(0);
    expect(await client.city.count({ where: { id: { startsWith: prefix } } })).toBe(0);
  });
});
