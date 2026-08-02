// @vitest-environment node

import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getKnowledgeDetailWithClient } from "@/features/knowledge-base/data-internal";
import {
  reviewKnowledgeRecordWithDependencies,
  updateUnverifiedKnowledgeRecordWithDependencies,
} from "@/features/knowledge-base/edit-review-persistence-internal";
import {
  archiveKnowledgeRecordWithDependencies,
  deleteKnowledgeRecordWithDependencies,
  restoreKnowledgeRecordWithDependencies,
} from "@/features/knowledge-base/lifecycle-persistence-internal";
import { createKnowledgeRecordWithDependencies } from "@/features/knowledge-base/persistence-internal";
import { reviseReviewedKnowledgeRecordWithDependencies } from "@/features/knowledge-base/revision-persistence-internal";
import { isRetryableKnowledgeMutationError } from "@/features/knowledge-base/retry";
import type { KnowledgeCreateInput, KnowledgeEditInput } from "@/features/knowledge-base/types";
import { guardedKnowledgeBaseDatabaseUrl } from "../helpers/knowledge-base-postgres-guard";

const databaseUrl = guardedKnowledgeBaseDatabaseUrl();
const describePostgres = databaseUrl ? describe : describe.skip;
const client = databaseUrl ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
const ownerClient = databaseUrl ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
const roots = new Set<string>();
const dailyLogs = new Set<string>();
const defects = new Set<string>();
const equipment = new Set<string>();
const mines = new Set<string>();
const cities = new Set<string>();
let unrelatedDailyLog = "";
let unrelatedDefect = "";
let unrelatedOwners: Awaited<ReturnType<typeof ownerFixtures>> | null = null;

function baseInput(overrides: Partial<KnowledgeCreateInput> = {}): KnowledgeCreateInput {
  return {
    submissionKey: randomUUID(),
    contentKind: "FIELD_NOTE",
    title: "Relationship evidence",
    bodyMarkdown: "## Evidence\n\nRelationship transaction evidence.",
    safetyCaution: null,
    contextKind: "GENERAL",
    mineId: null,
    equipmentId: null,
    sourceDailyLogId: null,
    relatedDefectId: null,
    externalReferences: [],
    ...overrides,
  };
}

async function ownerFixtures(unrelated = false) {
  if (!client) throw new Error("Missing disposable database client.");
  const key = `kb-rel-${randomUUID()}`;
  const city = await client.city.create({ data: { id: `${key}-city`, name: `Relationship City ${key}`, state: "WY" } });
  const mine = await client.mine.create({ data: { id: `${key}-mine`, cityId: city.id, name: `Relationship Mine ${key}` } });
  const item = await client.equipment.create({ data: { id: `${key}-equipment`, mineId: mine.id, displayName: `Relationship dragline ${key}`, category: "DRAGLINE" } });
  const log = await client.dailyLog.create({ data: { id: `${key}-log`, logDate: new Date("2026-08-01T00:00:00.000Z"), shift: "NIGHT", mineId: mine.id, primaryEquipmentId: item.id } });
  const defect = await client.defect.create({ data: { id: `${key}-defect`, reportedDate: new Date("2026-07-31T00:00:00.000Z"), equipmentId: item.id, severity: "MEDIUM", priority: "MEDIUM", title: `Swing alarm ${key}`, description: "Evidence fixture" } });
  cities.add(city.id); mines.add(mine.id); equipment.add(item.id); dailyLogs.add(log.id); defects.add(defect.id);
  if (unrelated) { unrelatedDailyLog = log.id; unrelatedDefect = defect.id; }
  return { city, mine, equipment: item, dailyLog: log, defect };
}

async function create(overrides: Partial<KnowledgeCreateInput> = {}, databaseClient = client) {
  if (!databaseClient) throw new Error("Missing disposable database client.");
  const result = await createKnowledgeRecordWithDependencies(baseInput(overrides), { client: databaseClient });
  roots.add(result.knowledgeRecordId);
  return load(result.knowledgeRecordId, databaseClient);
}

async function load(id: string, databaseClient = client) {
  if (!databaseClient) throw new Error("Missing disposable database client.");
  return databaseClient.knowledgeRecord.findUniqueOrThrow({
    where: { id },
    include: {
      currentRevision: { include: { externalReferences: { orderBy: { sequence: "asc" } } } },
      revisions: { include: { externalReferences: { orderBy: { sequence: "asc" } } }, orderBy: { revisionNumber: "asc" } },
    },
  });
}

