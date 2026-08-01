// @vitest-environment node

import { randomUUID } from "node:crypto";

import { PrismaClient, type KnowledgeContextKind } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getKnowledgeListPageWithClient } from "@/features/knowledge-base/list-data-internal";
import type { KnowledgeListFilters } from "@/features/knowledge-base/list-params";
import { normalizeTitleKey } from "@/features/knowledge-base/normalization";
import { guardedKnowledgeBaseDatabaseUrl } from "../helpers/knowledge-base-postgres-guard";

const databaseUrl = guardedKnowledgeBaseDatabaseUrl();
const describePostgres = databaseUrl ? describe : describe.skip;
const client = databaseUrl ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
const phaseRootIds = new Set<string>();
const phaseEquipmentIds = new Set<string>();
const phaseMineIds = new Set<string>();
const phaseCityIds = new Set<string>();
let unrelatedCityId = "";

const defaults: KnowledgeListFilters = {
  lifecycle: "ACTIVE",
  sort: "UPDATED_DESC",
  page: 1,
};

type DirectContext =
  | { kind: "GENERAL" }
  | {
      kind: "MINE";
      mineId: string | null;
      mineName: string;
      cityName: string;
      cityState: string | null;
    }
  | {
      kind: "EQUIPMENT";
      equipmentId: string | null;
      mineId: string | null;
      equipmentName: string;
      equipmentNumber: string | null;
      mineName: string;
      cityName: string;
      cityState: string | null;
    };

async function createLocation(label: string) {
  if (!client) throw new Error("Missing disposable database client.");
  const key = `kb-list-${label}-${randomUUID()}`;
  const city = await client.city.create({
    data: { id: `${key}-city`, name: `${key} City`, state: "WY" },
  });
  phaseCityIds.add(city.id);
  const mine = await client.mine.create({
    data: { id: `${key}-mine`, cityId: city.id, name: `${key} Mine` },
  });
  phaseMineIds.add(mine.id);
  const equipment = await client.equipment.create({
    data: {
      id: `${key}-equipment`,
      mineId: mine.id,
      displayName: `${key} Dragline`,
      equipmentNumber: "133",
      category: "DRAGLINE",
    },
  });
  phaseEquipmentIds.add(equipment.id);
  return { city, mine, equipment };
}

async function createRecord({
  title,
  body = "Reusable field observation.",
  context = { kind: "GENERAL" } as DirectContext,
  lifecycle = "ACTIVE" as const,
  trust = "UNVERIFIED" as const,
  referenceUrl,
}: {
  title: string;
  body?: string;
  context?: DirectContext;
  lifecycle?: "ACTIVE" | "ARCHIVED";
  trust?: "UNVERIFIED" | "PERSONALLY_REVIEWED";
  referenceUrl?: string;
}) {
  if (!client) throw new Error("Missing disposable database client.");
  const rootId = randomUUID();
  const revisionId = randomUUID();
  const reviewedAt = trust === "PERSONALLY_REVIEWED" ? new Date() : null;
  const archivedAt = lifecycle === "ARCHIVED" ? new Date() : null;
  const contextKind = context.kind as KnowledgeContextKind;
  await client.$transaction(async (transaction) => {
    await transaction.knowledgeRecord.create({
      data: {
        id: rootId,
        lifecycle,
        archivedAt,
        createSubmissionKey: randomUUID(),
        createSubmissionFingerprint: "a".repeat(64),
      },
    });
    await transaction.knowledgeRecordRevision.create({
      data: {
        id: revisionId,
        knowledgeRecordId: rootId,
        revisionNumber: 1,
        origin: "INITIAL",
        contentKind: "FIELD_NOTE",
        trust,
        reviewedAt,
        title,
        normalizedTitle: normalizeTitleKey(title),
        bodyMarkdown: body,
        contextKind,
        mineId: context.kind === "GENERAL" ? null : context.mineId,
        equipmentId: context.kind === "EQUIPMENT" ? context.equipmentId : null,
        equipmentDisplayNameSnapshot:
          context.kind === "EQUIPMENT" ? context.equipmentName : null,
        equipmentNumberSnapshot:
          context.kind === "EQUIPMENT" ? context.equipmentNumber : null,
        equipmentCategorySnapshot:
          context.kind === "EQUIPMENT" ? "DRAGLINE" : null,
        mineNameSnapshot:
          context.kind === "GENERAL" ? null : context.mineName,
        cityNameSnapshot:
          context.kind === "GENERAL" ? null : context.cityName,
        cityStateSnapshot:
          context.kind === "GENERAL" ? null : context.cityState,
        externalReferences: referenceUrl
          ? {
              create: {
                sequence: 1,
                label: "External source",
                url: referenceUrl,
                normalizedUrl: referenceUrl,
              },
            }
          : undefined,
      },
    });
    await transaction.knowledgeRecord.update({
      where: { id: rootId },
      data: { currentRevisionId: revisionId },
    });
  });
  phaseRootIds.add(rootId);
  return { rootId, revisionId };
}

