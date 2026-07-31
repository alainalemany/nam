import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSupplyRequestHistoryPageWithClient } from "@/features/supply-requests/history-data-internal";

const databaseName = "nam_supply_request_test";
const prefix = "supply-history-";
const normalizedPrefix = prefix.toUpperCase();
const years = [7200, 7201, 7202, 7203, 7204, 7205];

function guardedUrl() {
  const value = process.env.SUPPLY_REQUEST_TEST_DATABASE_URL;
  if (!value) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("SUPPLY_REQUEST_TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    decodeURIComponent(parsed.pathname.replace(/^\//u, "")) !== databaseName
  ) {
    throw new Error(`History tests require the disposable ${databaseName} database.`);
  }
  return value;
}

const databaseUrl = guardedUrl();
const describePostgres = databaseUrl ? describe : describe.skip;
const client = databaseUrl ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
let sequence = 0;
function id(label: string) {
  sequence += 1;
  return `${prefix}${label}-${sequence}`;
}

async function cleanup() {
  if (!client) return;
  await client.supplyRequest.deleteMany({ where: { referenceYear: { in: years } } });
  await client.supplyRequestReferenceCounter.deleteMany({ where: { referenceYear: { in: years } } });
  await client.supplyItem.deleteMany({ where: { normalizedItemNumber: { startsWith: normalizedPrefix } } });
  await client.supplyRequestSupervisor.deleteMany({ where: { normalizedEmail: { startsWith: prefix } } });
  await client.equipment.deleteMany({ where: { id: { startsWith: prefix } } });
  await client.mine.deleteMany({ where: { id: { startsWith: prefix } } });
  await client.city.deleteMany({ where: { id: { startsWith: prefix } } });
}

async function references(label: string) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  const key = id(label);
  const city = await client.city.create({ data: { id: `${key}-city`, name: `${key} City`, state: "WY" } });
  const mine = await client.mine.create({ data: { id: `${key}-mine`, cityId: city.id, name: `${key} Mine` } });
  const equipment = await client.equipment.create({ data: { id: `${key}-equipment`, mineId: mine.id, displayName: `${key} Dragline`, equipmentNumber: `${sequence}`, category: "DRAGLINE" } });
  const supervisor = await client.supplyRequestSupervisor.create({ data: { id: `${key}-supervisor`, fullName: `${key} Supervisor`, email: `${key}@example.com`, normalizedEmail: `${key}@example.com` } });
  const item = await client.supplyItem.create({ data: { id: `${key}-item`, itemNumber: `${key} Item`, normalizedItemNumber: `${key.toUpperCase()} ITEM`, description: `${key} Historic Pump`, unitOfMeasure: "Each" } });
  return { key, city, mine, equipment, supervisor, item };
}

async function requestFixture(input: {
  year: number;
  ordinal: number;
  refs: Awaited<ReturnType<typeof references>>;
  workDate?: string;
  submittedDate?: string;
  submittedTime?: string;
  notes?: string | null;
  itemNumber?: string;
  description?: string;
}) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  const rootId = `${input.refs.key}-request-${input.ordinal}`;
  const versionId = `${rootId}-version-1`;
  const reference = `SR-${input.year}-${String(input.ordinal).padStart(4, "0")}`;
  await client.$transaction(async (tx) => {
    await tx.supplyRequest.create({ data: { id: rootId, namReference: reference, referenceYear: input.year, referenceSequence: input.ordinal } });
    await tx.supplyRequestVersion.create({
      data: {
        id: versionId,
        supplyRequestId: rootId,
        versionNumber: 1,
        changeKind: "CREATED",
        status: "REQUESTED",
        operationalWorkDate: new Date(`${input.workDate ?? `${input.year}-01-15`}T00:00:00.000Z`),
        submittedLocalDate: new Date(`${input.submittedDate ?? `${input.year}-01-16`}T00:00:00.000Z`),
        submittedLocalTime: input.submittedTime ?? "09:30",
        equipmentId: input.refs.equipment.id,
        equipmentDisplayNameSnapshot: `${input.refs.key} Snapshot Equipment`,
        equipmentNumberSnapshot: input.refs.equipment.equipmentNumber,
        equipmentCategorySnapshot: "DRAGLINE",
        mineNameSnapshot: `${input.refs.key} Snapshot Mine`,
        cityNameSnapshot: `${input.refs.key} Snapshot City`,
        cityStateSnapshot: "WY",
        requesterDisplayNameSnapshot: "Alain Alemany",
        requesterEmployeeNumberSnapshot: "911601",
        supervisorId: input.refs.supervisor.id,
        supervisorNameSnapshot: `${input.refs.key} Snapshot Supervisor`,
        supervisorEmailSnapshot: `${input.refs.key}@snapshot.example.com`,
        notes: input.notes === undefined ? "Current searchable notes" : input.notes,
        items: {
          create: {
            id: `${versionId}-line-1`,
            supplyItemId: input.refs.item.id,
            sequence: 1,
            quantity: 2,
            itemNumberSnapshot: input.itemNumber ?? `${input.refs.key} SNAP-ITEM`,
            normalizedItemNumberSnapshot: (input.itemNumber ?? `${input.refs.key} SNAP-ITEM`).toUpperCase(),
            descriptionSnapshot: input.description ?? "Current hydraulic pump snapshot",
            unitOfMeasureSnapshot: "Each",
          },
        },
      },
    });
    await tx.supplyRequest.update({
      where: { id: rootId },
      data: { currentVersion: { connect: { id_supplyRequestId: { id: versionId, supplyRequestId: rootId } } } },
    });
  });
  return { rootId, versionId, reference };
}