function tokens(root: Awaited<ReturnType<typeof load>>) {
  return { knowledgeRecordId: root.id, expectedStateVersion: root.stateVersion, expectedCurrentRevisionId: root.currentRevisionId! };
}

function edit(root: Awaited<ReturnType<typeof load>>, overrides: Partial<KnowledgeEditInput> = {}): KnowledgeEditInput {
  const revision = root.currentRevision!;
  return {
    ...tokens(root), contentKind: revision.contentKind, changeSummary: null,
    title: revision.title, bodyMarkdown: revision.bodyMarkdown, safetyCaution: revision.safetyCaution,
    contextKind: revision.contextKind, mineId: revision.mineId, equipmentId: revision.equipmentId,
    sourceDailyLogId: revision.sourceDailyLogId, relatedDefectId: revision.relatedDefectId,
    retainUnavailableSourceDailyLog: revision.sourceDailyLogId === null && revision.sourceDailyLogDateSnapshot !== null,
    retainUnavailableRelatedDefect: revision.relatedDefectId === null && revision.relatedDefectTitleSnapshot !== null,
    externalReferences: revision.externalReferences.map(({ label, url }) => ({ label, url })),
    ...overrides,
  };
}

function hold() {
  let reached!: () => void;
  let release!: () => void;
  const reachedPromise = new Promise<void>((resolve) => { reached = resolve; });
  const releasePromise = new Promise<void>((resolve) => { release = resolve; });
  return { reached: reachedPromise, signal: reached, release, wait: () => releasePromise };
}

