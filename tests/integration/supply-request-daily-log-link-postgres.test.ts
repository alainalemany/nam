import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { updateDailyLogWithClient } from "@/features/daily-logs/update-persistence-internal";
import { correctSupplyRequestWithDependencies } from "@/features/supply-requests/correction-persistence-internal";
import { getSupplyRequestDailyLogLinkContextWithClient } from "@/features/supply-requests/daily-log-link-data-internal";
import { SupplyRequestDailyLogLinkError } from "@/features/supply-requests/daily-log-link-errors";
import {
  removeSupplyRequestDailyLogLinkWithDependencies,
  setSupplyRequestDailyLogLinkWithDependencies,
} from "@/features/supply-requests/daily-log-link-persistence-internal";
import { supplyRequestDailyLogCanonicalTitle } from "@/features/supply-requests/daily-log-link-validation";
import {
  cancelSupplyRequestWithDependencies,
  fulfillSupplyRequestWithDependencies,
} from "@/features/supply-requests/lifecycle-persistence-internal";
import { createSupplyRequestWithDependencies } from "@/features/supply-requests/persistence-internal";
import {
  getCurrentSupplyRequestDetailWithClient,
  getSupplyRequestCurrentPageDataWithClient,
} from "@/features/supply-requests/surface-data-internal";

const expectedDatabaseName = "nam_supply_request_test";
const prefix = "supply-link-";
const years = Array.from({ length: 80 }, (_, index) => 7400 + index);

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
    databaseName !== expectedDatabaseName
  ) {
    throw new Error(
      `Supply Request Daily Log link tests require the disposable ${expectedDatabaseName} database.`,
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
  return `${prefix}${label}-${Date.now().toString(36)}-${ordinal}`;
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
  await client.supplyItem.deleteMany({ where: { id: { startsWith: prefix } } });
  await client.supplyRequestSupervisor.deleteMany({
    where: { id: { startsWith: prefix } },
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
      displayName: `${fixture} Dragline`,
      equipmentNumber: "101",
      category: "DRAGLINE",
    },
  });
  const otherEquipment = await client.equipment.create({
    data: {
      id: `${fixture}-other-equipment`,
      mineId: mine.id,
      displayName: `${fixture} Dozer`,
      equipmentNumber: "202",
      category: "TRACTOR",
    },
  });
  const supervisor = await client.supplyRequestSupervisor.create({
    data: {
      id: `${fixture}-supervisor`,
      fullName: `${fixture} Supervisor`,
      email: `${fixture}@example.com`,
      normalizedEmail: `${fixture}@example.com`,
    },
  });
  const item = await client.supplyItem.create({
    data: {
      id: `${fixture}-item`,
      itemNumber: `${fixture}-ITEM`,
      normalizedItemNumber: `${fixture.toUpperCase()}-ITEM`,
      description: "Link test item",
      unitOfMeasure: "Each",
    },
  });
  return { fixture, city, mine, equipment, otherEquipment, supervisor, item };
}

async function request(
  year: number,
  refs: Awaited<ReturnType<typeof references>>,
) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  return createSupplyRequestWithDependencies(
    {
      operationalWorkDate: `${year}-07-30`,
      submittedLocalDate: `${year}-07-30`,
      submittedLocalTime: "08:00",
      equipmentId: refs.equipment.id,
      supervisorId: refs.supervisor.id,
      notes: "Link fixture",
      corporateSubmissionConfirmed: true,
      items: [{ supplyItemId: refs.item.id, quantity: 2 }],
    },
    { client },
  );
}

async function activity(
  refs: Awaited<ReturnType<typeof references>>,
  date: string,
  title: string,
  options: {
    activityType?: "SUPPLY_REQUEST" | "GENERAL_NOTE" | "FUEL_SERVICE";
    equipmentId?: string | null;
    activityDate?: string;
    label?: string;
  } = {},
) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  const id = `${refs.fixture}-${options.label ?? key("activity")}`;
  const dailyLog = await client.dailyLog.create({
    data: {
      id: `${id}-log`,
      logDate: new Date(`${date}T00:00:00.000Z`),
      shift: "DAY",
      mineId: refs.mine.id,
      primaryEquipmentId:
        options.equipmentId === null ? null : refs.equipment.id,
      summary: "Supply Request narrative",
      activities: {
        create: {
          id: `${id}-activity`,
          activityDate: new Date(
            `${options.activityDate ?? date}T00:00:00.000Z`,
          ),
          sequence: 1,
          activityType: options.activityType ?? "SUPPLY_REQUEST",
          title,
          equipmentId:
            options.equipmentId === undefined
              ? refs.equipment.id
              : options.equipmentId,
        },
      },
    },
    include: { activities: true },
  });
  return { dailyLog, activity: dailyLog.activities[0] };
}

async function detail(supplyRequestId: string) {
  if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
  const value = await getCurrentSupplyRequestDetailWithClient(
    client,
    supplyRequestId,
  );
  if (!value) throw new Error("Fixture current detail unavailable.");
  return value;
}

function facts(value: Awaited<ReturnType<typeof detail>>) {
  return {
    namReference: value.namReference,
    equipmentDisplayNameSnapshot: value.equipmentDisplayName,
    equipmentNumberSnapshot: value.equipmentNumber,
  };
}

