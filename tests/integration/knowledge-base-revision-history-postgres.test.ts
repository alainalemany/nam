// @vitest-environment node

import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getKnowledgeDetailWithClient } from "@/features/knowledge-base/data-internal";
import {
  reviewKnowledgeRecordWithDependencies,
  updateUnverifiedKnowledgeRecordWithDependencies,
} from "@/features/knowledge-base/edit-review-persistence-internal";
import {
  getKnowledgeHistoricalRevisionWithClient,
  getKnowledgeHistoryWithClient,
} from "@/features/knowledge-base/history-data-internal";
import { createKnowledgeRecordWithDependencies } from "@/features/knowledge-base/persistence-internal";
import {
  reviseReviewedKnowledgeRecordWithDependencies,
  type KnowledgeRevisionHooks,
} from "@/features/knowledge-base/revision-persistence-internal";
import type { KnowledgeCreateInput, KnowledgeEditInput } from "@/features/knowledge-base/types";
import { guardedKnowledgeBaseDatabaseUrl } from "../helpers/knowledge-base-postgres-guard";

const databaseUrl = guardedKnowledgeBaseDatabaseUrl();
const describePostgres = databaseUrl ? describe : describe.skip;
const client = databaseUrl ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
const concurrentClient = databaseUrl ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
const phaseRootIds = new Set<string>();
const phaseCityIds = new Set<string>();
const phaseMineIds = new Set<string>();
const phaseEquipmentIds = new Set<string>();
let unrelatedCityId = "";

function createInput(overrides: Partial<KnowledgeCreateInput> = {}): KnowledgeCreateInput {
  return {
    submissionKey: randomUUID(),
    contentKind: "FIELD_NOTE",
    title: "Reviewed field observation",
    bodyMarkdown: "## Observation\n\nOriginal reviewed body.",
    safetyCaution: null,
    contextKind: "GENERAL",
    mineId: null,
    equipmentId: null,
    externalReferences: [{ label: "Original source", url: "https://example.com/original" }],
    ...overrides,
  };
}

async function aggregate(id: string, databaseClient = client) {
  if (!databaseClient) throw new Error("Disposable client unavailable.");
  return databaseClient.knowledgeRecord.findUniqueOrThrow({
    where: { id },
    include: {
      currentRevision: { include: { externalReferences: { orderBy: { sequence: "asc" } } } },
      revisions: { include: { externalReferences: { orderBy: { sequence: "asc" } } }, orderBy: { revisionNumber: "asc" } },
    },
  });
}

async function createReviewed(overrides: Partial<KnowledgeCreateInput> = {}) {
  if (!client) throw new Error("Disposable client unavailable.");
  const created = await createKnowledgeRecordWithDependencies(createInput(overrides), { client });
  phaseRootIds.add(created.knowledgeRecordId);
  const root = await aggregate(created.knowledgeRecordId);
  await reviewKnowledgeRecordWithDependencies({
    knowledgeRecordId: root.id,
    expectedStateVersion: root.stateVersion,
    expectedCurrentRevisionId: root.currentRevisionId!,
  }, { client });
  return aggregate(root.id);
}

function revisionInput(root: Awaited<ReturnType<typeof aggregate>>, overrides: Partial<KnowledgeEditInput> = {}): KnowledgeEditInput {
  return {
    knowledgeRecordId: root.id,
    expectedStateVersion: root.stateVersion,
    expectedCurrentRevisionId: root.currentRevisionId!,
    contentKind: "PROCEDURE",
    changeSummary: "Converted the reviewed observation into a procedure.",
    title: "Current procedure",
    bodyMarkdown: "## Procedure\n\nCurrent revised body.",
    safetyCaution: "Verify isolation.",
    contextKind: "GENERAL",
    mineId: null,
    equipmentId: null,
    externalReferences: [
      { label: "Replacement A", url: "https://example.com/replacement-a" },
      { label: "Replacement B", url: "https://example.com/replacement-b" },
    ],
    ...overrides,
  };
}

function exactReviewedInput(root: Awaited<ReturnType<typeof aggregate>>): KnowledgeEditInput {
  const revision = root.currentRevision!;
  return {
    knowledgeRecordId: root.id,
    expectedStateVersion: root.stateVersion,
    expectedCurrentRevisionId: revision.id,
    contentKind: revision.contentKind,
    changeSummary: "This summary must not force a duplicate revision.",
    title: revision.title,
    bodyMarkdown: revision.bodyMarkdown,
    safetyCaution: revision.safetyCaution,
    contextKind: revision.contextKind,
    mineId: revision.contextKind === "MINE" ? revision.mineId : null,
    equipmentId: revision.contextKind === "EQUIPMENT" ? revision.equipmentId : null,
    externalReferences: revision.externalReferences.map(({ label, url }) => ({ label, url })),
  };
}