function deleteRelationshipOwnersWithSignal(dailyLogId: string, defectId: string) {
  let reached!: () => void;
  const reachedPromise = new Promise<void>((resolve) => { reached = resolve; });
  const promise = ownerClient!.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "DailyLog" WHERE "id" = ${dailyLogId} FOR KEY SHARE`);
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Defect" WHERE "id" = ${defectId} FOR KEY SHARE`);
    reached();
    await transaction.dailyLog.delete({ where: { id: dailyLogId } });
    await transaction.defect.delete({ where: { id: defectId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  return { reached: reachedPromise, promise };
}

function deleteRelationshipOwnerWithSignal(
  owner: "dailyLog" | "defect",
  id: string,
) {
  let reached!: () => void;
  const reachedPromise = new Promise<void>((resolve) => { reached = resolve; });
  const promise = ownerClient!.$transaction(async (transaction) => {
    if (owner === "dailyLog") {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "DailyLog" WHERE "id" = ${id} FOR KEY SHARE`,
      );
      reached();
      await transaction.dailyLog.delete({ where: { id } });
    } else {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Defect" WHERE "id" = ${id} FOR KEY SHARE`,
      );
      reached();
      await transaction.defect.delete({ where: { id } });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  return { reached: reachedPromise, promise };
}

function expectSafeOwnerDeletionOutcome(outcome: PromiseSettledResult<unknown>) {
  if (outcome.status === "rejected") {
    expect(isRetryableKnowledgeMutationError(outcome.reason)).toBe(true);
  }
}

async function cleanup() {
  if (!client) return;
  if (roots.size) {
    await client.knowledgeRecord.updateMany({ where: { id: { in: [...roots] } }, data: { currentRevisionId: null } });
    await client.knowledgeRecord.deleteMany({ where: { id: { in: [...roots] } } });
  }
  if (defects.size) await client.defect.deleteMany({ where: { id: { in: [...defects] } } });
  if (dailyLogs.size) await client.dailyLog.deleteMany({ where: { id: { in: [...dailyLogs] } } });
  if (equipment.size) await client.equipment.deleteMany({ where: { id: { in: [...equipment] } } });
  if (mines.size) await client.mine.deleteMany({ where: { id: { in: [...mines] } } });
  if (cities.size) await client.city.deleteMany({ where: { id: { in: [...cities] } } });
  roots.clear(); defects.clear(); dailyLogs.clear(); equipment.clear(); mines.clear(); cities.clear();
}

describePostgres("Knowledge Base Daily Log and Defect relationship PostgreSQL evidence", () => {
  beforeAll(async () => {
    unrelatedOwners = await ownerFixtures(true);
    dailyLogs.delete(unrelatedOwners.dailyLog.id); defects.delete(unrelatedOwners.defect.id);
    equipment.delete(unrelatedOwners.equipment.id); mines.delete(unrelatedOwners.mine.id); cities.delete(unrelatedOwners.city.id);
  });
  afterEach(async () => {
    await cleanup();
  });
  afterAll(async () => {
    if (!client) return;
    try {
      expect(await client.dailyLog.findUnique({ where: { id: unrelatedDailyLog } })).not.toBeNull();
      expect(await client.defect.findUnique({ where: { id: unrelatedDefect } })).not.toBeNull();
      await cleanup();
      if (unrelatedOwners) {
        await client.defect.delete({ where: { id: unrelatedOwners.defect.id } });
        await client.dailyLog.delete({ where: { id: unrelatedOwners.dailyLog.id } });
        await client.equipment.delete({ where: { id: unrelatedOwners.equipment.id } });
        await client.mine.delete({ where: { id: unrelatedOwners.mine.id } });
        await client.city.delete({ where: { id: unrelatedOwners.city.id } });
      }
      expect(await client.knowledgeRecord.count()).toBe(0);
      expect(await client.knowledgeRecordRevision.count()).toBe(0);
      expect(await client.knowledgeRevisionExternalReference.count()).toBe(0);
    } finally { await ownerClient?.$disconnect(); await client.$disconnect(); }
  });

  it("verifies migration columns, SetNull foreign keys, checks, indexes, and existing-row null preservation", async () => {
    if (!client) throw new Error("Missing client.");
    const root = await create();
    expect(root.currentRevision).toMatchObject({ sourceDailyLogId: null, relatedDefectId: null });
    const metadata = await client.$queryRaw<Array<{ name: string }>>(Prisma.sql`
      SELECT conname AS name FROM pg_constraint
      WHERE conrelid = '"KnowledgeRecordRevision"'::regclass
        AND conname IN ('KnowledgeRevision_sourceDailyLog_shape_check', 'KnowledgeRevision_relatedDefect_shape_check', 'KnowledgeRecordRevision_sourceDailyLog_fkey', 'KnowledgeRecordRevision_relatedDefect_fkey')
      UNION ALL
      SELECT indexname AS name FROM pg_indexes
      WHERE tablename = 'KnowledgeRecordRevision'
        AND indexname IN ('KnowledgeRevision_sourceDailyLog_idx', 'KnowledgeRevision_relatedDefect_idx')
    `);
    expect(new Set(metadata.map(({ name }) => name))).toEqual(new Set([
      "KnowledgeRevision_sourceDailyLog_shape_check", "KnowledgeRevision_relatedDefect_shape_check",
      "KnowledgeRecordRevision_sourceDailyLog_fkey", "KnowledgeRecordRevision_relatedDefect_fkey",
      "KnowledgeRevision_sourceDailyLog_idx", "KnowledgeRevision_relatedDefect_idx",
    ]));
  });

  it("creates neither, either, or both relationships with server snapshots and idempotent fingerprints", async () => {
    const owners = await ownerFixtures();
    const cases = [
      {}, { sourceDailyLogId: owners.dailyLog.id }, { relatedDefectId: owners.defect.id },
      { sourceDailyLogId: owners.dailyLog.id, relatedDefectId: owners.defect.id },
    ];
    for (const value of cases) {
      const input = baseInput(value);
      const first = await createKnowledgeRecordWithDependencies(input, { client: client! }); roots.add(first.knowledgeRecordId);
      const duplicate = await createKnowledgeRecordWithDependencies(input, { client: client! });
      expect(duplicate).toMatchObject({ knowledgeRecordId: first.knowledgeRecordId, duplicate: true });
      const root = await load(first.knowledgeRecordId);
      expect(root.currentRevision?.sourceDailyLogId).toBe(value.sourceDailyLogId ?? null);
      expect(root.currentRevision?.relatedDefectId).toBe(value.relatedDefectId ?? null);
    }

    const replayOwners = await ownerFixtures();
    const replayInput = baseInput({
      sourceDailyLogId: replayOwners.dailyLog.id,
      relatedDefectId: replayOwners.defect.id,
      title: "Owner-independent replay",
    });
    const first = await createKnowledgeRecordWithDependencies(replayInput, { client: client! });
    roots.add(first.knowledgeRecordId);
    await client!.dailyLog.delete({ where: { id: replayOwners.dailyLog.id } });
    dailyLogs.delete(replayOwners.dailyLog.id);
    await client!.defect.delete({ where: { id: replayOwners.defect.id } });
    defects.delete(replayOwners.defect.id);
    await expect(createKnowledgeRecordWithDependencies(replayInput, { client: client! }))
      .resolves.toMatchObject({ knowledgeRecordId: first.knowledgeRecordId, duplicate: true });
  });

  it("edits relationships in place and can retain or remove a SetNull snapshot", async () => {
    const owners = await ownerFixtures();
    let root = await create();
    await updateUnverifiedKnowledgeRecordWithDependencies(edit(root, { sourceDailyLogId: owners.dailyLog.id, relatedDefectId: owners.defect.id }), { client: client! });
    root = await load(root.id);
    const revisionId = root.currentRevisionId;
    const noOpVersion = root.stateVersion;
    const noOpRootUpdatedAt = root.updatedAt.getTime();
    const noOpRevisionUpdatedAt = root.currentRevision!.updatedAt.getTime();
    await expect(updateUnverifiedKnowledgeRecordWithDependencies(edit(root), { client: client! }))
      .rejects.toMatchObject({ code: "NO_MATERIAL_CHANGE" });
    root = await load(root.id);
    expect(root.stateVersion).toBe(noOpVersion);
    expect(root.updatedAt.getTime()).toBe(noOpRootUpdatedAt);
    expect(root.currentRevision!.updatedAt.getTime()).toBe(noOpRevisionUpdatedAt);
    await client!.dailyLog.delete({ where: { id: owners.dailyLog.id } }); dailyLogs.delete(owners.dailyLog.id);
    root = await load(root.id);
    await updateUnverifiedKnowledgeRecordWithDependencies(edit(root, { title: "Retained unavailable relationship" }), { client: client! });
    root = await load(root.id);
    expect(root.currentRevisionId).toBe(revisionId);
    expect(root.currentRevision).toMatchObject({ sourceDailyLogId: null, sourceDailyLogShiftSnapshot: "NIGHT" });
    await updateUnverifiedKnowledgeRecordWithDependencies(edit(root, { sourceDailyLogId: null, retainUnavailableSourceDailyLog: false }), { client: client! });
    expect((await load(root.id)).currentRevision).toMatchObject({ sourceDailyLogId: null, sourceDailyLogDateSnapshot: null, sourceDailyLogShiftSnapshot: null });
  });

  it("treats reviewed relationship changes as material and retains the reviewed relationship row", async () => {
    const owners = await ownerFixtures();
    let root = await create({ sourceDailyLogId: owners.dailyLog.id });
    await reviewKnowledgeRecordWithDependencies(tokens(root), { client: client! });
    root = await load(root.id);
    const retained = root.currentRevision!;
    await expect(reviseReviewedKnowledgeRecordWithDependencies(edit(root, { changeSummary: "No relationship change" }), { client: client! })).rejects.toMatchObject({ code: "NO_MATERIAL_CHANGE" });
    await reviseReviewedKnowledgeRecordWithDependencies(edit(root, { relatedDefectId: owners.defect.id, changeSummary: "Link troubleshooting provenance" }), { client: client! });
    root = await load(root.id);
    expect(root.revisions).toHaveLength(2);
    expect(root.currentRevision).toMatchObject({ revisionNumber: 2, trust: "UNVERIFIED", relatedDefectId: owners.defect.id });
    expect(root.revisions[0]).toMatchObject({ id: retained.id, sourceDailyLogId: owners.dailyLog.id, relatedDefectId: null, trust: "PERSONALLY_REVIEWED" });
  });

  it("applies owner SetNull while retaining snapshots and safe unavailable presentation", async () => {
    const owners = await ownerFixtures();
    const root = await create({ sourceDailyLogId: owners.dailyLog.id, relatedDefectId: owners.defect.id });
    const before = await load(root.id);
    await client!.dailyLog.delete({ where: { id: owners.dailyLog.id } }); dailyLogs.delete(owners.dailyLog.id);
    await client!.defect.delete({ where: { id: owners.defect.id } }); defects.delete(owners.defect.id);
    const after = await load(root.id);
    expect(after.stateVersion).toBe(before.stateVersion);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    expect(after.currentRevision?.updatedAt.getTime()).toBe(before.currentRevision?.updatedAt.getTime());
    expect(after.currentRevision).toMatchObject({ sourceDailyLogId: null, sourceDailyLogShiftSnapshot: "NIGHT", relatedDefectId: null });
    const detail = await getKnowledgeDetailWithClient(client!, root.id);
    expect(detail?.relationships?.sourceDailyLog).toMatchObject({ available: false, href: null });
    expect(detail?.relationships?.relatedDefect).toMatchObject({ available: false, href: null });
  });

  it("preserves relationships through archive and both restores and preserves owners on aggregate delete", async () => {
    const owners = await ownerFixtures();
    let unverified = await create({ sourceDailyLogId: owners.dailyLog.id, relatedDefectId: owners.defect.id });
    await archiveKnowledgeRecordWithDependencies(tokens(unverified), { client: client! });
    unverified = await load(unverified.id);
    await restoreKnowledgeRecordWithDependencies(tokens(unverified), { client: client! });
    expect((await load(unverified.id)).revisions).toHaveLength(1);
    let reviewed = await create({ sourceDailyLogId: owners.dailyLog.id, relatedDefectId: owners.defect.id, title: "Reviewed relationship lifecycle" });
    await reviewKnowledgeRecordWithDependencies(tokens(reviewed), { client: client! }); reviewed = await load(reviewed.id);
    await archiveKnowledgeRecordWithDependencies(tokens(reviewed), { client: client! }); reviewed = await load(reviewed.id);
    await restoreKnowledgeRecordWithDependencies(tokens(reviewed), { client: client! }); reviewed = await load(reviewed.id);
    expect(reviewed.currentRevision).toMatchObject({ origin: "RESTORED", sourceDailyLogId: owners.dailyLog.id, relatedDefectId: owners.defect.id });
    await deleteKnowledgeRecordWithDependencies({ ...tokens(reviewed), confirmationTitle: reviewed.currentRevision!.title }, { client: client! }); roots.delete(reviewed.id);
    expect(await client!.dailyLog.findUnique({ where: { id: owners.dailyLog.id } })).not.toBeNull();
    expect(await client!.defect.findUnique({ where: { id: owners.defect.id } })).not.toBeNull();
  });

  it("forces create, edit, revision, restore, and delete overlap with owner deletion and awaits every operation", async () => {
    for (const owner of ["dailyLog", "defect"] as const) {
      const ownerOnly = await ownerFixtures();
      const barrier = hold();
      const input = owner === "dailyLog"
        ? { sourceDailyLogId: ownerOnly.dailyLog.id }
        : { relatedDefectId: ownerOnly.defect.id };
      const createOwnerOnly = createKnowledgeRecordWithDependencies(
        baseInput({ ...input, title: `Create ${owner} owner race` }),
        {
          client: client!,
          hooks: { afterRelationshipsResolved: async () => { barrier.signal(); await barrier.wait(); } },
        },
      );
      await barrier.reached;
      const ownerDeletion = deleteRelationshipOwnerWithSignal(
        owner,
        owner === "dailyLog" ? ownerOnly.dailyLog.id : ownerOnly.defect.id,
      );
      await ownerDeletion.reached;
      barrier.release();
      const [createdOwnerOnly, deletedOwnerOnly] = await Promise.allSettled([
        createOwnerOnly,
        ownerDeletion.promise,
      ]);
      expect(createdOwnerOnly.status).toBe("fulfilled");
      expectSafeOwnerDeletionOutcome(deletedOwnerOnly);
      if (createdOwnerOnly.status === "fulfilled") roots.add(createdOwnerOnly.value.knowledgeRecordId);
      if (deletedOwnerOnly.status === "fulfilled") {
        (owner === "dailyLog" ? dailyLogs : defects).delete(
          owner === "dailyLog" ? ownerOnly.dailyLog.id : ownerOnly.defect.id,
        );
      }
      if (createdOwnerOnly.status === "fulfilled") {
        const stored = await load(createdOwnerOnly.value.knowledgeRecordId);
        if (owner === "dailyLog") {
          expect(stored.currentRevision).toMatchObject(deletedOwnerOnly.status === "fulfilled"
            ? { sourceDailyLogId: null, sourceDailyLogShiftSnapshot: "NIGHT" }
            : { sourceDailyLogId: ownerOnly.dailyLog.id });
        } else {
          expect(stored.currentRevision).toMatchObject(deletedOwnerOnly.status === "fulfilled"
            ? { relatedDefectId: null, relatedDefectTitleSnapshot: ownerOnly.defect.title }
            : { relatedDefectId: ownerOnly.defect.id });
        }
      }
    }

    const createOwners = await ownerFixtures();
    const createBarrier = hold();
    const createPromise = createKnowledgeRecordWithDependencies(baseInput({ sourceDailyLogId: createOwners.dailyLog.id, relatedDefectId: createOwners.defect.id }), {
      client: client!, hooks: { afterRelationshipsResolved: async () => { createBarrier.signal(); await createBarrier.wait(); } },
    });
    await createBarrier.reached;
    const createOwnerDeletion = deleteRelationshipOwnersWithSignal(createOwners.dailyLog.id, createOwners.defect.id);
    await createOwnerDeletion.reached;
    createBarrier.release();
    const [created, deleted] = await Promise.allSettled([createPromise, createOwnerDeletion.promise]);
    expect(created.status).toBe("fulfilled");
    expectSafeOwnerDeletionOutcome(deleted);
    if (created.status === "fulfilled") roots.add(created.value.knowledgeRecordId);
    if (deleted.status === "fulfilled") { dailyLogs.delete(createOwners.dailyLog.id); defects.delete(createOwners.defect.id); }
    const createdRoot = created.status === "fulfilled" ? await load(created.value.knowledgeRecordId) : null;
    expect(createdRoot?.currentRevision).toMatchObject(deleted.status === "fulfilled"
      ? { sourceDailyLogId: null, sourceDailyLogShiftSnapshot: "NIGHT", relatedDefectId: null, relatedDefectTitleSnapshot: createOwners.defect.title }
      : { sourceDailyLogId: createOwners.dailyLog.id, relatedDefectId: createOwners.defect.id });

    const editOwners = await ownerFixtures();
    let root = await create();
    const editBarrier = hold();
    const editPromise = updateUnverifiedKnowledgeRecordWithDependencies(edit(root, { sourceDailyLogId: editOwners.dailyLog.id, relatedDefectId: editOwners.defect.id }), {
      client: client!, hooks: { afterRelationshipsResolved: async () => { editBarrier.signal(); await editBarrier.wait(); } },
    });
    await editBarrier.reached;
    const editOwnerDeletion = deleteRelationshipOwnersWithSignal(editOwners.dailyLog.id, editOwners.defect.id);
    await editOwnerDeletion.reached;
    editBarrier.release();
    const outcomes = await Promise.allSettled([editPromise, editOwnerDeletion.promise]);
    expect(outcomes[0]?.status).toBe("fulfilled");
    expectSafeOwnerDeletionOutcome(outcomes[1]!);
    if (outcomes[1]?.status === "fulfilled") { dailyLogs.delete(editOwners.dailyLog.id); defects.delete(editOwners.defect.id); }
    root = await load(root.id);
    expect(root.currentRevision).toMatchObject(outcomes[1]?.status === "fulfilled"
      ? { sourceDailyLogId: null, sourceDailyLogShiftSnapshot: "NIGHT", relatedDefectId: null, relatedDefectTitleSnapshot: editOwners.defect.title }
      : { sourceDailyLogId: editOwners.dailyLog.id, relatedDefectId: editOwners.defect.id });

    const removalOwners = await ownerFixtures();
    let removalRoot = await create({
      title: "Relationship removal owner race",
      sourceDailyLogId: removalOwners.dailyLog.id,
      relatedDefectId: removalOwners.defect.id,
    });
    const removalVersion = removalRoot.stateVersion;
    const removalBarrier = hold();
    const removalPromise = updateUnverifiedKnowledgeRecordWithDependencies(edit(removalRoot, {
      sourceDailyLogId: null,
      relatedDefectId: null,
      retainUnavailableSourceDailyLog: false,
      retainUnavailableRelatedDefect: false,
    }), {
      client: client!,
      hooks: { afterRelationshipsResolved: async () => { removalBarrier.signal(); await removalBarrier.wait(); } },
    });
    await removalBarrier.reached;
    const removalOwnerDeletion = deleteRelationshipOwnersWithSignal(
      removalOwners.dailyLog.id,
      removalOwners.defect.id,
    );
    await removalOwnerDeletion.reached;
    removalBarrier.release();
    const removalOutcomes = await Promise.allSettled([
      removalPromise,
      removalOwnerDeletion.promise,
    ]);
    expect(removalOutcomes[0]?.status).toBe("fulfilled");
    expectSafeOwnerDeletionOutcome(removalOutcomes[1]!);
    if (removalOutcomes[1]?.status === "fulfilled") {
      dailyLogs.delete(removalOwners.dailyLog.id);
      defects.delete(removalOwners.defect.id);
    }
    removalRoot = await load(removalRoot.id);
    expect(removalRoot).toMatchObject({ stateVersion: removalVersion + 1 });
    expect(removalRoot.currentRevision).toMatchObject({
      sourceDailyLogId: null,
      sourceDailyLogDateSnapshot: null,
      sourceDailyLogShiftSnapshot: null,
      relatedDefectId: null,
      relatedDefectTitleSnapshot: null,
      relatedDefectReportedDateSnapshot: null,
    });

    const revisionOwners = await ownerFixtures();
    let reviewed = await create({ title: "Reviewed owner race" });
    await reviewKnowledgeRecordWithDependencies(tokens(reviewed), { client: client! }); reviewed = await load(reviewed.id);
    const revisionBarrier = hold();
    const revisionPromise = reviseReviewedKnowledgeRecordWithDependencies(edit(reviewed, {
      sourceDailyLogId: revisionOwners.dailyLog.id, relatedDefectId: revisionOwners.defect.id,
      changeSummary: "Link race provenance",
    }), { client: client!, hooks: { afterRevisionInserted: async () => { revisionBarrier.signal(); await revisionBarrier.wait(); } } });
    await revisionBarrier.reached;
    const revisionOwnerDeletion = deleteRelationshipOwnersWithSignal(revisionOwners.dailyLog.id, revisionOwners.defect.id);
    await revisionOwnerDeletion.reached; revisionBarrier.release();
    const revisionOutcomes = await Promise.allSettled([revisionPromise, revisionOwnerDeletion.promise]);
    expect(revisionOutcomes[0]?.status).toBe("fulfilled");
    expectSafeOwnerDeletionOutcome(revisionOutcomes[1]!);
    if (revisionOutcomes[1]?.status === "fulfilled") { dailyLogs.delete(revisionOwners.dailyLog.id); defects.delete(revisionOwners.defect.id); }
    reviewed = await load(reviewed.id);
    expect(reviewed.revisions[0]).toMatchObject({ sourceDailyLogId: null, relatedDefectId: null, trust: "PERSONALLY_REVIEWED" });
    expect(reviewed.currentRevision).toMatchObject(revisionOutcomes[1]?.status === "fulfilled"
      ? { sourceDailyLogId: null, sourceDailyLogShiftSnapshot: "NIGHT", relatedDefectId: null, relatedDefectTitleSnapshot: revisionOwners.defect.title }
      : { sourceDailyLogId: revisionOwners.dailyLog.id, relatedDefectId: revisionOwners.defect.id });

    const restoreOwners = await ownerFixtures();
    let archived = await create({ title: "Restore owner race", sourceDailyLogId: restoreOwners.dailyLog.id, relatedDefectId: restoreOwners.defect.id });
    await reviewKnowledgeRecordWithDependencies(tokens(archived), { client: client! }); archived = await load(archived.id);
    await archiveKnowledgeRecordWithDependencies(tokens(archived), { client: client! }); archived = await load(archived.id);
    const restoreBarrier = hold();
    const restorePromise = restoreKnowledgeRecordWithDependencies(tokens(archived), {
      client: client!, fault: async (point) => { if (point === "RESTORE_AFTER_REVISION") { restoreBarrier.signal(); await restoreBarrier.wait(); } },
    });
    await restoreBarrier.reached;
    const restoreOwnerDeletion = deleteRelationshipOwnersWithSignal(restoreOwners.dailyLog.id, restoreOwners.defect.id);
    await restoreOwnerDeletion.reached; restoreBarrier.release();
    const restoreOutcomes = await Promise.allSettled([restorePromise, restoreOwnerDeletion.promise]);
    expect(restoreOutcomes[0]?.status).toBe("fulfilled");
    expectSafeOwnerDeletionOutcome(restoreOutcomes[1]!);
    if (restoreOutcomes[1]?.status === "fulfilled") { dailyLogs.delete(restoreOwners.dailyLog.id); defects.delete(restoreOwners.defect.id); }
    archived = await load(archived.id);
    expect(archived.currentRevision).toMatchObject(restoreOutcomes[1]?.status === "fulfilled"
      ? { origin: "RESTORED", sourceDailyLogId: null, sourceDailyLogShiftSnapshot: "NIGHT", relatedDefectId: null, relatedDefectTitleSnapshot: restoreOwners.defect.title }
      : { origin: "RESTORED", sourceDailyLogId: restoreOwners.dailyLog.id, relatedDefectId: restoreOwners.defect.id });

    const deleteOwners = await ownerFixtures();
    const doomed = await create({ title: "Delete owner race", sourceDailyLogId: deleteOwners.dailyLog.id, relatedDefectId: deleteOwners.defect.id });
    const deleteBarrier = hold();
    const deletePromise = deleteKnowledgeRecordWithDependencies({ ...tokens(doomed), confirmationTitle: doomed.currentRevision!.title }, {
      client: client!, fault: async (point) => { if (point === "DELETE_AFTER_LOCKS") { deleteBarrier.signal(); await deleteBarrier.wait(); } },
    });
    await deleteBarrier.reached;
    const deleteOwnerDeletion = deleteRelationshipOwnersWithSignal(deleteOwners.dailyLog.id, deleteOwners.defect.id);
    await deleteOwnerDeletion.reached; deleteBarrier.release();
    const deleteOutcomes = await Promise.allSettled([deletePromise, deleteOwnerDeletion.promise]);
    expect(deleteOutcomes[0]?.status).toBe("fulfilled");
    expectSafeOwnerDeletionOutcome(deleteOutcomes[1]!);
    roots.delete(doomed.id);
    if (deleteOutcomes[1]?.status === "fulfilled") { dailyLogs.delete(deleteOwners.dailyLog.id); defects.delete(deleteOwners.defect.id); }
    expect(await client!.knowledgeRecord.findUnique({ where: { id: doomed.id } })).toBeNull();
  }, 30_000);

  it("rolls back relationship creation faults and rejects partial persisted snapshot shapes", async () => {
    const owners = await ownerFixtures();
    const input = baseInput({ sourceDailyLogId: owners.dailyLog.id, relatedDefectId: owners.defect.id });
    await expect(createKnowledgeRecordWithDependencies(input, {
      client: client!, hooks: { afterRelationshipsResolved: async () => { throw new Error("relationship fault"); } },
    })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
    expect(await client!.knowledgeRecord.findUnique({ where: { createSubmissionKey: input.submissionKey } })).toBeNull();
    const root = await create();
    await expect(client!.$executeRaw(Prisma.sql`
      UPDATE "KnowledgeRecordRevision"
      SET "sourceDailyLogDateSnapshot" = DATE '2026-08-01'
      WHERE "id" = CAST(${root.currentRevisionId} AS uuid)
    `)).rejects.toBeTruthy();
    await expect(client!.$executeRaw(Prisma.sql`
      UPDATE "KnowledgeRecordRevision"
      SET "relatedDefectTitleSnapshot" = ${"x".repeat(201)},
          "relatedDefectReportedDateSnapshot" = DATE '2026-08-01'
      WHERE "id" = CAST(${root.currentRevisionId} AS uuid)
    `)).rejects.toBeTruthy();
    await expect(client!.$executeRaw(Prisma.sql`
      UPDATE "KnowledgeRecordRevision"
      SET "relatedDefectTitleSnapshot" = '   ',
          "relatedDefectReportedDateSnapshot" = DATE '2026-08-01'
      WHERE "id" = CAST(${root.currentRevisionId} AS uuid)
    `)).rejects.toBeTruthy();
    await client!.$executeRaw(Prisma.sql`
      UPDATE "KnowledgeRecordRevision"
      SET "relatedDefectTitleSnapshot" = 'Deleted defect snapshot',
          "relatedDefectReportedDateSnapshot" = DATE '2026-08-01'
      WHERE "id" = CAST(${root.currentRevisionId} AS uuid)
    `);
    expect((await getKnowledgeDetailWithClient(client!, root.id))?.relationships?.relatedDefect)
      .toMatchObject({ available: false, href: null, title: "Deleted defect snapshot" });
    await client!.$executeRaw(Prisma.sql`
      UPDATE "KnowledgeRecordRevision"
      SET "relatedDefectTitleSnapshot" = NULL,
          "relatedDefectReportedDateSnapshot" = NULL
      WHERE "id" = CAST(${root.currentRevisionId} AS uuid)
    `);

    const editRootBefore = await load(root.id);
    await expect(updateUnverifiedKnowledgeRecordWithDependencies(
      edit(editRootBefore, {
        sourceDailyLogId: owners.dailyLog.id,
        relatedDefectId: owners.defect.id,
      }),
      {
        client: client!,
        hooks: { afterRevisionUpdated: async () => { throw new Error("edit relationship fault"); } },
      },
    )).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
    const editRootAfter = await load(root.id);
    expect(editRootAfter.stateVersion).toBe(editRootBefore.stateVersion);
    expect(editRootAfter.currentRevision).toMatchObject({
      sourceDailyLogId: null,
      sourceDailyLogDateSnapshot: null,
      relatedDefectId: null,
      relatedDefectTitleSnapshot: null,
    });

    await reviewKnowledgeRecordWithDependencies(tokens(editRootAfter), { client: client! });
    const reviewedBefore = await load(root.id);
    await expect(reviseReviewedKnowledgeRecordWithDependencies(
      edit(reviewedBefore, {
        sourceDailyLogId: owners.dailyLog.id,
        relatedDefectId: owners.defect.id,
        changeSummary: "Relationship rollback probe",
      }),
      {
        client: client!,
        hooks: { afterRevisionInserted: async () => { throw new Error("revision relationship fault"); } },
      },
    )).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
    const reviewedAfter = await load(root.id);
    expect(reviewedAfter.stateVersion).toBe(reviewedBefore.stateVersion);
    expect(reviewedAfter.currentRevisionId).toBe(reviewedBefore.currentRevisionId);
    expect(reviewedAfter.revisions).toHaveLength(1);
  });
});