async function advanceCurrentRevision({
  rootId,
  origin,
  title,
  trust,
}: {
  rootId: string;
  origin: "REVISED" | "RESTORED";
  title: string;
  trust: "UNVERIFIED" | "PERSONALLY_REVIEWED";
}) {
  if (!client) throw new Error("Missing disposable database client.");
  const revisionId = randomUUID();
  await client.$transaction(async (transaction) => {
    await transaction.knowledgeRecordRevision.create({
      data: {
        id: revisionId,
        knowledgeRecordId: rootId,
        revisionNumber: 2,
        origin,
        contentKind: "FIELD_NOTE",
        trust,
        title,
        normalizedTitle: normalizeTitleKey(title),
        bodyMarkdown: "Coherent future current content.",
        contextKind: "GENERAL",
        changeSummary: origin === "REVISED" ? "Reviewed content updated" : null,
        reviewedAt: trust === "PERSONALLY_REVIEWED" ? new Date() : null,
      },
    });
    await transaction.knowledgeRecord.update({
      where: { id: rootId },
      data: { currentRevisionId: revisionId, stateVersion: { increment: 1 } },
    });
  });
}

async function cleanup() {
  if (!client) return;
  if (phaseRootIds.size) {
    await client.knowledgeRecord.deleteMany({ where: { id: { in: [...phaseRootIds] } } });
  }
  if (phaseEquipmentIds.size) {
    await client.equipment.deleteMany({ where: { id: { in: [...phaseEquipmentIds] } } });
  }
  if (phaseMineIds.size) {
    await client.mine.deleteMany({ where: { id: { in: [...phaseMineIds] } } });
  }
  if (phaseCityIds.size) {
    await client.city.deleteMany({ where: { id: { in: [...phaseCityIds] } } });
  }
  phaseRootIds.clear();
  phaseEquipmentIds.clear();
  phaseMineIds.clear();
  phaseCityIds.clear();
}