function twoPartyBarrier() {
  let arrivals = 0;
  let release: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  return async () => {
    arrivals += 1;
    if (arrivals === 2) release?.();
    await ready;
  };
}

async function location(label: string) {
  if (!client) throw new Error("Disposable client unavailable.");
  const key = `kb-history-${label}-${randomUUID()}`;
  const city = await client.city.create({ data: { id: `${key}-city`, name: `${key} City`, state: "WY" } });
  phaseCityIds.add(city.id);
  const mine = await client.mine.create({ data: { id: `${key}-mine`, cityId: city.id, name: `${key} Mine`, status: "ACTIVE" } });
  phaseMineIds.add(mine.id);
  const equipment = await client.equipment.create({ data: { id: `${key}-equipment`, mineId: mine.id, displayName: `${key} Dragline`, equipmentNumber: "133", category: "DRAGLINE", status: "ACTIVE" } });
  phaseEquipmentIds.add(equipment.id);
  return { city, mine, equipment };
}

async function cleanup() {
  if (!client) return;
  if (phaseRootIds.size) await client.knowledgeRecord.deleteMany({ where: { id: { in: [...phaseRootIds] } } });
  if (phaseEquipmentIds.size) await client.equipment.deleteMany({ where: { id: { in: [...phaseEquipmentIds] } } });
  if (phaseMineIds.size) await client.mine.deleteMany({ where: { id: { in: [...phaseMineIds] } } });
  if (phaseCityIds.size) await client.city.deleteMany({ where: { id: { in: [...phaseCityIds] } } });
  phaseRootIds.clear();
  phaseEquipmentIds.clear();
  phaseMineIds.clear();
  phaseCityIds.clear();
}

