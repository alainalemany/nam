import { PrismaClient, type SupplyRequestStatus, type SupplyRequestVersionChangeKind } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { correctSupplyRequestWithDependencies } from "@/features/supply-requests/correction-persistence-internal";
import { getSupplyRequestDayViewItemsWithClient } from "@/features/supply-requests/day-view-data-internal";

const expectedDatabaseName = "nam_supply_request_test";
const prefix = "supply-day-view-";
const normalizedPrefix = prefix.toUpperCase();
const years = [7500, 7501, 7502, 7503, 7504, 7505];

function guardedDatabaseUrl() {
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
    decodeURIComponent(parsed.pathname.replace(/^\//u, "")) !== expectedDatabaseName
  ) {
    throw new Error(
      `Supply Request Day View tests require the disposable ${expectedDatabaseName} database.`,
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

function key(label: string) {
  ordinal += 1;
  return `${prefix}${label}-${ordinal}`;
}

async function cleanup() {
  if (!client) return;
  await client.supplyRequestDailyLogLink.deleteMany({
    where: { supplyRequest: { referenceYear: { in: years } } },
  });
  await client.supplyRequest.deleteMany({
    where: { referenceYear: { in: years } },
  });
  await client.dailyLog.deleteMany({ where: { id: { startsWith: prefix } } });
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

async function references(label: string) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  const fixture = key(label);
  const city = await client.city.create({
    data: { id: `${fixture}-city`, name: `${fixture} City`, state: "WY" },
  });
  const mine = await client.mine.create({
    data: { id: `${fixture}-mine`, cityId: city.id, name: `${fixture} Mine` },
  });
  const equipment = await client.equipment.create({
    data: {
      id: `${fixture}-equipment`,
      mineId: mine.id,
      displayName: `${fixture} Live Equipment`,
      equipmentNumber: `${ordinal}`,
      category: "DRAGLINE",
    },
  });
  const supervisor = await client.supplyRequestSupervisor.create({
    data: {
      id: `${fixture}-supervisor`,
      fullName: `${fixture} Live Supervisor`,
      email: `${fixture}@example.com`,
      normalizedEmail: `${fixture}@example.com`,
    },
  });
  return { fixture, city, mine, equipment, supervisor };
}

async function catalogItems(fixture: string, count: number) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  const items = [];
  for (let index = 1; index <= count; index += 1) {
    const id = `${fixture}-item-${index}`;
    items.push(
      await client.supplyItem.create({
        data: {
          id,
          itemNumber: `${fixture} Item ${index}`,
          normalizedItemNumber: `${fixture.toUpperCase()} ITEM ${index}`,
          description: `${fixture} Item Description ${index}`,
          unitOfMeasure: "Each",
        },
      }),
    );
  }
  return items;
}

type References = Awaited<ReturnType<typeof references>>;

function lifecycleFields(
  status: SupplyRequestStatus,
  changeKind: SupplyRequestVersionChangeKind,
  workDate: string,
) {
  return {
    ...(status === "FULFILLED"
      ? {
          fulfillmentOperationalWorkDate: new Date(`${workDate}T00:00:00.000Z`),
          fulfilledLocalDate: new Date(`${workDate}T00:00:00.000Z`),
          fulfilledLocalTime: "18:00",
        }
      : {}),
    ...(status === "CANCELLED"
      ? {
          cancelledLocalDate: new Date(`${workDate}T00:00:00.000Z`),
          cancelledLocalTime: "18:00",
        }
      : {}),
    ...(changeKind === "CORRECTED"
      ? {
          correctionReason: "Corrected historical record.",
          correctedByDisplayNameSnapshot: "Alain Alemany",
          correctionLocalDate: new Date(`${workDate}T00:00:00.000Z`),
          correctionLocalTime: "19:00",
        }
      : {}),
  };
}

async function createRequest(input: {
  refs: References;
  year: number;
  sequence: number;
  workDate: string;
  submittedDate?: string;
  submittedTime?: string;
  itemCount?: number;
  status?: SupplyRequestStatus;
  changeKind?: SupplyRequestVersionChangeKind;
  equipmentLabel?: string;
  equipmentNumber?: string | null;
  rootId?: string;
}) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  const rootId = input.rootId ?? `${input.refs.fixture}-request-${input.sequence}`;
  const versionId = `${rootId}-version-1`;
  const status = input.status ?? "REQUESTED";
  const changeKind = input.changeKind ?? "CREATED";
  const items = await catalogItems(rootId, input.itemCount ?? 1);
  const namReference = `SR-${input.year}-${String(input.sequence).padStart(4, "0")}`;
  await client.$transaction(async (transaction) => {
    await transaction.supplyRequest.create({
      data: {
        id: rootId,
        namReference,
        referenceYear: input.year,
        referenceSequence: input.sequence,
      },
    });
    await transaction.supplyRequestVersion.create({
      data: {
        id: versionId,
        supplyRequestId: rootId,
        versionNumber: 1,
        changeKind,
        status,
        operationalWorkDate: new Date(`${input.workDate}T00:00:00.000Z`),
        submittedLocalDate: new Date(
          `${input.submittedDate ?? input.workDate}T00:00:00.000Z`,
        ),
        submittedLocalTime: input.submittedTime ?? "08:00",
        equipmentId: input.refs.equipment.id,
        equipmentDisplayNameSnapshot:
          input.equipmentLabel ?? `${input.refs.fixture} Snapshot Equipment`,
        equipmentNumberSnapshot:
          input.equipmentNumber === undefined
            ? input.refs.equipment.equipmentNumber
            : input.equipmentNumber,
        equipmentCategorySnapshot: "DRAGLINE",
        mineNameSnapshot: `${input.refs.fixture} Snapshot Mine`,
        cityNameSnapshot: `${input.refs.fixture} Snapshot City`,
        cityStateSnapshot: "WY",
        requesterDisplayNameSnapshot: "Alain Alemany",
        requesterEmployeeNumberSnapshot: "911601",
        supervisorId: input.refs.supervisor.id,
        supervisorNameSnapshot: `${input.refs.fixture} Snapshot Supervisor`,
        supervisorEmailSnapshot: `${input.refs.fixture}@snapshot.example.com`,
        ...lifecycleFields(status, changeKind, input.workDate),
        items: {
          create: items.map((item, index) => ({
            id: `${versionId}-line-${index + 1}`,
            supplyItemId: item.id,
            sequence: index + 1,
            quantity: index + 1,
            itemNumberSnapshot: item.itemNumber,
            normalizedItemNumberSnapshot: item.normalizedItemNumber,
            descriptionSnapshot: item.description,
            unitOfMeasureSnapshot: item.unitOfMeasure,
          })),
        },
      },
    });
    await transaction.supplyRequest.update({
      where: { id: rootId },
      data: {
        currentVersion: {
          connect: { id_supplyRequestId: { id: versionId, supplyRequestId: rootId } },
        },
      },
    });
  });
  return { rootId, versionId, namReference, items };
}

async function appendVersion(input: {
  request: Awaited<ReturnType<typeof createRequest>>;
  refs: References;
  versionNumber: number;
  workDate: string;
  submittedDate?: string;
  submittedTime?: string;
  itemCount?: number;
  status: SupplyRequestStatus;
  changeKind: SupplyRequestVersionChangeKind;
  pointCurrent?: boolean;
  equipmentLabel?: string;
  supervisorLabel?: string;
}) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  const versionId = `${input.request.rootId}-version-${input.versionNumber}`;
  const additional = Math.max(0, (input.itemCount ?? 1) - input.request.items.length);
  const extraItems = additional
    ? await catalogItems(`${input.request.rootId}-v${input.versionNumber}`, additional)
    : [];
  const items = [...input.request.items, ...extraItems].slice(0, input.itemCount ?? 1);
  await client.supplyRequestVersion.create({
    data: {
      id: versionId,
      supplyRequestId: input.request.rootId,
      versionNumber: input.versionNumber,
      changeKind: input.changeKind,
      status: input.status,
      operationalWorkDate: new Date(`${input.workDate}T00:00:00.000Z`),
      submittedLocalDate: new Date(
        `${input.submittedDate ?? input.workDate}T00:00:00.000Z`,
      ),
      submittedLocalTime: input.submittedTime ?? "08:00",
      equipmentId: input.refs.equipment.id,
      equipmentDisplayNameSnapshot:
        input.equipmentLabel ?? `${input.refs.fixture} Snapshot Equipment`,
      equipmentNumberSnapshot: input.refs.equipment.equipmentNumber,
      equipmentCategorySnapshot: "DRAGLINE",
      mineNameSnapshot: `${input.refs.fixture} Snapshot Mine`,
      cityNameSnapshot: `${input.refs.fixture} Snapshot City`,
      cityStateSnapshot: "WY",
      requesterDisplayNameSnapshot: "Alain Alemany",
      requesterEmployeeNumberSnapshot: "911601",
      supervisorId: input.refs.supervisor.id,
      supervisorNameSnapshot:
        input.supervisorLabel ?? `${input.refs.fixture} Snapshot Supervisor`,
      supervisorEmailSnapshot: `${input.refs.fixture}@snapshot.example.com`,
      ...lifecycleFields(input.status, input.changeKind, input.workDate),
      items: {
        create: items.map((item, index) => ({
          id: `${versionId}-line-${index + 1}`,
          supplyItemId: item.id,
          sequence: index + 1,
          quantity: index + 1,
          itemNumberSnapshot: item.itemNumber,
          normalizedItemNumberSnapshot: item.normalizedItemNumber,
          descriptionSnapshot: item.description,
          unitOfMeasureSnapshot: item.unitOfMeasure,
        })),
      },
    },
  });
  if (input.pointCurrent !== false) {
    await client.supplyRequest.update({
      where: { id: input.request.rootId },
      data: {
        currentVersion: {
          connect: {
            id_supplyRequestId: { id: versionId, supplyRequestId: input.request.rootId },
          },
        },
      },
    });
  }
  return versionId;
}

describePostgres("Supply Request Day View PostgreSQL behavior", () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await client?.$disconnect();
  });

  it("returns one requested snapshot-first entry for exact operational-date equality without mutation", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("requested");
    await createRequest({
      refs,
      year: 7500,
      sequence: 1,
      workDate: "7500-01-30",
      submittedDate: "7500-01-31",
    });
    const exact = await createRequest({
      refs,
      year: 7500,
      sequence: 2,
      workDate: "7500-01-31",
      submittedDate: "7500-01-29",
      submittedTime: "07:15",
      itemCount: 2,
      equipmentLabel: "Immutable Dragline Snapshot",
      equipmentNumber: "133",
    });
    await createRequest({ refs, year: 7500, sequence: 3, workDate: "7500-02-01" });
    const before = await Promise.all([
      client.supplyRequest.count(),
      client.supplyRequestVersion.count(),
      client.supplyRequestVersionItem.count(),
      client.supplyRequestReferenceCounter.count(),
      client.supplyRequestDailyLogLink.count(),
      client.dailyLog.count(),
      client.dailyLogActivity.count(),
    ]);
    const entries = await getSupplyRequestDayViewItemsWithClient(client, "7500-01-31");
    expect(entries).toEqual([
      {
        supplyRequestId: exact.rootId,
        namReference: exact.namReference,
        equipmentLabel: "Immutable Dragline Snapshot · 133",
        itemCount: 2,
        supervisorName: `${refs.fixture} Snapshot Supervisor`,
        statusLabel: "Requested",
        submittedLocalDate: "7500-01-29",
        submittedLocalTime: "07:15",
        detailHref: `/supply-requests/${exact.rootId}`,
      },
    ]);
    expect(
      await Promise.all([
        client.supplyRequest.count(),
        client.supplyRequestVersion.count(),
        client.supplyRequestVersionItem.count(),
        client.supplyRequestReferenceCounter.count(),
        client.supplyRequestDailyLogLink.count(),
        client.dailyLog.count(),
        client.dailyLogActivity.count(),
      ]),
    ).toEqual(before);
  });

  it("follows the explicit pointer, moves one corrected entry, and ignores a divergent higher decoy", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("pointer");
    const request = await createRequest({
      refs,
      year: 7501,
      sequence: 1,
      workDate: "7501-03-01",
      submittedDate: "7501-02-28",
      itemCount: 2,
      equipmentLabel: "Pointer-owned Equipment",
    });
    expect(
      (await getSupplyRequestDayViewItemsWithClient(client, "7501-03-01")).map(
        (entry) => entry.supplyRequestId,
      ),
    ).toEqual([request.rootId]);
    await correctSupplyRequestWithDependencies(
      {
        supplyRequestId: request.rootId,
        expectedCurrentVersionNumber: 1,
        correctionReason: "Move the accepted operational work date.",
        operationalWorkDate: "7501-03-02",
        submittedLocalDate: "7501-02-28",
        submittedLocalTime: "08:00",
        equipmentId: refs.equipment.id,
        supervisorId: refs.supervisor.id,
        resultingStatus: "REQUESTED",
        items: request.items.map((item, index) => ({
          supplyItemId: item.id,
          quantity: index + 1,
        })),
      },
      {
        client,
        now: () => new Date("7501-03-02T15:00:00.000Z"),
      },
    );
    await appendVersion({
      request,
      refs,
      versionNumber: 99,
      workDate: "7501-03-01",
      submittedDate: "7501-03-31",
      submittedTime: "23:59",
      itemCount: 1,
      status: "CANCELLED",
      changeKind: "CORRECTED",
      pointCurrent: false,
      equipmentLabel: "Decoy Equipment",
      supervisorLabel: "Decoy Supervisor",
    });
    expect(await getSupplyRequestDayViewItemsWithClient(client, "7501-03-01")).toEqual([]);
    expect(await getSupplyRequestDayViewItemsWithClient(client, "7501-03-02")).toEqual([
      expect.objectContaining({
        supplyRequestId: request.rootId,
        statusLabel: "Requested",
        equipmentLabel: `Pointer-owned Equipment · ${refs.equipment.equipmentNumber}`,
        supervisorName: `${refs.fixture} Snapshot Supervisor`,
        itemCount: 2,
      }),
    ]);
    expect(await client.supplyRequestVersion.count({ where: { supplyRequestId: request.rootId } })).toBe(3);
    expect(
      await client.supplyRequestVersion.findUnique({
        where: { id: request.versionId },
        select: { operationalWorkDate: true },
      }),
    ).toEqual({ operationalWorkDate: new Date("7501-03-01T00:00:00.000Z") });
  });

  it("maps resulting lifecycle and corrected statuses once without lifecycle-date duplicates", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("statuses");
    const cases = [
      ["CREATED", "REQUESTED"],
      ["FULFILLED", "FULFILLED"],
      ["CANCELLED", "CANCELLED"],
      ["CORRECTED", "REQUESTED"],
      ["CORRECTED", "FULFILLED"],
      ["CORRECTED", "CANCELLED"],
    ] as const;
    for (let index = 0; index < cases.length; index += 1) {
      const [changeKind, status] = cases[index];
      await createRequest({
        refs,
        year: 7502,
        sequence: index + 1,
        workDate: "7502-04-01",
        status,
        changeKind,
      });
    }
    const lifecycle = await createRequest({
      refs,
      year: 7502,
      sequence: 7,
      workDate: "7502-04-01",
    });
    await appendVersion({
      request: lifecycle,
      refs,
      versionNumber: 2,
      workDate: "7502-04-01",
      status: "FULFILLED",
      changeKind: "FULFILLED",
    });
    const entries = await getSupplyRequestDayViewItemsWithClient(client, "7502-04-01");
    expect(entries).toHaveLength(7);
    expect(entries.map((entry) => entry.statusLabel)).toEqual([
      "Requested",
      "Fulfilled",
      "Cancelled",
      "Requested",
      "Fulfilled",
      "Cancelled",
      "Fulfilled",
    ]);
    expect(entries.filter((entry) => entry.supplyRequestId === lifecycle.rootId)).toHaveLength(1);
    const cancelled = await client.supplyRequest.findUniqueOrThrow({
      where: {
        referenceYear_referenceSequence: {
          referenceYear: 7502,
          referenceSequence: 3,
        },
      },
      select: { currentVersionId: true },
    });
    const corrected = await client.supplyRequest.findUniqueOrThrow({
      where: {
        referenceYear_referenceSequence: {
          referenceYear: 7502,
          referenceSequence: 4,
        },
      },
      select: { currentVersionId: true },
    });
    await client.supplyRequestVersion.update({
      where: { id: cancelled.currentVersionId! },
      data: { cancelledLocalDate: new Date("7502-04-02T00:00:00.000Z") },
    });
    await client.supplyRequestVersion.update({
      where: { id: corrected.currentVersionId! },
      data: { correctionLocalDate: new Date("7502-04-02T00:00:00.000Z") },
    });
    expect(await getSupplyRequestDayViewItemsWithClient(client, "7502-04-02")).toEqual([]);
  });

  it("preserves snapshot and SetNull display, current item counts, and exact database ordering", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("ordering");
    const laterDate = await createRequest({ refs, year: 7503, sequence: 4, workDate: "7503-05-01", submittedDate: "7503-04-30", submittedTime: "07:00" });
    const laterTime = await createRequest({ refs, year: 7503, sequence: 3, workDate: "7503-05-01", submittedDate: "7503-04-29", submittedTime: "09:00" });
    const referenceSecond = await createRequest({ refs, year: 7503, sequence: 2, workDate: "7503-05-01", submittedDate: "7503-04-29", submittedTime: "08:00", itemCount: 3, equipmentLabel: "Stored Equipment", equipmentNumber: "OLD-1" });
    const referenceFirst = await createRequest({ refs, year: 7503, sequence: 1, workDate: "7503-05-01", submittedDate: "7503-04-29", submittedTime: "08:00" });
    await client.equipment.update({ where: { id: refs.equipment.id }, data: { displayName: "Changed Live Equipment", equipmentNumber: "LIVE-NEW" } });
    await client.equipment.delete({ where: { id: refs.equipment.id } });
    const entries = await getSupplyRequestDayViewItemsWithClient(client, "7503-05-01");
    expect(entries.map((entry) => entry.supplyRequestId)).toEqual([
      referenceFirst.rootId,
      referenceSecond.rootId,
      laterTime.rootId,
      laterDate.rootId,
    ]);
    expect(entries[1]).toMatchObject({
      equipmentLabel: "Stored Equipment · OLD-1",
      itemCount: 3,
    });
  });

  it("keeps Daily Log narrative and explicit link state independent from the one structured entry", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("daily-log");
    const request = await createRequest({
      refs,
      year: 7504,
      sequence: 1,
      workDate: "7504-06-01",
      status: "FULFILLED",
      changeKind: "FULFILLED",
    });
    await client.supplyRequestVersion.update({
      where: { id: request.versionId },
      data: {
        fulfillmentOperationalWorkDate: new Date("7504-06-02T00:00:00.000Z"),
        fulfilledLocalDate: new Date("7504-06-02T00:00:00.000Z"),
        fulfilledLocalTime: "18:00",
      },
    });
    const dailyLogId = `${refs.fixture}-daily-log`;
    const activityId = `${refs.fixture}-activity`;
    await client.dailyLog.create({
      data: {
        id: dailyLogId,
        logDate: new Date("7504-06-02T00:00:00.000Z"),
        shift: "DAY",
        activities: {
          create: {
            id: activityId,
            activityDate: new Date("7504-06-02T00:00:00.000Z"),
            sequence: 1,
            activityType: "SUPPLY_REQUEST",
            title: `Received all supplies associated with ${request.namReference}.`,
          },
        },
      },
    });
    const baseline = await getSupplyRequestDayViewItemsWithClient(
      client,
      "7504-06-01",
    );
    await client.supplyRequestDailyLogLink.create({
      data: {
        id: `${refs.fixture}-link`,
        supplyRequestId: request.rootId,
        dailyLogActivityId: activityId,
        role: "FULFILLMENT",
      },
    });
    expect(
      await getSupplyRequestDayViewItemsWithClient(client, "7504-06-01"),
    ).toEqual(baseline);
    const submissionActivityId = `${refs.fixture}-submission-activity`;
    await client.dailyLog.create({
      data: {
        id: `${refs.fixture}-submission-daily-log`,
        logDate: new Date("7504-06-01T00:00:00.000Z"),
        shift: "DAY",
        activities: {
          create: {
            id: submissionActivityId,
            activityDate: new Date("7504-06-01T00:00:00.000Z"),
            sequence: 1,
            activityType: "SUPPLY_REQUEST",
            title: `Submitted supply request ${request.namReference} for ${refs.fixture} Snapshot Equipment · ${refs.equipment.equipmentNumber}.`,
          },
        },
      },
    });
    await client.supplyRequestDailyLogLink.create({
      data: {
        id: `${refs.fixture}-submission-link`,
        supplyRequestId: request.rootId,
        dailyLogActivityId: submissionActivityId,
        role: "SUBMISSION",
      },
    });
    expect(
      await getSupplyRequestDayViewItemsWithClient(client, "7504-06-01"),
    ).toEqual(baseline);
    await client.supplyRequestDailyLogLink.delete({
      where: { dailyLogActivityId: activityId },
    });
    expect(
      await getSupplyRequestDayViewItemsWithClient(client, "7504-06-01"),
    ).toEqual(baseline);
    await client.supplyRequestDailyLogLink.delete({
      where: { dailyLogActivityId: submissionActivityId },
    });
    expect(
      await getSupplyRequestDayViewItemsWithClient(client, "7504-06-01"),
    ).toEqual(baseline);
    expect(baseline).toEqual([
      expect.objectContaining({
        supplyRequestId: request.rootId,
        statusLabel: "Fulfilled",
      }),
    ]);
    expect(await getSupplyRequestDayViewItemsWithClient(client, "7504-06-02")).toEqual([]);
    expect(
      await client.dailyLog.findMany({
        where: { logDate: new Date("7504-06-02T00:00:00.000Z") },
        select: { id: true, activities: { select: { id: true, title: true } } },
      }),
    ).toContainEqual(
      expect.objectContaining({
        id: dailyLogId,
        activities: [
          expect.objectContaining({ id: activityId, title: expect.stringContaining(request.namReference) }),
        ],
      }),
    );
  });

  it("fails safely for selected invalid current state without letting an unrelated null pointer poison every date", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("integrity");
    const request = await createRequest({ refs, year: 7505, sequence: 1, workDate: "7505-07-01" });
    await client.supplyRequestVersion.update({ where: { id: request.versionId }, data: { submittedLocalTime: "25:00" } });
    await expect(getSupplyRequestDayViewItemsWithClient(client, "7505-07-01")).rejects.toMatchObject({ code: "INVALID_CURRENT_STATE" });
    await client.supplyRequestVersion.update({ where: { id: request.versionId }, data: { submittedLocalTime: "08:00" } });
    await client.supplyRequestVersionItem.deleteMany({ where: { versionId: request.versionId } });
    await expect(getSupplyRequestDayViewItemsWithClient(client, "7505-07-01")).rejects.toMatchObject({ code: "INVALID_CURRENT_STATE" });
    await client.supplyRequestVersionItem.create({
      data: {
        id: `${request.versionId}-restored-line`,
        versionId: request.versionId,
        supplyItemId: request.items[0].id,
        sequence: 1,
        quantity: 1,
        itemNumberSnapshot: request.items[0].itemNumber,
        normalizedItemNumberSnapshot: request.items[0].normalizedItemNumber,
        descriptionSnapshot: request.items[0].description,
        unitOfMeasureSnapshot: request.items[0].unitOfMeasure,
      },
    });
    await client.supplyRequest.create({
      data: {
        id: `${refs.fixture}-null-pointer`,
        namReference: "SR-7505-0002",
        referenceYear: 7505,
        referenceSequence: 2,
      },
    });
    await expect(
      getSupplyRequestDayViewItemsWithClient(client, "7505-07-01"),
    ).resolves.toEqual([
      expect.objectContaining({ supplyRequestId: request.rootId }),
    ]);
    await expect(
      getSupplyRequestDayViewItemsWithClient(client, "7505-07-02"),
    ).resolves.toEqual([]);
  });

  it("cleans every phase-owned fixture and creates no later-slice persistence", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    await cleanup();
    expect(await client.supplyRequest.count({ where: { referenceYear: { in: years } } })).toBe(0);
    expect(await client.supplyRequestDailyLogLink.count({ where: { supplyRequest: { referenceYear: { in: years } } } })).toBe(0);
    expect(await client.dailyLog.count({ where: { id: { startsWith: prefix } } })).toBe(0);
    expect(await client.dailyLogActivity.count({ where: { id: { startsWith: prefix } } })).toBe(0);
    expect(await client.supplyItem.count({ where: { normalizedItemNumber: { startsWith: normalizedPrefix } } })).toBe(0);
    expect(await client.supplyRequestSupervisor.count({ where: { normalizedEmail: { startsWith: prefix } } })).toBe(0);
    expect(await client.equipment.count({ where: { id: { startsWith: prefix } } })).toBe(0);
    expect(await client.mine.count({ where: { id: { startsWith: prefix } } })).toBe(0);
    expect(await client.city.count({ where: { id: { startsWith: prefix } } })).toBe(0);
  });
});