describePostgres("Knowledge Base list/search/filter PostgreSQL evidence", () => {
  beforeAll(async () => {
    if (!client) return;
    unrelatedCityId = `kb-list-unrelated-${randomUUID()}`;
    await client.city.create({
      data: { id: unrelatedCityId, name: unrelatedCityId, state: "WY" },
    });
  });

  afterEach(cleanup);

  afterAll(async () => {
    if (!client) return;
    try {
      await cleanup();
      await expect(client.city.findUnique({ where: { id: unrelatedCityId } })).resolves.not.toBeNull();
      await client.city.delete({ where: { id: unrelatedCityId } });
      await expect(client.knowledgeRecord.count()).resolves.toBe(0);
      await expect(client.knowledgeRecordRevision.count()).resolves.toBe(0);
      await expect(client.knowledgeRevisionExternalReference.count()).resolves.toBe(0);
    } finally {
      await client.$disconnect();
    }
  });

  it("lists General, Mine, Equipment, and Archived roots from explicit current pointers", async () => {
    if (!client) throw new Error("Missing client.");
    const location = await createLocation("base");
    const general = await createRecord({ title: "General record" });
    await createRecord({
      title: "Mine record",
      context: { kind: "MINE", mineId: location.mine.id, mineName: location.mine.name, cityName: location.city.name, cityState: "WY" },
    });
    await createRecord({
      title: "Equipment record",
      context: { kind: "EQUIPMENT", equipmentId: location.equipment.id, mineId: location.mine.id, equipmentName: location.equipment.displayName, equipmentNumber: "133", mineName: location.mine.name, cityName: location.city.name, cityState: "WY" },
    });
    await createRecord({ title: "Archived record", lifecycle: "ARCHIVED" });
    const revised = await createRecord({
      title: "Reviewed predecessor",
      trust: "PERSONALLY_REVIEWED",
    });
    await advanceCurrentRevision({
      rootId: revised.rootId,
      origin: "REVISED",
      title: "Revised current record",
      trust: "PERSONALLY_REVIEWED",
    });
    const restored = await createRecord({
      title: "Restored predecessor",
      trust: "PERSONALLY_REVIEWED",
    });
    await advanceCurrentRevision({
      rootId: restored.rootId,
      origin: "RESTORED",
      title: "Restored current record",
      trust: "UNVERIFIED",
    });
    await client.knowledgeRecordRevision.create({
      data: {
        knowledgeRecordId: general.rootId,
        revisionNumber: 2,
        origin: "REVISED",
        contentKind: "FIELD_NOTE",
        trust: "PERSONALLY_REVIEWED",
        title: "Higher historical decoy",
        normalizedTitle: "higher historical decoy",
        bodyMarkdown: "Historical only.",
        contextKind: "GENERAL",
        changeSummary: "Historical probe",
        reviewedAt: new Date(),
      },
    });
    const active = await getKnowledgeListPageWithClient(client, defaults);
    expect(active.rows.map((row) => row.title).sort()).toEqual([
      "Equipment record",
      "General record",
      "Mine record",
      "Restored current record",
      "Revised current record",
    ]);
    expect(active.rows.find((row) => row.id === general.rootId)?.title).toBe("General record");
    const archived = await getKnowledgeListPageWithClient(client, { ...defaults, lifecycle: "ARCHIVED" });
    expect(archived.rows.map((row) => row.title)).toEqual(["Archived record"]);
  });

  it("searches current title/body case-insensitively with literal wildcard and Unicode behavior", async () => {
    if (!client) throw new Error("Missing client.");
    const current = await createRecord({
      title: "PUMP 100%_Observation 🔧",
      body: "## Finding\n\nSeal temperature increased. ÉQUIPEMENT path \\ marker.",
      referenceUrl: "https://urlneedle.example/path",
    });
    await client.knowledgeRecordRevision.create({
      data: {
        knowledgeRecordId: current.rootId,
        revisionNumber: 2,
        origin: "REVISED",
        contentKind: "FIELD_NOTE",
        trust: "PERSONALLY_REVIEWED",
        title: "Historical Needle",
        normalizedTitle: "historical needle",
        bodyMarkdown: "Historical Needle only.",
        contextKind: "GENERAL",
        changeSummary: "Search isolation",
        reviewedAt: new Date(),
      },
    });
    expect((await getKnowledgeListPageWithClient(client, { ...defaults, q: "pump" })).matchingCount).toBe(1);
    expect((await getKnowledgeListPageWithClient(client, { ...defaults, q: "TEMPERATURE" })).matchingCount).toBe(1);
    expect((await getKnowledgeListPageWithClient(client, { ...defaults, q: "%_" })).matchingCount).toBe(1);
    expect((await getKnowledgeListPageWithClient(client, { ...defaults, q: "\\" })).matchingCount).toBe(1);
    expect((await getKnowledgeListPageWithClient(client, { ...defaults, q: "🔧" })).matchingCount).toBe(1);
    expect((await getKnowledgeListPageWithClient(client, { ...defaults, q: "équipement" })).matchingCount).toBe(1);
    expect((await getKnowledgeListPageWithClient(client, { ...defaults, q: "Historical Needle" })).matchingCount).toBe(0);
    expect((await getKnowledgeListPageWithClient(client, { ...defaults, q: "urlneedle" })).matchingCount).toBe(0);
    expect((await getKnowledgeListPageWithClient(client, defaults)).matchingCount).toBe(1);
  });

  it("combines lifecycle, kind, trust, context, Mine, and Equipment filters with AND", async () => {
    if (!client) throw new Error("Missing client.");
    const location = await createLocation("filters");
    const target = await createRecord({
      title: "Filtered target",
      context: { kind: "EQUIPMENT", equipmentId: location.equipment.id, mineId: location.mine.id, equipmentName: location.equipment.displayName, equipmentNumber: "133", mineName: location.mine.name, cityName: location.city.name, cityState: "WY" },
    });
    await client.knowledgeRecordRevision.update({
      where: { id: target.revisionId },
      data: { contentKind: "PROCEDURE", trust: "PERSONALLY_REVIEWED", reviewedAt: new Date() },
    });
    await createRecord({ title: "Nonmatching General" });
    const otherLocation = await createLocation("other-filters");
    const matching = await getKnowledgeListPageWithClient(client, {
      ...defaults,
      kind: "PROCEDURE",
      trust: "PERSONALLY_REVIEWED",
      context: "EQUIPMENT",
      mineId: location.mine.id,
      equipmentId: location.equipment.id,
    });
    expect(matching.rows.map((row) => row.id)).toEqual([target.rootId]);
    expect((await getKnowledgeListPageWithClient(client, { ...defaults, context: "MINE", equipmentId: location.equipment.id })).matchingCount).toBe(0);
    expect((await getKnowledgeListPageWithClient(client, {
      ...defaults,
      mineId: otherLocation.mine.id,
      equipmentId: location.equipment.id,
    })).matchingCount).toBe(0);
  });

  it("retains snapshot display after SetNull without matching deleted live-owner filters", async () => {
    if (!client) throw new Error("Missing client.");
    const location = await createLocation("setnull");
    const target = await createRecord({
      title: "Snapshot retained",
      context: { kind: "EQUIPMENT", equipmentId: location.equipment.id, mineId: location.mine.id, equipmentName: location.equipment.displayName, equipmentNumber: "133", mineName: location.mine.name, cityName: location.city.name, cityState: "WY" },
    });
    await client.equipment.delete({ where: { id: location.equipment.id } });
    phaseEquipmentIds.delete(location.equipment.id);
    const page = await getKnowledgeListPageWithClient(client, defaults);
    expect(page.rows.find((row) => row.id === target.rootId)).toMatchObject({
      contextAvailability: "Equipment unavailable",
    });
    expect((await getKnowledgeListPageWithClient(client, { ...defaults, equipmentId: location.equipment.id })).matchingCount).toBe(0);
  });

  it("paginates 52 roots with stable updated/ID ordering and no adjacent-page gaps", async () => {
    if (!client) throw new Error("Missing client.");
    for (let index = 0; index < 52; index += 1) {
      await createRecord({ title: `Paged record ${String(index).padStart(2, "0")}` });
    }
    await client.knowledgeRecord.updateMany({
      where: { id: { in: [...phaseRootIds] } },
      data: { updatedAt: new Date("2026-08-01T12:00:00.000Z") },
    });
    const first = await getKnowledgeListPageWithClient(client, defaults);
    const second = await getKnowledgeListPageWithClient(client, { ...defaults, page: 2 });
    expect(first).toMatchObject({ matchingCount: 52, pageCount: 2, hasNextPage: true });
    expect(first.rows).toHaveLength(50);
    expect(second.rows).toHaveLength(2);
    expect(new Set([...first.rows, ...second.rows].map((row) => row.id))).toHaveLength(52);
    expect(first.rows.map((row) => row.id)).toEqual([...first.rows.map((row) => row.id)].sort().reverse());
  });

  it("returns count-consistent empty metadata without querying unsafe out-of-range rows", async () => {
    if (!client) throw new Error("Missing client.");
    await createRecord({ title: "Only record" });
    const page = await getKnowledgeListPageWithClient(client, { ...defaults, page: 3 });
    expect(page).toMatchObject({ matchingCount: 1, pageCount: 1, page: 3, outOfRange: true, rows: [] });
  });

  it("fails safely for null authority or invalid current Markdown while ignoring non-current decoys", async () => {
    if (!client) throw new Error("Missing client.");
    const valid = await createRecord({ title: "Integrity target" });
    await client.knowledgeRecord.update({ where: { id: valid.rootId }, data: { currentRevisionId: null } });
    await expect(getKnowledgeListPageWithClient(client, defaults)).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });
    await client.knowledgeRecord.update({ where: { id: valid.rootId }, data: { currentRevisionId: valid.revisionId } });
    await client.knowledgeRecordRevision.update({ where: { id: valid.revisionId }, data: { bodyMarkdown: "# Unsafe H1" } });
    await expect(getKnowledgeListPageWithClient(client, defaults)).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });
  });

  it("cleans exact phase IDs and preserves an unrelated fixture", async () => {
    if (!client) throw new Error("Missing client.");
    const record = await createRecord({ title: "Cleanup target" });
    await cleanup();
    expect(await client.knowledgeRecord.findUnique({ where: { id: record.rootId } })).toBeNull();
    expect(await client.city.findUnique({ where: { id: unrelatedCityId } })).not.toBeNull();
  });
});