describePostgres("Knowledge Base reviewed revision and retained-history PostgreSQL evidence", () => {
  beforeAll(async () => {
    if (!client) return;
    unrelatedCityId = `kb-history-unrelated-${randomUUID()}`;
    await client.city.create({ data: { id: unrelatedCityId, name: unrelatedCityId, state: "WY" } });
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
      await concurrentClient?.$disconnect();
      await client.$disconnect();
    }
  });

  it("creates one new current Unverified revision and retains reviewed history unchanged", async () => {
    if (!client || !concurrentClient) throw new Error("Missing clients.");
    const reviewed = await createReviewed();
    const retainedBefore = reviewed.revisions[0]!;
    let inserted: (() => void) | undefined;
    let release: (() => void) | undefined;
    const insertionReached = new Promise<void>((resolve) => { inserted = resolve; });
    const mayCommit = new Promise<void>((resolve) => { release = resolve; });
    const inFlight = reviseReviewedKnowledgeRecordWithDependencies(revisionInput(reviewed), {
      client,
      hooks: { afterRevisionInserted: async () => { inserted?.(); await mayCommit; } },
    });
    await insertionReached;
    const during = await getKnowledgeHistoryWithClient(concurrentClient, reviewed.id);
    expect(during?.revisions.map(({ revisionNumber, isCurrent }) => ({ revisionNumber, isCurrent }))).toEqual([{ revisionNumber: 1, isCurrent: true }]);
    release?.();
    const result = await inFlight;
    const completed = await aggregate(reviewed.id);
    expect(result).toMatchObject({ stateVersion: 3, revisionNumber: 2, duplicate: false });
    expect(completed).toMatchObject({ id: reviewed.id, stateVersion: 3, currentRevisionId: completed.revisions[1]!.id });
    expect(completed.revisions).toHaveLength(2);
    expect(completed.revisions[0]).toEqual(retainedBefore);
    expect(completed.currentRevision).toMatchObject({ revisionNumber: 2, origin: "REVISED", trust: "UNVERIFIED", reviewedAt: null, contentKind: "PROCEDURE" });
    const detail = await getKnowledgeDetailWithClient(client, reviewed.id);
    expect(detail).toMatchObject({ revisionNumber: 2, title: "Current procedure", trust: "UNVERIFIED" });
  });

  it("treats normalized equivalent reviewed material as a no-op without timestamp drift", async () => {
    if (!client) throw new Error("Missing client.");
    const reviewed = await createReviewed();
    const before = await aggregate(reviewed.id);
    await expect(reviseReviewedKnowledgeRecordWithDependencies(exactReviewedInput(reviewed), { client })).rejects.toMatchObject({ code: "NO_MATERIAL_CHANGE" });
    const after = await aggregate(reviewed.id);
    expect(after.currentRevisionId).toBe(before.currentRevisionId);
    expect(after.stateVersion).toBe(before.stateVersion);
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(after.revisions).toEqual(before.revisions);
  });

  it("changes Unverified kind in place and reviewed kind through a new retained revision", async () => {
    if (!client) throw new Error("Missing client.");
    const created = await createKnowledgeRecordWithDependencies(createInput(), { client });
    phaseRootIds.add(created.knowledgeRecordId);
    const initial = await aggregate(created.knowledgeRecordId);
    await updateUnverifiedKnowledgeRecordWithDependencies(revisionInput(initial, {
      contentKind: "REFERENCE",
      changeSummary: null,
      expectedStateVersion: 1,
      title: initial.currentRevision!.title,
      bodyMarkdown: initial.currentRevision!.bodyMarkdown,
      safetyCaution: initial.currentRevision!.safetyCaution,
      externalReferences: initial.currentRevision!.externalReferences.map(({ label, url }) => ({ label, url })),
    }), { client });
    const inPlace = await aggregate(initial.id);
    expect(inPlace).toMatchObject({ currentRevisionId: initial.currentRevisionId, stateVersion: 2 });
    expect(inPlace.currentRevision).toMatchObject({ revisionNumber: 1, contentKind: "REFERENCE", trust: "UNVERIFIED" });
    await reviewKnowledgeRecordWithDependencies({ knowledgeRecordId: inPlace.id, expectedStateVersion: 2, expectedCurrentRevisionId: inPlace.currentRevisionId! }, { client });
    const reviewed = await aggregate(inPlace.id);
    await reviseReviewedKnowledgeRecordWithDependencies(revisionInput(reviewed, { contentKind: "SAFETY_REMINDER" }), { client });
    const revised = await aggregate(inPlace.id);
    expect(revised.revisions.map(({ contentKind }) => contentKind)).toEqual(["REFERENCE", "SAFETY_REMINDER"]);
    expect(revised.currentRevision).toMatchObject({ contentKind: "SAFETY_REMINDER", trust: "UNVERIFIED" });
  });

  it("retains server-derived Equipment snapshots and independent ordered references", async () => {
    if (!client) throw new Error("Missing client.");
    const owners = await location("context");
    const reviewed = await createReviewed();
    await reviseReviewedKnowledgeRecordWithDependencies(revisionInput(reviewed, {
      contextKind: "EQUIPMENT",
      mineId: null,
      equipmentId: owners.equipment.id,
      externalReferences: [
        { label: "Second", url: "https://example.com/second" },
        { label: "First", url: "https://example.com/first" },
      ],
    }), { client });
    const completed = await aggregate(reviewed.id);
    expect(completed.currentRevision).toMatchObject({
      contextKind: "EQUIPMENT",
      equipmentId: owners.equipment.id,
      mineId: owners.mine.id,
      equipmentDisplayNameSnapshot: owners.equipment.displayName,
      mineNameSnapshot: owners.mine.name,
      cityNameSnapshot: owners.city.name,
    });
    expect(completed.currentRevision!.externalReferences.map(({ sequence, label }) => ({ sequence, label }))).toEqual([{ sequence: 1, label: "Second" }, { sequence: 2, label: "First" }]);
    expect(completed.revisions[0]!.externalReferences).toEqual(reviewed.revisions[0]!.externalReferences);
  });

  it("serializes competing reviewed revisions to one winner with no duplicate revision", async () => {
    if (!client || !concurrentClient) throw new Error("Missing clients.");
    const reviewed = await createReviewed();
    const barrier = twoPartyBarrier();
    const hooks: KnowledgeRevisionHooks = { beforeRootLock: async () => barrier() };
    const outcomes = await Promise.allSettled([
      reviseReviewedKnowledgeRecordWithDependencies(revisionInput(reviewed, { title: "Winning candidate A" }), { client, hooks }),
      reviseReviewedKnowledgeRecordWithDependencies(revisionInput(reviewed, { title: "Winning candidate B" }), { client: concurrentClient, hooks }),
    ]);
    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const loser = outcomes.find(({ status }) => status === "rejected") as PromiseRejectedResult;
    expect(["CONCURRENT_MODIFICATION", "CURRENT_AUTHORITY_CHANGED"]).toContain(loser.reason.code);
    const completed = await aggregate(reviewed.id);
    expect(completed.revisions).toHaveLength(2);
    expect(completed.stateVersion).toBe(3);
    expect(["Winning candidate A", "Winning candidate B"]).toContain(completed.currentRevision!.title);

    const identicalStart = await createReviewed({ title: "Identical race" });
    const identicalBarrier = twoPartyBarrier();
    const identicalInput = revisionInput(identicalStart, { title: "Identical revised material" });
    const identical = await Promise.allSettled([
      reviseReviewedKnowledgeRecordWithDependencies(identicalInput, { client, hooks: { beforeRootLock: async () => identicalBarrier() } }),
      reviseReviewedKnowledgeRecordWithDependencies(identicalInput, { client: concurrentClient, hooks: { beforeRootLock: async () => identicalBarrier() } }),
    ]);
    expect(identical.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect((await aggregate(identicalStart.id)).revisions).toHaveLength(2);

    const unverifiedCreated = await createKnowledgeRecordWithDependencies(createInput({ title: "Kind review race" }), { client });
    phaseRootIds.add(unverifiedCreated.knowledgeRecordId);
    const unverified = await aggregate(unverifiedCreated.knowledgeRecordId);
    const kindReviewBarrier = twoPartyBarrier();
    const kindEdit = revisionInput(unverified, {
      expectedStateVersion: 1,
      contentKind: "REFERENCE",
      changeSummary: null,
      title: unverified.currentRevision!.title,
      bodyMarkdown: unverified.currentRevision!.bodyMarkdown,
      safetyCaution: null,
      externalReferences: unverified.currentRevision!.externalReferences.map(({ label, url }) => ({ label, url })),
    });
    const kindReview = await Promise.allSettled([
      updateUnverifiedKnowledgeRecordWithDependencies(kindEdit, { client, hooks: { beforeRootLock: async () => kindReviewBarrier() } }),
      reviewKnowledgeRecordWithDependencies({ knowledgeRecordId: unverified.id, expectedStateVersion: 1, expectedCurrentRevisionId: unverified.currentRevisionId! }, { client: concurrentClient, hooks: { beforeRootLock: async () => kindReviewBarrier() } }),
    ]);
    expect(kindReview.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const kindReviewCompleted = await aggregate(unverified.id);
    expect(kindReviewCompleted.stateVersion).toBe(2);
    expect([
      ["REFERENCE", "UNVERIFIED"],
      ["FIELD_NOTE", "PERSONALLY_REVIEWED"],
    ]).toContainEqual([kindReviewCompleted.currentRevision!.contentKind, kindReviewCompleted.currentRevision!.trust]);

    const staleStart = await createReviewed({ title: "Stale reviewed revision" });
    await expect(reviseReviewedKnowledgeRecordWithDependencies(revisionInput(staleStart, {
      expectedStateVersion: staleStart.stateVersion - 1,
    }), { client })).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    await expect(reviseReviewedKnowledgeRecordWithDependencies(revisionInput(staleStart, {
      expectedCurrentRevisionId: randomUUID(),
    }), { client })).rejects.toMatchObject({ code: "CURRENT_AUTHORITY_CHANGED" });
    expect((await aggregate(staleStart.id)).revisions).toHaveLength(1);

    const pointerStart = await createReviewed({ title: "Pointer-change reviewed revision" });
    const stalePointerInput = revisionInput(pointerStart);
    const replacement = await client.knowledgeRecordRevision.create({
      data: {
        knowledgeRecordId: pointerStart.id,
        revisionNumber: 2,
        origin: "REVISED",
        contentKind: "FIELD_NOTE",
        trust: "UNVERIFIED",
        title: "Replacement authority",
        normalizedTitle: "replacement authority",
        bodyMarkdown: "## Replacement\n\nPointer race fixture.",
        contextKind: "GENERAL",
        changeSummary: "Advanced authority before the stale submission.",
      },
    });
    await client.knowledgeRecord.update({
      where: { id: pointerStart.id },
      data: { currentRevisionId: replacement.id, stateVersion: { increment: 1 } },
    });
    await expect(reviseReviewedKnowledgeRecordWithDependencies(
      stalePointerInput,
      { client },
    )).rejects.toMatchObject({ code: "CURRENT_AUTHORITY_CHANGED" });
    expect((await aggregate(pointerStart.id)).revisions).toHaveLength(2);
  });

  it("rolls back every reviewed-revision fault point without orphan history or timestamp drift", async () => {
    if (!client) throw new Error("Missing client.");
    const hookNames = ["afterRevisionInserted", "afterReferencesInserted", "afterPointerAdvanced", "afterRootUpdated", "beforeCommit"] as const;
    for (const hookName of hookNames) {
      const reviewed = await createReviewed({ title: `Rollback ${hookName}` });
      const before = await aggregate(reviewed.id);
      const hooks: KnowledgeRevisionHooks = { [hookName]: async () => { throw new Error(`fault:${hookName}`); } };
      await expect(reviseReviewedKnowledgeRecordWithDependencies(revisionInput(reviewed), { client, hooks })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
      const after = await aggregate(reviewed.id);
      expect(after).toEqual(before);
      expect(after.revisions).toHaveLength(1);
    }
  });

  it("serves stable history routes from explicit authority and fails corrupt history safely", async () => {
    if (!client) throw new Error("Missing client.");
    const reviewed = await createReviewed();
    await reviseReviewedKnowledgeRecordWithDependencies(revisionInput(reviewed), { client });
    const history = await getKnowledgeHistoryWithClient(client, reviewed.id);
    expect(history?.revisions.map(({ revisionNumber, isCurrent }) => ({ revisionNumber, isCurrent }))).toEqual([{ revisionNumber: 2, isCurrent: true }, { revisionNumber: 1, isCurrent: false }]);
    expect(await getKnowledgeHistoricalRevisionWithClient(client, reviewed.id, "1")).toMatchObject({ recordId: reviewed.id, revisionNumber: 1, isCurrent: false });
    expect(await getKnowledgeHistoricalRevisionWithClient(client, reviewed.id, "99")).toBeNull();
    const completed = await aggregate(reviewed.id);
    await client.knowledgeRecord.update({ where: { id: reviewed.id }, data: { currentRevisionId: null } });
    await expect(getKnowledgeHistoryWithClient(client, reviewed.id)).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });
    await client.knowledgeRecord.update({ where: { id: reviewed.id }, data: { currentRevisionId: completed.currentRevisionId } });
    await client.knowledgeRecordRevision.update({ where: { id: completed.revisions[0]!.id }, data: { bodyMarkdown: "# Invalid H1" } });
    await expect(getKnowledgeHistoryWithClient(client, reviewed.id)).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });
    await client.knowledgeRecordRevision.update({
      where: { id: completed.revisions[0]!.id },
      data: {
        bodyMarkdown: reviewed.revisions[0]!.bodyMarkdown,
        trust: "UNVERIFIED",
        reviewedAt: null,
      },
    });
    await expect(getKnowledgeHistoryWithClient(client, reviewed.id)).rejects.toMatchObject({
      code: "PERSISTED_STATE_INTEGRITY_FAILURE",
    });
    await expect(getKnowledgeDetailWithClient(client, reviewed.id)).rejects.toMatchObject({
      code: "PERSISTED_STATE_INTEGRITY_FAILURE",
    });
    await client.knowledgeRecordRevision.update({
      where: { id: completed.revisions[0]!.id },
      data: {
        trust: "PERSONALLY_REVIEWED",
        reviewedAt: reviewed.revisions[0]!.reviewedAt,
      },
    });
    const collision = await createReviewed({ title: "Revision collision guard" });
    await expect(client.knowledgeRecordRevision.create({
      data: {
        knowledgeRecordId: collision.id,
        revisionNumber: 1,
        origin: "INITIAL",
        contentKind: "FIELD_NOTE",
        trust: "UNVERIFIED",
        title: "Duplicate revision number",
        normalizedTitle: "duplicate revision number",
        bodyMarkdown: "Duplicate revision number fixture.",
        contextKind: "GENERAL",
      },
    })).rejects.toMatchObject({ code: "P2002" });
    expect((await aggregate(collision.id)).revisions).toHaveLength(1);
  });

  it("preserves an unrelated fixture and uses exact phase-owned cleanup boundaries", async () => {
    if (!client) throw new Error("Missing client.");
    await createReviewed({ title: "Cleanup-owned record" });
    expect(await client.city.findUnique({ where: { id: unrelatedCityId } })).not.toBeNull();
    expect(phaseRootIds.size).toBe(1);
  });
});