async function correctionInput(
  supplyRequestId: string,
  overrides: Record<string, unknown> = {},
) {
  const current = await detail(supplyRequestId);
  return {
    supplyRequestId,
    expectedCurrentVersionNumber: current.versionNumber,
    correctionReason: "Phase 26.9 compatibility proof",
    operationalWorkDate: current.operationalWorkDate,
    submittedLocalDate: current.submittedLocalDate,
    submittedLocalTime: current.submittedLocalTime,
    equipmentId: current.equipmentId!,
    supervisorId: current.supervisorId,
    notes: current.notes ?? undefined,
    resultingStatus: current.status,
    items: current.items.map((item) => ({
      supplyItemId: item.supplyItemId,
      quantity: item.quantity,
    })),
    ...(current.status === "FULFILLED"
      ? {
          fulfillmentOperationalWorkDate:
            current.fulfillmentOperationalWorkDate!,
          fulfilledLocalDate: current.fulfilledLocalDate!,
          fulfilledLocalTime: current.fulfilledLocalTime!,
          fulfillmentNote: current.fulfillmentNote ?? undefined,
        }
      : {}),
    ...(current.status === "CANCELLED"
      ? {
          cancelledLocalDate: current.cancellationLocalDate!,
          cancelledLocalTime: current.cancellationLocalTime!,
          cancellationReason: current.cancellationReason ?? undefined,
        }
      : {}),
    ...overrides,
  };
}