describePostgres("Supply Request canonical history PostgreSQL behavior", () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await client?.$disconnect();
  });

  it("lists one pointer-owned current row and ignores a divergent higher decoy for display and filters", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("pointer");
    const decoyRefs = await references("pointer-decoy");
    const request = await requestFixture({ year: 7200, ordinal: 1, refs, notes: "Pointer-only notes", itemNumber: "POINTER-ITEM" });
    await client.supplyRequestVersion.create({
      data: {
        ...(await client.supplyRequestVersion.findUniqueOrThrow({ where: { id: request.versionId }, select: {
          submittedLocalDate: true, submittedLocalTime: true, equipmentCategorySnapshot: true,
          requesterDisplayNameSnapshot: true, requesterEmployeeNumberSnapshot: true,
        } })),
        id: `${request.rootId}-decoy`, supplyRequestId: request.rootId, versionNumber: 99,
        changeKind: "CANCELLED", status: "CANCELLED", notes: "Decoy-only notes",
        operationalWorkDate: new Date("7200-12-30T00:00:00.000Z"),
        equipmentId: decoyRefs.equipment.id,
        equipmentDisplayNameSnapshot: "Decoy Equipment Snapshot",
        equipmentNumberSnapshot: "DECOY-99",
        mineNameSnapshot: "Decoy Mine Snapshot",
        cityNameSnapshot: "Decoy City Snapshot",
        cityStateSnapshot: "UT",
        supervisorId: decoyRefs.supervisor.id,
        supervisorNameSnapshot: "Decoy Supervisor Snapshot",
        supervisorEmailSnapshot: "decoy-snapshot@example.com",
        cancelledLocalDate: new Date("7200-12-31T00:00:00.000Z"), cancelledLocalTime: "10:00",
        items: { create: { id: `${request.rootId}-decoy-line`, supplyItemId: decoyRefs.item.id, sequence: 1, quantity: 1, itemNumberSnapshot: "DECOY-ONLY", normalizedItemNumberSnapshot: "DECOY-ONLY", descriptionSnapshot: "Decoy description", unitOfMeasureSnapshot: "Each" } },
      },
    });
    await client.equipment.update({ where: { id: decoyRefs.equipment.id }, data: { status: "INACTIVE" } });
    await client.supplyRequestSupervisor.update({ where: { id: decoyRefs.supervisor.id }, data: { active: false } });
    const page = await getSupplyRequestHistoryPageWithClient(client, { page: 1, status: "REQUESTED", notes: "pointer-only", item: "POINTER" });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({ supplyRequestId: request.rootId, versionNumber: 1, status: "REQUESTED", itemCount: 1 });
    const decoyFilterBase = { page: 1, reference: request.reference } as const;
    expect((await getSupplyRequestHistoryPageWithClient(client, { ...decoyFilterBase, status: "CANCELLED" })).rows).toHaveLength(0);
    expect((await getSupplyRequestHistoryPageWithClient(client, { ...decoyFilterBase, notes: "Decoy-only" })).rows).toHaveLength(0);
    expect((await getSupplyRequestHistoryPageWithClient(client, { ...decoyFilterBase, item: "DECOY-ONLY" })).rows).toHaveLength(0);
    expect((await getSupplyRequestHistoryPageWithClient(client, { ...decoyFilterBase, dateFrom: "7200-12-30", dateTo: "7200-12-30" })).rows).toHaveLength(0);
    expect((await getSupplyRequestHistoryPageWithClient(client, { ...decoyFilterBase, equipmentId: decoyRefs.equipment.id })).rows).toHaveLength(0);
    expect((await getSupplyRequestHistoryPageWithClient(client, { ...decoyFilterBase, supervisorId: decoyRefs.supervisor.id })).rows).toHaveLength(0);
    const unfiltered = await getSupplyRequestHistoryPageWithClient(client, { page: 1 });
    expect(unfiltered.equipmentOptions.map((option) => option.id)).not.toContain(decoyRefs.equipment.id);
    expect(unfiltered.supervisorOptions.map((option) => option.id)).not.toContain(decoyRefs.supervisor.id);
  });

  it("applies inclusive/reversed dates, exact reference, snapshot item/notes, and AND filters in PostgreSQL", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("filters");
    const lower = await requestFixture({ year: 7201, ordinal: 1, refs, workDate: "7201-01-10", notes: "Urgent pump work", description: "Historic Seal Assembly" });
    await requestFixture({ year: 7201, ordinal: 2, refs, workDate: "7201-01-20", notes: null, description: "Other component" });
    expect((await getSupplyRequestHistoryPageWithClient(client, { page: 1, dateFrom: "7201-01-10", dateTo: "7201-01-20" })).rows).toHaveLength(2);
    expect((await getSupplyRequestHistoryPageWithClient(client, { page: 1, dateFrom: "7201-01-20", dateTo: "7201-01-10" })).rows).toHaveLength(0);
    expect((await getSupplyRequestHistoryPageWithClient(client, { page: 1, reference: lower.reference.toLowerCase().toUpperCase() })).rows.map((row) => row.supplyRequestId)).toEqual([lower.rootId]);
    expect((await getSupplyRequestHistoryPageWithClient(client, { page: 1, reference: lower.reference.slice(0, -1) })).rows).toHaveLength(0);
    const combined = await getSupplyRequestHistoryPageWithClient(client, { page: 1, equipmentId: refs.equipment.id, supervisorId: refs.supervisor.id, status: "REQUESTED", item: "seal assembly", notes: "URGENT" });
    expect(combined.rows.map((row) => row.supplyRequestId)).toEqual([lower.rootId]);
  });

  it("filters resulting Requested, Fulfilled, and Cancelled status independently from change kind and lifecycle narratives", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("statuses");
    const requested = await requestFixture({ year: 7201, ordinal: 11, refs, notes: null });
    const fulfilled = await requestFixture({ year: 7201, ordinal: 12, refs, notes: null });
    const cancelled = await requestFixture({ year: 7201, ordinal: 13, refs, notes: null });
    const correctedRequested = await requestFixture({ year: 7201, ordinal: 14, refs, notes: null });
    const correctedFulfilled = await requestFixture({ year: 7201, ordinal: 15, refs, notes: null });
    const correctedCancelled = await requestFixture({ year: 7201, ordinal: 16, refs, notes: null });
    await client.supplyRequestVersion.update({ where: { id: fulfilled.versionId }, data: { changeKind: "FULFILLED", status: "FULFILLED", fulfillmentOperationalWorkDate: new Date("7201-01-15T00:00:00.000Z"), fulfilledLocalDate: new Date("7201-01-16T00:00:00.000Z"), fulfilledLocalTime: "10:00", fulfillmentNote: "Lifecycle narrative only" } });
    await client.supplyRequestVersion.update({ where: { id: cancelled.versionId }, data: { changeKind: "CANCELLED", status: "CANCELLED", cancelledLocalDate: new Date("7201-01-16T00:00:00.000Z"), cancelledLocalTime: "10:00", cancellationReason: "Cancellation narrative only" } });
    for (const [record, status] of [[correctedRequested, "REQUESTED"], [correctedFulfilled, "FULFILLED"], [correctedCancelled, "CANCELLED"]] as const) {
      await client.supplyRequestVersion.update({
        where: { id: record.versionId },
        data: {
          changeKind: "CORRECTED",
          status,
          correctionReason: "Correction narrative only",
          correctedByDisplayNameSnapshot: "Alain Alemany",
          correctionLocalDate: new Date("7201-01-17T00:00:00.000Z"),
          correctionLocalTime: "11:00",
          ...(status === "FULFILLED" ? { fulfillmentOperationalWorkDate: new Date("7201-01-15T00:00:00.000Z"), fulfilledLocalDate: new Date("7201-01-16T00:00:00.000Z"), fulfilledLocalTime: "10:00" } : {}),
          ...(status === "CANCELLED" ? { cancelledLocalDate: new Date("7201-01-16T00:00:00.000Z"), cancelledLocalTime: "10:00" } : {}),
        },
      });
    }
    const requestedRows = await getSupplyRequestHistoryPageWithClient(client, { page: 1, status: "REQUESTED", dateFrom: "7201-01-15", dateTo: "7201-01-15" });
    const fulfilledRows = await getSupplyRequestHistoryPageWithClient(client, { page: 1, status: "FULFILLED", dateFrom: "7201-01-15", dateTo: "7201-01-15" });
    const cancelledRows = await getSupplyRequestHistoryPageWithClient(client, { page: 1, status: "CANCELLED", dateFrom: "7201-01-15", dateTo: "7201-01-15" });
    expect(requestedRows.rows.map((row) => row.supplyRequestId)).toEqual(expect.arrayContaining([requested.rootId, correctedRequested.rootId]));
    expect(fulfilledRows.rows.map((row) => row.supplyRequestId)).toEqual(expect.arrayContaining([fulfilled.rootId, correctedFulfilled.rootId]));
    expect(cancelledRows.rows.map((row) => row.supplyRequestId)).toEqual(expect.arrayContaining([cancelled.rootId, correctedCancelled.rootId]));
    for (const narrative of ["Lifecycle narrative", "Cancellation narrative", "Correction narrative"]) {
      expect((await getSupplyRequestHistoryPageWithClient(client, { page: 1, notes: narrative })).rows).toHaveLength(0);
    }
  });

  it("includes active and current-used inactive options while excluding unused inactive and superseded-only references", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const used = await references("used-inactive");
    const unused = await references("unused-inactive");
    await requestFixture({ year: 7202, ordinal: 1, refs: used });
    await client.equipment.update({ where: { id: used.equipment.id }, data: { status: "INACTIVE" } });
    await client.supplyRequestSupervisor.update({ where: { id: used.supervisor.id }, data: { active: false } });
    await client.equipment.update({ where: { id: unused.equipment.id }, data: { status: "INACTIVE" } });
    await client.supplyRequestSupervisor.update({ where: { id: unused.supervisor.id }, data: { active: false } });
    const page = await getSupplyRequestHistoryPageWithClient(client, { page: 1 });
    expect(page.equipmentOptions).toContainEqual(expect.objectContaining({ id: used.equipment.id, active: false }));
    expect(page.supervisorOptions).toContainEqual(expect.objectContaining({ id: used.supervisor.id, active: false }));
    expect(page.equipmentOptions.map((option) => option.id)).not.toContain(unused.equipment.id);
    expect(page.supervisorOptions.map((option) => option.id)).not.toContain(unused.supervisor.id);
  });

  it("uses exact deterministic ordering and fifty-row pages without duplicates or omissions", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("pagination");
    for (let index = 1; index <= 51; index += 1) {
      await requestFixture({ year: 7203, ordinal: index, refs, workDate: "7203-06-01", submittedDate: "7203-06-02", submittedTime: "08:00" });
    }
    const filters = { dateFrom: "7203-06-01", dateTo: "7203-06-01" } as const;
    const first = await getSupplyRequestHistoryPageWithClient(client, { page: 1, ...filters });
    const second = await getSupplyRequestHistoryPageWithClient(client, { page: 2, ...filters });
    expect(first.rows).toHaveLength(50);
    expect(second.rows).toHaveLength(1);
    expect(first.hasNextPage).toBe(true);
    expect(second.hasPreviousPage).toBe(true);
    const ids = [...first.rows, ...second.rows].map((row) => row.supplyRequestId);
    expect(new Set(ids).size).toBe(51);
    expect(first.rows[0].namReference).toBe("SR-7203-0051");
  });

  it("returns out-of-range and huge pages safely and rejects malformed current aggregates", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("safety");
    const request = await requestFixture({ year: 7204, ordinal: 1, refs });
    const huge = await getSupplyRequestHistoryPageWithClient(client, { page: Number.MAX_SAFE_INTEGER, reference: request.reference });
    expect(huge).toMatchObject({ rows: [], matchingCount: 1, hasPreviousPage: true, hasNextPage: false });
    await client.supplyRequestVersion.update({ where: { id: request.versionId }, data: { submittedLocalTime: "25:00" } });
    await expect(getSupplyRequestHistoryPageWithClient(client, { page: 1, reference: request.reference })).rejects.toThrow("Invalid persisted Supply Request current aggregate");
    await client.supplyRequestVersion.update({ where: { id: request.versionId }, data: { submittedLocalTime: "09:30" } });
    const missingPointerId = `${refs.key}-missing-pointer`;
    await client.supplyRequest.create({
      data: {
        id: missingPointerId,
        namReference: "SR-7204-0002",
        referenceYear: 7204,
        referenceSequence: 2,
      },
    });
    await expect(
      getSupplyRequestHistoryPageWithClient(client, {
        page: 1,
        reference: "SR-7204-0002",
      }),
    ).rejects.toThrow("Invalid persisted Supply Request current aggregate");
    await client.supplyRequest.delete({ where: { id: missingPointerId } });
  });

  it("returns one coherent Repeatable Read page while a concurrent current-version update commits", async () => {
    if (!client || !databaseUrl) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("repeatable-read");
    const replacement = await references("repeatable-read-replacement");
    const request = await requestFixture({ year: 7205, ordinal: 2, refs, workDate: "7205-02-01" });
    await client.equipment.update({ where: { id: refs.equipment.id }, data: { status: "INACTIVE" } });
    await client.supplyRequestSupervisor.update({ where: { id: refs.supervisor.id }, data: { active: false } });
    await client.equipment.update({ where: { id: replacement.equipment.id }, data: { status: "INACTIVE" } });
    await client.supplyRequestSupervisor.update({ where: { id: replacement.supervisor.id }, data: { active: false } });
    let releaseSnapshot!: () => void;
    let snapshotStarted!: () => void;
    const release = new Promise<void>((resolve) => { releaseSnapshot = resolve; });
    const started = new Promise<void>((resolve) => { snapshotStarted = resolve; });
    const wrappedClient = {
      $transaction: (callback: (tx: unknown) => unknown, options: unknown) =>
        client.$transaction(async (tx) => {
          const wrapped = {
            supplyRequest: {
              count: async (args: Parameters<typeof tx.supplyRequest.count>[0]) => {
                const result = await tx.supplyRequest.count(args);
                snapshotStarted();
                await release;
                return result;
              },
              findFirst: tx.supplyRequest.findFirst.bind(tx.supplyRequest),
              findMany: tx.supplyRequest.findMany.bind(tx.supplyRequest),
            },
            equipment: { findMany: tx.equipment.findMany.bind(tx.equipment) },
            supplyRequestSupervisor: { findMany: tx.supplyRequestSupervisor.findMany.bind(tx.supplyRequestSupervisor) },
          };
          return callback(wrapped);
        }, options as never),
    } as never;
    const pagePromise = getSupplyRequestHistoryPageWithClient(wrappedClient, { page: 1, reference: request.reference });
    await started;
    const writer = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await writer.$transaction(async (tx) => {
        const versionId = `${request.rootId}-version-2`;
        await tx.supplyRequestVersion.create({ data: {
          id: versionId,
          supplyRequestId: request.rootId,
          versionNumber: 2,
          changeKind: "CORRECTED",
          status: "REQUESTED",
          operationalWorkDate: new Date("7205-02-02T00:00:00.000Z"),
          submittedLocalDate: new Date("7205-02-03T00:00:00.000Z"),
          submittedLocalTime: "10:30",
          equipmentId: replacement.equipment.id,
          equipmentDisplayNameSnapshot: "Replacement Equipment Snapshot",
          equipmentNumberSnapshot: replacement.equipment.equipmentNumber,
          equipmentCategorySnapshot: "DRAGLINE",
          mineNameSnapshot: "Replacement Mine Snapshot",
          cityNameSnapshot: "Replacement City Snapshot",
          cityStateSnapshot: "WY",
          requesterDisplayNameSnapshot: "Alain Alemany",
          requesterEmployeeNumberSnapshot: "911601",
          supervisorId: replacement.supervisor.id,
          supervisorNameSnapshot: "Replacement Supervisor Snapshot",
          supervisorEmailSnapshot: "replacement-snapshot@example.com",
          notes: "Replacement pointer notes",
          correctionReason: "Concurrent pointer correction",
          correctedByDisplayNameSnapshot: "Alain Alemany",
          correctionLocalDate: new Date("7205-02-03T00:00:00.000Z"),
          correctionLocalTime: "11:00",
          items: { create: {
            id: `${versionId}-line-1`,
            supplyItemId: replacement.item.id,
            sequence: 1,
            quantity: 3,
            itemNumberSnapshot: "REPLACEMENT-ITEM",
            normalizedItemNumberSnapshot: "REPLACEMENT-ITEM",
            descriptionSnapshot: "Replacement item snapshot",
            unitOfMeasureSnapshot: "Each",
          } },
        } });
        await tx.supplyRequest.update({
          where: { id: request.rootId },
          data: { currentVersion: { connect: { id_supplyRequestId: { id: versionId, supplyRequestId: request.rootId } } } },
        });
      });
    } finally {
      await writer.$disconnect();
      releaseSnapshot();
    }
    const page = await pagePromise;
    expect(page.rows[0].operationalWorkDate).toBe("7205-02-01");
    expect(page.equipmentOptions.map((option) => option.id)).toContain(refs.equipment.id);
    expect(page.equipmentOptions.map((option) => option.id)).not.toContain(replacement.equipment.id);
    expect(page.supervisorOptions.map((option) => option.id)).toContain(refs.supervisor.id);
    expect(page.supervisorOptions.map((option) => option.id)).not.toContain(replacement.supervisor.id);
    const subsequent = await getSupplyRequestHistoryPageWithClient(client, { page: 1, reference: request.reference });
    expect(subsequent.rows[0].operationalWorkDate).toBe("7205-02-02");
    expect(subsequent.rows[0]).toMatchObject({
      equipmentLabel: `Replacement Equipment Snapshot · ${replacement.equipment.equipmentNumber}`,
      supervisorName: "Replacement Supervisor Snapshot",
    });
    expect(subsequent.equipmentOptions.map((option) => option.id)).toContain(replacement.equipment.id);
    expect(subsequent.equipmentOptions.map((option) => option.id)).not.toContain(refs.equipment.id);
    expect(subsequent.supervisorOptions.map((option) => option.id)).toContain(replacement.supervisor.id);
    expect(subsequent.supervisorOptions.map((option) => option.id)).not.toContain(refs.supervisor.id);
  });

  it("is read-only, preserves SetNull snapshot rows, and creates no later-slice persistence", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("set-null");
    const request = await requestFixture({ year: 7205, ordinal: 1, refs });
    const before = { logs: await client.dailyLog.count(), activities: await client.dailyLogActivity.count(), versions: await client.supplyRequestVersion.count({ where: { supplyRequestId: request.rootId } }) };
    await client.equipment.delete({ where: { id: refs.equipment.id } });
    const page = await getSupplyRequestHistoryPageWithClient(client, { page: 1, reference: request.reference });
    expect(page.rows[0]).toMatchObject({ supplyRequestId: request.rootId, equipmentLabel: `${refs.key} Snapshot Equipment · ${refs.equipment.equipmentNumber}` });
    expect((await getSupplyRequestHistoryPageWithClient(client, { page: 1, equipmentId: refs.equipment.id })).rows).toHaveLength(0);
    expect({ logs: await client.dailyLog.count(), activities: await client.dailyLogActivity.count(), versions: await client.supplyRequestVersion.count({ where: { supplyRequestId: request.rootId } }) }).toEqual(before);
  });
});