describePostgres("Supply Request Daily Log Activity link PostgreSQL behavior", () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await client?.$disconnect();
  });

  it("has the approved enum, table, uniqueness, foreign keys, and cascade actions", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const activityTypes = await client.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'DailyLogActivityType'
    `;
    const roles = await client.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'SupplyRequestDailyLogRole'
      ORDER BY enumsortorder
    `;
    expect(activityTypes.map((row) => row.enumlabel)).toContain("SUPPLY_REQUEST");
    expect(roles.map((row) => row.enumlabel)).toEqual([
      "SUBMISSION",
      "FULFILLMENT",
    ]);
    const constraints = await client.$queryRaw<
      Array<{ conname: string; contype: string; delete_action: string }>
    >`
      SELECT conname, contype, confdeltype::text AS delete_action
      FROM pg_constraint
      WHERE conrelid = '"SupplyRequestDailyLogLink"'::regclass
      ORDER BY conname
    `;
    expect(constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conname: "SupplyRequestDailyLogLink_request_fkey",
          contype: "f",
          delete_action: "c",
        }),
        expect.objectContaining({
          conname: "SupplyRequestDailyLogLink_activity_fkey",
          contype: "f",
          delete_action: "c",
        }),
      ]),
    );
    const indexes = await client.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'SupplyRequestDailyLogLink'
    `;
    expect(indexes.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "SupplyRequestDailyLogLink_activity_key",
        "SupplyRequestDailyLogLink_request_role_key",
      ]),
    );
  });

  it("creates an explicit Submission link without mutating request or Activity ownership", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("submission");
    const created = await request(7400, refs);
    const current = await detail(created.supplyRequestId);
    const target = await activity(
      refs,
      "7400-07-30",
      supplyRequestDailyLogCanonicalTitle("SUBMISSION", facts(current)),
    );
    const beforeVersions = await client.supplyRequestVersion.count({
      where: { supplyRequestId: created.supplyRequestId },
    });
    const result = await setSupplyRequestDailyLogLinkWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        role: "SUBMISSION",
        dailyLogActivityId: target.activity.id,
      },
      { client },
    );
    expect(result.operation).toBe("CREATED");
    expect(
      await client.supplyRequestDailyLogLink.count({
        where: { supplyRequestId: created.supplyRequestId },
      }),
    ).toBe(1);
    expect(
      await client.supplyRequestVersion.count({
        where: { supplyRequestId: created.supplyRequestId },
      }),
    ).toBe(beforeVersions);
    const unchangedActivity = await client.dailyLogActivity.findUniqueOrThrow({
      where: { id: target.activity.id },
    });
    expect(unchangedActivity.title).toBe(target.activity.title);
    const page = await getSupplyRequestCurrentPageDataWithClient(
      client,
      created.supplyRequestId,
    );
    expect(page?.dailyLogLinks.submission?.activityId).toBe(target.activity.id);
    const source = await client.dailyLogActivity.findUniqueOrThrow({
      where: { id: target.activity.id },
      select: {
        supplyRequestLink: {
          select: {
            role: true,
            supplyRequest: { select: { id: true, namReference: true } },
          },
        },
      },
    });
    expect(source.supplyRequestLink).toMatchObject({
      role: "SUBMISSION",
      supplyRequest: {
        id: created.supplyRequestId,
        namReference: created.namReference,
      },
    });
    const duplicateTitle = await activity(
      refs,
      "7400-07-30",
      supplyRequestDailyLogCanonicalTitle("SUBMISSION", facts(current)),
      { label: "duplicate-unlinked-title" },
    );
    expect(
      await client.dailyLogActivity.findUniqueOrThrow({
        where: { id: duplicateTitle.activity.id },
        select: { supplyRequestLink: true },
      }),
    ).toEqual({ supplyRequestLink: null });
    expect(
      (await getSupplyRequestCurrentPageDataWithClient(
        client,
        created.supplyRequestId,
      ))?.dailyLogLinks.submission?.activityId,
    ).toBe(target.activity.id);
  });

  it("links Fulfillment from lifecycle and corrected-to-Fulfilled current states while rejecting ineligible status", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("fulfillment");
    const created = await request(7401, refs);
    await expect(
      getSupplyRequestDailyLogLinkContextWithClient(
        client,
        created.supplyRequestId,
        "FULFILLMENT",
      ),
    ).resolves.toMatchObject({ eligible: false });
    const ineligibleCurrent = await detail(created.supplyRequestId);
    const ineligibleTarget = await activity(
      refs,
      "7401-07-30",
      supplyRequestDailyLogCanonicalTitle(
        "FULFILLMENT",
        facts(ineligibleCurrent),
      ),
      { label: "requested-fulfillment" },
    );
    await expect(
      setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: created.supplyRequestId,
          role: "FULFILLMENT",
          dailyLogActivityId: ineligibleTarget.activity.id,
        },
        { client },
      ),
    ).rejects.toMatchObject({ code: "FULFILLMENT_UNAVAILABLE" });
    expect(
      await client.supplyRequestDailyLogLink.count({
        where: { supplyRequestId: created.supplyRequestId },
      }),
    ).toBe(0);
    await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "7401-07-31",
      },
      { client, now: () => new Date("7401-07-31T14:00:00.000Z") },
    );
    let current = await detail(created.supplyRequestId);
    const target = await activity(
      refs,
      "7401-07-31",
      supplyRequestDailyLogCanonicalTitle("FULFILLMENT", facts(current)),
      { equipmentId: null },
    );
    await expect(
      setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: created.supplyRequestId,
          role: "FULFILLMENT",
          dailyLogActivityId: target.activity.id,
        },
        { client },
      ),
    ).resolves.toMatchObject({ role: "FULFILLMENT" });

    const correctedRefs = await references("corrected-fulfilled");
    const corrected = await request(7402, correctedRefs);
    await correctSupplyRequestWithDependencies(
      await correctionInput(corrected.supplyRequestId, {
        resultingStatus: "FULFILLED",
        fulfillmentOperationalWorkDate: "7402-07-31",
        fulfilledLocalDate: "7402-07-31",
        fulfilledLocalTime: "10:00",
      }),
      { client, now: () => new Date("7402-07-31T15:00:00.000Z") },
    );
    current = await detail(corrected.supplyRequestId);
    expect(current).toMatchObject({
      changeKind: "CORRECTED",
      status: "FULFILLED",
    });
    const correctedTarget = await activity(
      correctedRefs,
      "7402-07-31",
      supplyRequestDailyLogCanonicalTitle("FULFILLMENT", facts(current)),
    );
    await expect(
      setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: corrected.supplyRequestId,
          role: "FULFILLMENT",
          dailyLogActivityId: correctedTarget.activity.id,
        },
        { client },
      ),
    ).resolves.toMatchObject({ operation: "CREATED" });
  });

  it("rejects mismatched dates, type, exact title, Equipment, and supports Equipment SetNull", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("compatibility");
    const created = await request(7403, refs);
    const current = await detail(created.supplyRequestId);
    const canonical = supplyRequestDailyLogCanonicalTitle(
      "SUBMISSION",
      facts(current),
    );
    const cases = [
      { label: "type", type: "GENERAL_NOTE" as const, title: canonical, date: "7403-07-30", equipmentId: refs.equipment.id, code: "ACTIVITY_TYPE_MISMATCH" },
      { label: "title", title: `${canonical} `, date: "7403-07-30", equipmentId: refs.equipment.id, code: "ACTIVITY_TITLE_MISMATCH" },
      { label: "activity-date", title: canonical, date: "7403-07-30", activityDate: "7403-07-31", equipmentId: refs.equipment.id, code: "ACTIVITY_DATE_MISMATCH" },
      { label: "log-date", title: canonical, date: "7403-07-31", activityDate: "7403-07-30", equipmentId: refs.equipment.id, code: "DAILY_LOG_DATE_MISMATCH" },
      { label: "equipment", title: canonical, date: "7403-07-30", equipmentId: refs.otherEquipment.id, code: "EQUIPMENT_MISMATCH" },
    ];
    for (const item of cases) {
      const target = await activity(refs, item.date, item.title, {
        label: item.label,
        activityType: item.type,
        activityDate: item.activityDate,
        equipmentId: item.equipmentId,
      });
      await expect(
        setSupplyRequestDailyLogLinkWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            role: "SUBMISSION",
            dailyLogActivityId: target.activity.id,
          },
          { client },
        ),
      ).rejects.toMatchObject({ code: item.code });
    }
    expect(
      await client.supplyRequestDailyLogLink.count({
        where: { supplyRequestId: created.supplyRequestId },
      }),
    ).toBe(0);

    await client.equipment.delete({ where: { id: refs.equipment.id } });
    const setNullDetail = await detail(created.supplyRequestId);
    expect(setNullDetail.equipmentId).toBeNull();
    const nullActivity = await activity(
      refs,
      "7403-07-30",
      supplyRequestDailyLogCanonicalTitle("SUBMISSION", facts(setNullDetail)),
      { label: "set-null-ok", equipmentId: null },
    );
    await expect(
      setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: created.supplyRequestId,
          role: "SUBMISSION",
          dailyLogActivityId: nullActivity.activity.id,
        },
        { client },
      ),
    ).resolves.toMatchObject({ operation: "CREATED" });
  });

  it("enforces role and global Activity uniqueness with atomic replacement and rollback", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("replacement");
    const created = await request(7404, refs);
    const current = await detail(created.supplyRequestId);
    const title = supplyRequestDailyLogCanonicalTitle("SUBMISSION", facts(current));
    const first = await activity(refs, "7404-07-30", title, { label: "first" });
    const second = await activity(refs, "7404-07-30", title, { label: "second" });
    await setSupplyRequestDailyLogLinkWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        role: "SUBMISSION",
        dailyLogActivityId: first.activity.id,
      },
      { client },
    );
    await expect(
      setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: created.supplyRequestId,
          role: "SUBMISSION",
          dailyLogActivityId: second.activity.id,
          expectedDailyLogActivityId: first.activity.id,
        },
        {
          client,
          afterOldLinkDeleted: () => {
            throw new Error("forced rollback after delete");
          },
        },
      ),
    ).rejects.toMatchObject({ code: "UNEXPECTED_PERSISTENCE" });
    expect(
      await client.supplyRequestDailyLogLink.findUnique({
        where: {
          supplyRequestId_role: {
            supplyRequestId: created.supplyRequestId,
            role: "SUBMISSION",
          },
        },
      }),
    ).toMatchObject({ dailyLogActivityId: first.activity.id });
    await expect(
      setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: created.supplyRequestId,
          role: "SUBMISSION",
          dailyLogActivityId: second.activity.id,
          expectedDailyLogActivityId: first.activity.id,
        },
        { client },
      ),
    ).resolves.toMatchObject({ operation: "REPLACED" });
    expect(await client.dailyLogActivity.count({ where: { id: first.activity.id } })).toBe(1);

    await client.dailyLogActivity.update({
      where: { id: second.activity.id },
      data: {
        title: supplyRequestDailyLogCanonicalTitle("FULFILLMENT", facts(current)),
      },
    });
    await expect(
      client.supplyRequestDailyLogLink.create({
        data: {
          supplyRequestId: created.supplyRequestId,
          role: "FULFILLMENT",
          dailyLogActivityId: second.activity.id,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("serializes concurrent creates and correction/link races into one compatible winner", async () => {
    if (!client || !databaseUrl) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("concurrency");
    const created = await request(7405, refs);
    const current = await detail(created.supplyRequestId);
    const title = supplyRequestDailyLogCanonicalTitle("SUBMISSION", facts(current));
    const first = await activity(refs, "7405-07-30", title, { label: "race-one" });
    const second = await activity(refs, "7405-07-30", title, { label: "race-two" });
    const left = new PrismaClient({ datasourceUrl: databaseUrl });
    const right = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const outcomes = await Promise.allSettled([
        setSupplyRequestDailyLogLinkWithDependencies(
          { supplyRequestId: created.supplyRequestId, role: "SUBMISSION", dailyLogActivityId: first.activity.id },
          { client: left },
        ),
        setSupplyRequestDailyLogLinkWithDependencies(
          { supplyRequestId: created.supplyRequestId, role: "SUBMISSION", dailyLogActivityId: second.activity.id },
          { client: right },
        ),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
      expect(
        await client.supplyRequestDailyLogLink.count({
          where: { supplyRequestId: created.supplyRequestId, role: "SUBMISSION" },
        }),
      ).toBe(1);

      const firstWinner = await client.supplyRequestDailyLogLink.findUniqueOrThrow({
        where: {
          supplyRequestId_role: {
            supplyRequestId: created.supplyRequestId,
            role: "SUBMISSION",
          },
        },
      });
      const third = await activity(refs, "7405-07-30", title, {
        label: "race-three",
      });
      const fourth = await activity(refs, "7405-07-30", title, {
        label: "race-four",
      });
      const replacements = await Promise.allSettled([
        setSupplyRequestDailyLogLinkWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            role: "SUBMISSION",
            dailyLogActivityId: third.activity.id,
            expectedDailyLogActivityId: firstWinner.dailyLogActivityId,
          },
          { client: left },
        ),
        setSupplyRequestDailyLogLinkWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            role: "SUBMISSION",
            dailyLogActivityId: fourth.activity.id,
            expectedDailyLogActivityId: firstWinner.dailyLogActivityId,
          },
          { client: right },
        ),
      ]);
      expect(
        replacements.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        replacements.filter((outcome) => outcome.status === "rejected"),
      ).toHaveLength(1);

      const replacementWinner =
        await client.supplyRequestDailyLogLink.findUniqueOrThrow({
          where: {
            supplyRequestId_role: {
              supplyRequestId: created.supplyRequestId,
              role: "SUBMISSION",
            },
          },
        });
      const fifth = await activity(refs, "7405-07-30", title, {
        label: "race-five",
      });
      const replaceRemove = await Promise.allSettled([
        setSupplyRequestDailyLogLinkWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            role: "SUBMISSION",
            dailyLogActivityId: fifth.activity.id,
            expectedDailyLogActivityId:
              replacementWinner.dailyLogActivityId,
          },
          { client: left },
        ),
        removeSupplyRequestDailyLogLinkWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            role: "SUBMISSION",
            expectedDailyLogActivityId:
              replacementWinner.dailyLogActivityId,
          },
          { client: right },
        ),
      ]);
      expect(
        replaceRemove.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        replaceRemove.filter((outcome) => outcome.status === "rejected"),
      ).toHaveLength(1);
      expect(
        await client.supplyRequestDailyLogLink.count({
          where: { supplyRequestId: created.supplyRequestId, role: "SUBMISSION" },
        }),
      ).toBeLessThanOrEqual(1);
      expect(
        await client.dailyLogActivity.count({
          where: {
            id: {
              in: [
                first.activity.id,
                second.activity.id,
                third.activity.id,
                fourth.activity.id,
                fifth.activity.id,
              ],
            },
          },
        }),
      ).toBe(5);
    } finally {
      await left.$disconnect();
      await right.$disconnect();
    }

    const raceRefs = await references("correction-race");
    const raceRequest = await request(7406, raceRefs);
    const raceDetail = await detail(raceRequest.supplyRequestId);
    const raceActivity = await activity(
      raceRefs,
      "7406-07-30",
      supplyRequestDailyLogCanonicalTitle("SUBMISSION", facts(raceDetail)),
    );
    const writerA = new PrismaClient({ datasourceUrl: databaseUrl });
    const writerB = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const outcomes = await Promise.allSettled([
        setSupplyRequestDailyLogLinkWithDependencies(
          { supplyRequestId: raceRequest.supplyRequestId, role: "SUBMISSION", dailyLogActivityId: raceActivity.activity.id },
          { client: writerA },
        ),
        correctSupplyRequestWithDependencies(
          await correctionInput(raceRequest.supplyRequestId, {
            operationalWorkDate: "7406-07-31",
          }),
          { client: writerB, now: () => new Date("7406-07-31T16:00:00.000Z") },
        ),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      const final = await detail(raceRequest.supplyRequestId);
      const link = await client.supplyRequestDailyLogLink.findUnique({
        where: { dailyLogActivityId: raceActivity.activity.id },
      });
      expect(
        (final.operationalWorkDate === "7406-07-30" && link !== null) ||
          (final.operationalWorkDate === "7406-07-31" && link === null),
      ).toBe(true);
    } finally {
      await writerA.$disconnect();
      await writerB.$disconnect();
    }
  });

  it("blocks incompatible corrections and Daily Log edits while allowing compatible narrative edits", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("compat-edits");
    const created = await request(7407, refs);
    const current = await detail(created.supplyRequestId);
    const target = await activity(
      refs,
      "7407-07-30",
      supplyRequestDailyLogCanonicalTitle("SUBMISSION", facts(current)),
    );
    await setSupplyRequestDailyLogLinkWithDependencies(
      { supplyRequestId: created.supplyRequestId, role: "SUBMISSION", dailyLogActivityId: target.activity.id },
      { client },
    );
    await expect(
      correctSupplyRequestWithDependencies(
        await correctionInput(created.supplyRequestId, {
          operationalWorkDate: "7407-07-31",
        }),
        { client },
      ),
    ).rejects.toMatchObject({ code: "SUBMISSION_LINK_CONFLICT" });
    await expect(
      correctSupplyRequestWithDependencies(
        await correctionInput(created.supplyRequestId, {
          equipmentId: refs.otherEquipment.id,
        }),
        { client },
      ),
    ).rejects.toMatchObject({ code: "SUBMISSION_LINK_CONFLICT" });
    for (const incompatible of [
      { activityType: "GENERAL_NOTE" as const },
      { title: `${target.activity.title} ` },
      { equipmentId: refs.otherEquipment.id },
    ]) {
      await expect(
        updateDailyLogWithClient(client, target.dailyLog.id, {
          logDate: new Date("7407-07-30T00:00:00.000Z"),
          shift: "DAY",
          mineId: refs.mine.id,
          primaryEquipmentId: refs.equipment.id,
          summary: "Changed summary only",
          activities: [
            {
              activityId: target.activity.id,
              activityType: "SUPPLY_REQUEST",
              title: target.activity.title,
              equipmentId: refs.equipment.id,
              ...incompatible,
            },
          ],
        }),
      ).rejects.toThrow(/remove or replace/i);
    }
    await expect(
      updateDailyLogWithClient(client, target.dailyLog.id, {
        logDate: new Date("7407-07-31T00:00:00.000Z"),
        shift: "DAY",
        mineId: refs.mine.id,
        primaryEquipmentId: refs.equipment.id,
        summary: "Changed date",
        activities: [
          {
            activityId: target.activity.id,
            activityType: "SUPPLY_REQUEST",
            title: target.activity.title,
            equipmentId: refs.equipment.id,
          },
        ],
      }),
    ).rejects.toThrow(/remove or replace/i);
    await expect(
      updateDailyLogWithClient(client, target.dailyLog.id, {
        logDate: new Date("7407-07-30T00:00:00.000Z"),
        shift: "DAY",
        mineId: refs.mine.id,
        primaryEquipmentId: refs.equipment.id,
        summary: "Compatible narrative edit",
        activities: [
          {
            activityId: target.activity.id,
            activityType: "SUPPLY_REQUEST",
            title: target.activity.title,
            equipmentId: refs.equipment.id,
            notes: "Daily Log-owned note",
          },
        ],
      }),
    ).resolves.toEqual({ dailyLogId: target.dailyLog.id });
    expect(
      await client.supplyRequestDailyLogLink.count({
        where: { supplyRequestId: created.supplyRequestId },
      }),
    ).toBe(1);
    await expect(
      correctSupplyRequestWithDependencies(
        await correctionInput(created.supplyRequestId, {
          notes: "Compatible Supply Request correction",
        }),
        { client },
      ),
    ).resolves.toMatchObject({ supplyRequestId: created.supplyRequestId });
    expect(
      await client.supplyRequestDailyLogLink.count({
        where: { supplyRequestId: created.supplyRequestId },
      }),
    ).toBe(1);

    const fuelActivity = await activity(
      refs,
      "7407-07-30",
      "Fuel service narrative",
      { activityType: "FUEL_SERVICE", label: "fuel-event-activity" },
    );
    const fuelEvent = await client.equipmentFuelEvent.create({
      data: {
        id: `${refs.fixture}-fuel-event`,
        operationalWorkDate: new Date("7407-07-30T00:00:00.000Z"),
        eventTime: "09:00",
        equipmentId: refs.equipment.id,
        equipmentDisplayName: refs.equipment.displayName,
        equipmentNumber: refs.equipment.equipmentNumber,
        equipmentCategory: refs.equipment.category,
        mineName: refs.mine.name,
        cityName: refs.city.name,
        cityState: refs.city.state,
        fuelType: "DIESEL",
        totalGallons: 100,
        dailyLogActivityId: fuelActivity.activity.id,
      },
    });
    await expect(
      updateDailyLogWithClient(client, fuelActivity.dailyLog.id, {
        logDate: new Date("7407-07-30T00:00:00.000Z"),
        shift: "DAY",
        mineId: refs.mine.id,
        primaryEquipmentId: refs.equipment.id,
        summary: "Incompatible Fuel Event Activity edit",
        activities: [
          {
            activityId: fuelActivity.activity.id,
            activityType: "GENERAL_NOTE",
            title: fuelActivity.activity.title,
            equipmentId: refs.equipment.id,
          },
        ],
      }),
    ).rejects.toThrow(/Equipment Fuel Event.*remove or replace/i);
    expect(
      await client.equipmentFuelEvent.findUniqueOrThrow({
        where: { id: fuelEvent.id },
        select: { dailyLogActivityId: true },
      }),
    ).toEqual({ dailyLogActivityId: fuelActivity.activity.id });
    expect(
      await client.dailyLogActivity.findUniqueOrThrow({
        where: { id: fuelActivity.activity.id },
        select: { activityType: true },
      }),
    ).toEqual({ activityType: "FUEL_SERVICE" });
    await client.equipmentFuelEvent.delete({ where: { id: fuelEvent.id } });
  });

  it("serializes an incompatible Activity edit against link creation", async () => {
    if (!client || !databaseUrl) {
      throw new Error("Disposable PostgreSQL client unavailable.");
    }
    const refs = await references("activity-edit-race");
    const created = await request(7413, refs);
    const current = await detail(created.supplyRequestId);
    const canonicalTitle = supplyRequestDailyLogCanonicalTitle(
      "SUBMISSION",
      facts(current),
    );
    const target = await activity(refs, "7413-07-30", canonicalTitle);
    const linkClient = new PrismaClient({ datasourceUrl: databaseUrl });
    const editClient = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const outcomes = await Promise.allSettled([
        setSupplyRequestDailyLogLinkWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            role: "SUBMISSION",
            dailyLogActivityId: target.activity.id,
          },
          { client: linkClient },
        ),
        updateDailyLogWithClient(editClient, target.dailyLog.id, {
          logDate: new Date("7413-07-30T00:00:00.000Z"),
          shift: "DAY",
          mineId: refs.mine.id,
          primaryEquipmentId: refs.equipment.id,
          summary: "Concurrent incompatible Activity edit",
          activities: [
            {
              activityId: target.activity.id,
              activityType: "SUPPLY_REQUEST",
              title: `${canonicalTitle} incompatible`,
              equipmentId: refs.equipment.id,
            },
          ],
        }),
      ]);
      expect(
        outcomes.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter((outcome) => outcome.status === "rejected"),
      ).toHaveLength(1);
      const [persistedActivity, persistedLink] = await Promise.all([
        client.dailyLogActivity.findUniqueOrThrow({
          where: { id: target.activity.id },
          select: { title: true },
        }),
        client.supplyRequestDailyLogLink.findUnique({
          where: { dailyLogActivityId: target.activity.id },
        }),
      ]);
      expect(
        (persistedLink !== null && persistedActivity.title === canonicalTitle) ||
          (persistedLink === null &&
            persistedActivity.title === `${canonicalTitle} incompatible`),
      ).toBe(true);
    } finally {
      await linkClient.$disconnect();
      await editClient.$disconnect();
    }
  });

  it("preserves the old link when a replacement target is deleted concurrently", async () => {
    if (!client || !databaseUrl) {
      throw new Error("Disposable PostgreSQL client unavailable.");
    }
    const refs = await references("activity-delete-race");
    const created = await request(7414, refs);
    const current = await detail(created.supplyRequestId);
    const canonicalTitle = supplyRequestDailyLogCanonicalTitle(
      "SUBMISSION",
      facts(current),
    );
    const oldTarget = await activity(refs, "7414-07-30", canonicalTitle, {
      label: "old-target",
    });
    const disappearingTarget = await activity(
      refs,
      "7414-07-30",
      canonicalTitle,
      { label: "disappearing-target" },
    );
    await setSupplyRequestDailyLogLinkWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        role: "SUBMISSION",
        dailyLogActivityId: oldTarget.activity.id,
      },
      { client },
    );

    const deleteClient = new PrismaClient({ datasourceUrl: databaseUrl });
    const replaceClient = new PrismaClient({ datasourceUrl: databaseUrl });
    let releaseDeletion!: () => void;
    const deletionMayCommit = new Promise<void>((resolve) => {
      releaseDeletion = resolve;
    });
    let targetLocked!: () => void;
    const targetIsLocked = new Promise<void>((resolve) => {
      targetLocked = resolve;
    });
    let rootLocked!: () => void;
    const rootIsLocked = new Promise<void>((resolve) => {
      rootLocked = resolve;
    });
    try {
      const deletion = deleteClient.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id"
          FROM "DailyLogActivity"
          WHERE "id" = ${disappearingTarget.activity.id}
          FOR UPDATE
        `;
        targetLocked();
        await deletionMayCommit;
        await transaction.dailyLogActivity.delete({
          where: { id: disappearingTarget.activity.id },
        });
      });
      await targetIsLocked;
      const replacement = setSupplyRequestDailyLogLinkWithDependencies(
        {
          supplyRequestId: created.supplyRequestId,
          role: "SUBMISSION",
          dailyLogActivityId: disappearingTarget.activity.id,
          expectedDailyLogActivityId: oldTarget.activity.id,
        },
        {
          client: replaceClient,
          afterRootLocked: () => {
            rootLocked();
          },
        },
      );
      await rootIsLocked;
      releaseDeletion();
      const outcomes = await Promise.allSettled([deletion, replacement]);
      expect(outcomes[0]?.status).toBe("fulfilled");
      expect(outcomes[1]?.status).toBe("rejected");
      expect(
        await client.supplyRequestDailyLogLink.findUniqueOrThrow({
          where: {
            supplyRequestId_role: {
              supplyRequestId: created.supplyRequestId,
              role: "SUBMISSION",
            },
          },
        }),
      ).toMatchObject({ dailyLogActivityId: oldTarget.activity.id });
      expect(
        await client.dailyLogActivity.count({
          where: { id: disappearingTarget.activity.id },
        }),
      ).toBe(0);
      expect(
        await client.dailyLogActivity.count({
          where: { id: oldTarget.activity.id },
        }),
      ).toBe(1);
    } finally {
      releaseDeletion();
      await deleteClient.$disconnect();
      await replaceClient.$disconnect();
    }
  });

  it("serializes Fulfillment linking against correction back to Requested", async () => {
    if (!client || !databaseUrl) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("fulfillment-race");
    const created = await request(7409, refs);
    await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: created.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "7409-07-31",
      },
      { client, now: () => new Date("7409-07-31T14:00:00.000Z") },
    );
    const current = await detail(created.supplyRequestId);
    const target = await activity(
      refs,
      "7409-07-31",
      supplyRequestDailyLogCanonicalTitle("FULFILLMENT", facts(current)),
      { equipmentId: null },
    );
    const fullInput = await correctionInput(created.supplyRequestId);
    const {
      fulfillmentOperationalWorkDate: _fulfillmentOperationalWorkDate,
      fulfilledLocalDate: _fulfilledLocalDate,
      fulfilledLocalTime: _fulfilledLocalTime,
      fulfillmentNote: _fulfillmentNote,
      ...requestedInput
    } = fullInput;
    const left = new PrismaClient({ datasourceUrl: databaseUrl });
    const right = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const outcomes = await Promise.allSettled([
        setSupplyRequestDailyLogLinkWithDependencies(
          {
            supplyRequestId: created.supplyRequestId,
            role: "FULFILLMENT",
            dailyLogActivityId: target.activity.id,
          },
          { client: left },
        ),
        correctSupplyRequestWithDependencies(
          { ...requestedInput, resultingStatus: "REQUESTED" },
          {
            client: right,
            now: () => new Date("7409-07-31T16:00:00.000Z"),
          },
        ),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      const final = await detail(created.supplyRequestId);
      const link = await client.supplyRequestDailyLogLink.findUnique({
        where: { dailyLogActivityId: target.activity.id },
      });
      expect(
        (final.status === "FULFILLED" && link !== null) ||
          (final.status === "REQUESTED" && link === null),
      ).toBe(true);
    } finally {
      await left.$disconnect();
      await right.$disconnect();
    }

    const compatibilityRefs = await references("fulfillment-compatibility");
    const compatible = await request(7412, compatibilityRefs);
    await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: compatible.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "7412-07-31",
      },
      { client, now: () => new Date("7412-07-31T14:00:00.000Z") },
    );
    const compatibleDetail = await detail(compatible.supplyRequestId);
    const compatibleTarget = await activity(
      compatibilityRefs,
      "7412-07-31",
      supplyRequestDailyLogCanonicalTitle(
        "FULFILLMENT",
        facts(compatibleDetail),
      ),
    );
    await setSupplyRequestDailyLogLinkWithDependencies(
      {
        supplyRequestId: compatible.supplyRequestId,
        role: "FULFILLMENT",
        dailyLogActivityId: compatibleTarget.activity.id,
      },
      { client },
    );
    const completeFulfilled = await correctionInput(compatible.supplyRequestId);
    const {
      fulfillmentOperationalWorkDate: _workDate,
      fulfilledLocalDate: _fulfilledDate,
      fulfilledLocalTime: _fulfilledTime,
      fulfillmentNote: _note,
      ...withoutFulfillment
    } = completeFulfilled;
    await expect(
      correctSupplyRequestWithDependencies(
        { ...withoutFulfillment, resultingStatus: "REQUESTED" },
        { client },
      ),
    ).rejects.toMatchObject({ code: "FULFILLMENT_LINK_CONFLICT" });
    await expect(
      correctSupplyRequestWithDependencies(
        {
          ...withoutFulfillment,
          resultingStatus: "CANCELLED",
          cancelledLocalDate: "7412-07-31",
          cancelledLocalTime: "10:00",
          cancellationReason: "Correct terminal status",
        },
        { client },
      ),
    ).rejects.toMatchObject({ code: "FULFILLMENT_LINK_CONFLICT" });
    await expect(
      correctSupplyRequestWithDependencies(
        {
          ...completeFulfilled,
          fulfillmentOperationalWorkDate: "7412-08-01",
          fulfilledLocalDate: "7412-08-01",
        },
        { client },
      ),
    ).rejects.toMatchObject({ code: "FULFILLMENT_LINK_CONFLICT" });
    await expect(
      correctSupplyRequestWithDependencies(
        {
          ...completeFulfilled,
          equipmentId: compatibilityRefs.otherEquipment.id,
        },
        { client },
      ),
    ).rejects.toMatchObject({ code: "FULFILLMENT_LINK_CONFLICT" });
    await expect(
      correctSupplyRequestWithDependencies(
        { ...completeFulfilled, notes: "Compatible fulfillment correction" },
        { client },
      ),
    ).resolves.toMatchObject({ supplyRequestId: compatible.supplyRequestId });
    expect(
      await client.supplyRequestDailyLogLink.count({
        where: { supplyRequestId: compatible.supplyRequestId },
      }),
    ).toBe(1);
  });

  it("keeps create, fulfillment, cancellation, correction, and history reads free of automatic links or Daily Logs", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("no-automatic");
    const beforeLogs = await client.dailyLog.count({
      where: { id: { startsWith: refs.fixture } },
    });
    const fulfilled = await request(7410, refs);
    await fulfillSupplyRequestWithDependencies(
      {
        supplyRequestId: fulfilled.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        fulfillmentOperationalWorkDate: "7410-07-31",
      },
      { client, now: () => new Date("7410-07-31T14:00:00.000Z") },
    );
    await correctSupplyRequestWithDependencies(
      await correctionInput(fulfilled.supplyRequestId, {
        notes: "Compatible correction with no links",
      }),
      { client, now: () => new Date("7410-07-31T15:00:00.000Z") },
    );
    await getSupplyRequestCurrentPageDataWithClient(
      client,
      fulfilled.supplyRequestId,
    );
    const cancelled = await request(7411, refs);
    await cancelSupplyRequestWithDependencies(
      {
        supplyRequestId: cancelled.supplyRequestId,
        expectedCurrentVersionNumber: 1,
        cancellationReason: "No longer needed",
      },
      { client, now: () => new Date("7411-07-30T15:00:00.000Z") },
    );
    expect(
      await client.dailyLog.count({
        where: { id: { startsWith: refs.fixture } },
      }),
    ).toBe(beforeLogs);
    expect(
      await client.supplyRequestDailyLogLink.count({
        where: {
          supplyRequestId: {
            in: [fulfilled.supplyRequestId, cancelled.supplyRequestId],
          },
        },
      }),
    ).toBe(0);
  });

  it("removes only links and preserves owner cascades without automatic creation", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client unavailable.");
    const refs = await references("cascades");
    const created = await request(7408, refs);
    const current = await detail(created.supplyRequestId);
    const target = await activity(
      refs,
      "7408-07-30",
      supplyRequestDailyLogCanonicalTitle("SUBMISSION", facts(current)),
    );
    expect(
      await client.supplyRequestDailyLogLink.count({
        where: { supplyRequestId: created.supplyRequestId },
      }),
    ).toBe(0);
    await setSupplyRequestDailyLogLinkWithDependencies(
      { supplyRequestId: created.supplyRequestId, role: "SUBMISSION", dailyLogActivityId: target.activity.id },
      { client },
    );
    await removeSupplyRequestDailyLogLinkWithDependencies(
      { supplyRequestId: created.supplyRequestId, role: "SUBMISSION", expectedDailyLogActivityId: target.activity.id },
      { client },
    );
    expect(await client.dailyLogActivity.count({ where: { id: target.activity.id } })).toBe(1);
    expect(await client.dailyLog.count({ where: { id: target.dailyLog.id } })).toBe(1);

    await setSupplyRequestDailyLogLinkWithDependencies(
      { supplyRequestId: created.supplyRequestId, role: "SUBMISSION", dailyLogActivityId: target.activity.id },
      { client },
    );
    const retainedActivity = await client.dailyLogActivity.create({
      data: {
        id: `${refs.fixture}-retained-activity`,
        dailyLogId: target.dailyLog.id,
        activityDate: target.dailyLog.logDate,
        sequence: 2,
        activityType: "GENERAL_NOTE",
        title: "Retained Daily Log narrative",
      },
    });
    await updateDailyLogWithClient(client, target.dailyLog.id, {
      logDate: target.dailyLog.logDate,
      shift: "DAY",
      mineId: refs.mine.id,
      primaryEquipmentId: refs.equipment.id,
      summary: "Supply Request narrative",
      activities: [
        {
          activityId: retainedActivity.id,
          activityType: "GENERAL_NOTE",
          title: retainedActivity.title,
        },
      ],
    });
    expect(await client.supplyRequestDailyLogLink.count({ where: { supplyRequestId: created.supplyRequestId } })).toBe(0);
    expect(await client.dailyLogActivity.count({ where: { id: target.activity.id } })).toBe(0);
    expect(await client.supplyRequest.count({ where: { id: created.supplyRequestId } })).toBe(1);

    const target2 = await activity(
      refs,
      "7408-07-30",
      supplyRequestDailyLogCanonicalTitle("SUBMISSION", facts(current)),
      { label: "daily-log-cascade" },
    );
    await setSupplyRequestDailyLogLinkWithDependencies(
      { supplyRequestId: created.supplyRequestId, role: "SUBMISSION", dailyLogActivityId: target2.activity.id },
      { client },
    );
    await client.dailyLog.delete({ where: { id: target2.dailyLog.id } });
    expect(await client.supplyRequestDailyLogLink.count({ where: { supplyRequestId: created.supplyRequestId } })).toBe(0);

    const target3 = await activity(
      refs,
      "7408-07-30",
      supplyRequestDailyLogCanonicalTitle("SUBMISSION", facts(current)),
      { label: "request-cascade" },
    );
    await setSupplyRequestDailyLogLinkWithDependencies(
      { supplyRequestId: created.supplyRequestId, role: "SUBMISSION", dailyLogActivityId: target3.activity.id },
      { client },
    );
    await client.supplyRequest.delete({ where: { id: created.supplyRequestId } });
    expect(await client.supplyRequestDailyLogLink.count({ where: { dailyLogActivityId: target3.activity.id } })).toBe(0);
    expect(await client.dailyLogActivity.count({ where: { id: target3.activity.id } })).toBe(1);
    expect(await client.dailyLog.count({ where: { id: target3.dailyLog.id } })).toBe(1);
  });
});
