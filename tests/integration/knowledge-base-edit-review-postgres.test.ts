// @vitest-environment node

import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  reviewKnowledgeRecordWithDependencies,
  updateUnverifiedKnowledgeRecordWithDependencies,
  type KnowledgeEditReviewHooks,
} from "@/features/knowledge-base/edit-review-persistence-internal";
import {
  createKnowledgeRecordWithDependencies,
} from "@/features/knowledge-base/persistence-internal";
import type {
  KnowledgeCreateInput,
  KnowledgeEditInput,
  KnowledgeReviewInput,
} from "@/features/knowledge-base/types";
import { guardedKnowledgeBaseDatabaseUrl } from "../helpers/knowledge-base-postgres-guard";

const databaseUrl = guardedKnowledgeBaseDatabaseUrl();
const describePostgres = databaseUrl ? describe : describe.skip;
const client = databaseUrl ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
const concurrentClient = databaseUrl ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
const phaseRootIds = new Set<string>();
const phaseEquipmentIds = new Set<string>();
const phaseMineIds = new Set<string>();
const phaseCityIds = new Set<string>();
let unrelatedCityId = "";

function createInput(overrides: Partial<KnowledgeCreateInput> = {}): KnowledgeCreateInput {
  return {
    submissionKey: randomUUID(),
    contentKind: "FIELD_NOTE",
    title: "Editable observation",
    bodyMarkdown: "## Observation\n\nOriginal body.",
    safetyCaution: null,
    contextKind: "GENERAL",
    mineId: null,
    equipmentId: null,
    externalReferences: [
      { label: "Original A", url: "https://example.com/original-a" },
      { label: "Original B", url: "https://example.com/original-b" },
    ],
    ...overrides,
  };
}

async function create(input = createInput()) {
  if (!client) throw new Error("Disposable Knowledge Base database is unavailable.");
  const result = await createKnowledgeRecordWithDependencies(input, { client });
  phaseRootIds.add(result.knowledgeRecordId);
  return result.knowledgeRecordId;
}

async function current(id: string) {
  if (!client) throw new Error("Disposable Knowledge Base database is unavailable.");
  return client.knowledgeRecord.findUniqueOrThrow({
    where: { id },
    include: {
      currentRevision: { include: { externalReferences: { orderBy: { sequence: "asc" } } } },
      revisions: { orderBy: { revisionNumber: "asc" } },
    },
  });
}

function immutableReviewMaterial(root: Awaited<ReturnType<typeof current>>) {
  const revision = root.currentRevision;
  if (!revision) throw new Error("Fixture current revision is missing.");
  return {
    id: revision.id,
    knowledgeRecordId: revision.knowledgeRecordId,
    revisionNumber: revision.revisionNumber,
    origin: revision.origin,
    contentKind: revision.contentKind,
    title: revision.title,
    normalizedTitle: revision.normalizedTitle,
    bodyMarkdown: revision.bodyMarkdown,
    safetyCaution: revision.safetyCaution,
    contextKind: revision.contextKind,
    mineId: revision.mineId,
    equipmentId: revision.equipmentId,
    equipmentDisplayNameSnapshot: revision.equipmentDisplayNameSnapshot,
    equipmentNumberSnapshot: revision.equipmentNumberSnapshot,
    equipmentCategorySnapshot: revision.equipmentCategorySnapshot,
    mineNameSnapshot: revision.mineNameSnapshot,
    cityNameSnapshot: revision.cityNameSnapshot,
    cityStateSnapshot: revision.cityStateSnapshot,
    changeSummary: revision.changeSummary,
    createdAt: revision.createdAt,
    externalReferences: revision.externalReferences.map(
      ({ sequence, label, url, normalizedUrl }) => ({
        sequence,
        label,
        url,
        normalizedUrl,
      }),
    ),
  };
}

function editInput(
  root: Awaited<ReturnType<typeof current>>,
  overrides: Partial<KnowledgeEditInput> = {},
): KnowledgeEditInput {
  if (!root.currentRevisionId) throw new Error("Fixture current pointer is missing.");
  return {
    knowledgeRecordId: root.id,
    expectedStateVersion: root.stateVersion,
    expectedCurrentRevisionId: root.currentRevisionId,
    contentKind: root.currentRevision?.contentKind ?? "FIELD_NOTE",
    changeSummary: null,
    title: "Updated observation",
    bodyMarkdown: "## Observation\n\nUpdated body.",
    safetyCaution: "Verify isolation.",
    contextKind: "GENERAL",
    mineId: null,
    equipmentId: null,
    externalReferences: [
      { label: "Replacement", url: "https://example.com/replacement" },
    ],
    ...overrides,
  };
}

function reviewInput(root: Awaited<ReturnType<typeof current>>): KnowledgeReviewInput {
  if (!root.currentRevisionId) throw new Error("Fixture current pointer is missing.");
  return {
    knowledgeRecordId: root.id,
    expectedStateVersion: root.stateVersion,
    expectedCurrentRevisionId: root.currentRevisionId,
  };
}

async function edit(
  input: KnowledgeEditInput,
  hooks: KnowledgeEditReviewHooks = {},
  databaseClient = client,
) {
  if (!databaseClient) throw new Error("Disposable Knowledge Base database is unavailable.");
  return updateUnverifiedKnowledgeRecordWithDependencies(input, {
    client: databaseClient,
    hooks,
  });
}

async function review(
  input: KnowledgeReviewInput,
  hooks: KnowledgeEditReviewHooks = {},
  databaseClient = client,
) {
  if (!databaseClient) throw new Error("Disposable Knowledge Base database is unavailable.");
  return reviewKnowledgeRecordWithDependencies(input, {
    client: databaseClient,
    hooks,
  });
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

async function createLocation(label: string) {
  if (!client) throw new Error("Disposable Knowledge Base database is unavailable.");
  const key = `kb-edit-${label}-${randomUUID()}`;
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

describePostgres("Knowledge Base Unverified edit and personal-review PostgreSQL evidence", () => {
  beforeAll(async () => {
    if (!client) return;
    unrelatedCityId = `kb-edit-unrelated-${randomUUID()}`;
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

  it("edits one Unverified revision in place across General, Mine, and Equipment contexts", async () => {
    if (!client) throw new Error("Missing client");
    const location = await createLocation("contexts");
    const id = await create();
    const initial = await current(id);
    const revisionId = initial.currentRevisionId;
    await edit(editInput(initial, {
      contextKind: "MINE",
      mineId: location.mine.id,
      equipmentId: null,
      title: "Mine observation",
      safetyCaution: "Add caution.",
    }));
    const mine = await current(id);
    expect(mine).toMatchObject({ id, currentRevisionId: revisionId, stateVersion: 2 });
    expect(mine.currentRevision).toMatchObject({
      id: revisionId,
      revisionNumber: 1,
      origin: "INITIAL",
      trust: "UNVERIFIED",
      reviewedAt: null,
      contextKind: "MINE",
      mineId: location.mine.id,
      mineNameSnapshot: location.mine.name,
      cityNameSnapshot: location.city.name,
    });
    await edit(editInput(mine, {
      contextKind: "EQUIPMENT",
      mineId: null,
      equipmentId: location.equipment.id,
      title: "Equipment observation",
      safetyCaution: "Changed caution.",
    }));
    const equipment = await current(id);
    expect(equipment.currentRevision).toMatchObject({
      id: revisionId,
      contextKind: "EQUIPMENT",
      equipmentId: location.equipment.id,
      mineId: location.mine.id,
      equipmentDisplayNameSnapshot: location.equipment.displayName,
      equipmentCategorySnapshot: "DRAGLINE",
    });
    await edit(editInput(equipment, {
      contextKind: "GENERAL",
      mineId: null,
      equipmentId: null,
      safetyCaution: null,
    }));
    const general = await current(id);
    expect(general).toMatchObject({ id, currentRevisionId: revisionId, stateVersion: 4 });
    expect(general.revisions).toHaveLength(1);
    expect(general.currentRevision).toMatchObject({ contextKind: "GENERAL", mineId: null, equipmentId: null, safetyCaution: null });

    const ambiguousId = await create();
    const ambiguous = await current(ambiguousId);
    await expect(edit(editInput(ambiguous, { title: "Ambiguous committed edit" }), {
      afterCommit: async () => { throw new Error("ambiguous edit outcome"); },
    })).resolves.toMatchObject({ stateVersion: 2, duplicate: true });

    const retainedLocation = await createLocation("retained-context");
    const retainedId = await create(createInput({
      contextKind: "MINE",
      mineId: retainedLocation.mine.id,
      equipmentId: null,
    }));
    const retained = await current(retainedId);
    await client.mine.update({ where: { id: retainedLocation.mine.id }, data: { status: "INACTIVE" } });
    await edit(editInput(retained, {
      contextKind: "MINE",
      mineId: retainedLocation.mine.id,
      equipmentId: null,
      title: "Edit with retained inactive Mine",
    }));
    expect((await current(retainedId)).currentRevision).toMatchObject({
      mineId: retainedLocation.mine.id,
      mineNameSnapshot: retainedLocation.mine.name,
    });

    const deletedLocation = await createLocation("snapshot-only");
    const snapshotId = await create(createInput({
      contextKind: "EQUIPMENT",
      mineId: null,
      equipmentId: deletedLocation.equipment.id,
    }));
    await client.equipment.delete({ where: { id: deletedLocation.equipment.id } });
    phaseEquipmentIds.delete(deletedLocation.equipment.id);
    const snapshotOnly = await current(snapshotId);
    expect(snapshotOnly.currentRevision?.equipmentId).toBeNull();
    await edit(editInput(snapshotOnly, {
      contextKind: "EQUIPMENT",
      mineId: null,
      equipmentId: null,
      title: "Edit with retained Equipment snapshot",
    }));
    expect((await current(snapshotId)).currentRevision).toMatchObject({
      contextKind: "EQUIPMENT",
      equipmentId: null,
      equipmentDisplayNameSnapshot: deletedLocation.equipment.displayName,
    });
  });

  it("atomically replaces, reorders, and removes the complete external-reference set", async () => {
    if (!client) throw new Error("Missing client");
    const id = await create();
    const initial = await current(id);
    await edit(editInput(initial, { externalReferences: [
      { label: "Third", url: "https://example.com/third" },
      { label: "First", url: "https://example.com/first" },
      { label: "Second", url: "https://example.com/second" },
    ] }));
    const replaced = await current(id);
    expect(replaced.currentRevision?.externalReferences.map(({ sequence, label }) => ({ sequence, label }))).toEqual([
      { sequence: 1, label: "Third" },
      { sequence: 2, label: "First" },
      { sequence: 3, label: "Second" },
    ]);
    const beforeFault = replaced.currentRevision?.externalReferences.map(({ label, url }) => ({ label, url }));
    await expect(edit(editInput(replaced), {
      afterReferencesDeleted: async (transaction) => {
        await transaction.knowledgeRevisionExternalReference.create({
          data: {
            knowledgeRecordRevisionId: replaced.currentRevisionId!,
            sequence: 0,
            label: "Invalid",
            url: "https://example.com/invalid",
            normalizedUrl: "https://example.com/invalid",
          },
        });
      },
    })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
    const rolledBack = await current(id);
    expect(rolledBack.stateVersion).toBe(2);
    expect(rolledBack.currentRevision?.externalReferences.map(({ label, url }) => ({ label, url }))).toEqual(beforeFault);
    await expect(edit(editInput(rolledBack, { externalReferences: [
      { label: "A", url: "https://example.com/same" },
      { label: "B", url: "https://example.com/same" },
    ] }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await edit(editInput(rolledBack, { externalReferences: [] }));
    expect((await current(id)).currentRevision?.externalReferences).toHaveLength(0);
  });

  it("personally reviews without changing material and makes the revision read-only", async () => {
    if (!client) throw new Error("Missing client");
    const id = await create();
    const before = await current(id);
    const material = immutableReviewMaterial(before);
    const input = reviewInput(before);
    const first = await review(input);
    expect(first).toMatchObject({ stateVersion: 2, duplicate: false });
    const reviewed = await current(id);
    expect(reviewed.currentRevision).toMatchObject({ trust: "PERSONALLY_REVIEWED" });
    expect(reviewed.currentRevision?.reviewedAt).toBeInstanceOf(Date);
    expect(immutableReviewMaterial(reviewed)).toEqual(material);
    await expect(review(input)).resolves.toMatchObject({ stateVersion: 2, duplicate: true });
    await expect(edit(editInput({ ...reviewed, stateVersion: 2 }))).rejects.toMatchObject({ code: "RECORD_NOT_EDITABLE" });

    const ambiguousId = await create();
    const ambiguous = await current(ambiguousId);
    await expect(review(reviewInput(ambiguous), {
      afterCommit: async () => { throw new Error("ambiguous review outcome"); },
    })).resolves.toMatchObject({ stateVersion: 2, duplicate: true });

    const changedAfterCommitId = await create();
    const changedAfterCommit = await current(changedAfterCommitId);
    await expect(review(reviewInput(changedAfterCommit), {
      afterCommit: async () => {
        await client.knowledgeRecordRevision.update({
          where: { id: changedAfterCommit.currentRevisionId! },
          data: {
            title: "Unrelated post-review mutation",
            normalizedTitle: "unrelated post-review mutation",
          },
        });
        throw new Error("ambiguous review with unrelated mutation");
      },
    })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
  });

  it("rejects stale state, changed current authority, and archived roots without lost updates", async () => {
    if (!client) throw new Error("Missing client");
    const id = await create();
    const initial = await current(id);
    await edit(editInput(initial, { title: "Winner" }));
    await expect(edit(editInput(initial, { title: "Stale loser" }))).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    await expect(review(reviewInput(initial))).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    expect((await current(id)).currentRevision?.title).toBe("Winner");

    const changedId = await create();
    const changed = await current(changedId);
    const reviewedAt = new Date();
    await client.knowledgeRecordRevision.update({
      where: { id: changed.currentRevisionId! },
      data: { trust: "PERSONALLY_REVIEWED", reviewedAt },
    });
    const decoy = await client.knowledgeRecordRevision.create({
      data: {
        knowledgeRecordId: changedId,
        revisionNumber: 2,
        origin: "REVISED",
        contentKind: "FIELD_NOTE",
        trust: "UNVERIFIED",
        title: "New authority",
        normalizedTitle: "new authority",
        bodyMarkdown: "New authority",
        contextKind: "GENERAL",
        changeSummary: "Authority probe",
      },
    });
    await client.knowledgeRecord.update({ where: { id: changedId }, data: { currentRevisionId: decoy.id, stateVersion: { increment: 1 } } });
    await expect(edit(editInput(changed))).rejects.toMatchObject({ code: "CURRENT_AUTHORITY_CHANGED" });
    await expect(review(reviewInput(changed))).rejects.toMatchObject({ code: "CURRENT_AUTHORITY_CHANGED" });

    const archivedId = await create();
    const archived = await current(archivedId);
    await client.knowledgeRecord.update({ where: { id: archivedId }, data: { lifecycle: "ARCHIVED", archivedAt: new Date(), stateVersion: { increment: 1 } } });
    await expect(edit(editInput(archived))).rejects.toMatchObject({ code: "RECORD_NOT_EDITABLE" });
    await expect(review(reviewInput(archived))).rejects.toMatchObject({ code: "RECORD_NOT_EDITABLE" });
    const archivedAfter = await current(archivedId);
    expect(archivedAfter.stateVersion).toBe(2);
    expect(immutableReviewMaterial(archivedAfter)).toEqual(immutableReviewMaterial(archived));
  });

  it("serializes edit/edit, edit/review, and review/review races with separate clients", async () => {
    if (!client || !concurrentClient) throw new Error("Missing clients");
    const editRaceId = await create();
    const editRace = await current(editRaceId);
    const editBarrier = twoPartyBarrier();
    const editOutcomes = await Promise.allSettled([
      edit(editInput(editRace, { title: "Edit A" }), { beforeRootLock: editBarrier }, client),
      edit(editInput(editRace, { title: "Edit B" }), { beforeRootLock: editBarrier }, concurrentClient),
    ]);
    expect(editOutcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect((editOutcomes.find((outcome) => outcome.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    const editRaceResult = await current(editRaceId);
    expect(editRaceResult.stateVersion).toBe(2);
    expect(["Edit A", "Edit B"]).toContain(editRaceResult.currentRevision?.title);
    expect(editRaceResult.currentRevision?.externalReferences.map(({ label }) => label)).toEqual(["Replacement"]);

    const mixedId = await create();
    const mixed = await current(mixedId);
    const mixedBarrier = twoPartyBarrier();
    const mixedOutcomes = await Promise.allSettled([
      edit(editInput(mixed, { title: "Edit winner candidate" }), { beforeRootLock: mixedBarrier }, client),
      review(reviewInput(mixed), { beforeRootLock: mixedBarrier }, concurrentClient),
    ]);
    expect(mixedOutcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const mixedRejected = (mixedOutcomes.find((outcome) => outcome.status === "rejected") as PromiseRejectedResult).reason;
    expect(["CONCURRENT_MODIFICATION", "RECORD_NOT_EDITABLE"]).toContain(mixedRejected.code);
    const mixedResult = await current(mixedId);
    expect(mixedResult.stateVersion).toBe(2);
    if (mixedResult.currentRevision?.trust === "PERSONALLY_REVIEWED") {
      expect(mixedResult.currentRevision.title).toBe("Editable observation");
      expect(mixedResult.currentRevision.externalReferences.map(({ label }) => label)).toEqual(["Original A", "Original B"]);
    } else {
      expect(mixedResult.currentRevision?.title).toBe("Edit winner candidate");
      expect(mixedResult.currentRevision?.externalReferences.map(({ label }) => label)).toEqual(["Replacement"]);
    }

    const reviewRaceId = await create();
    const reviewRace = await current(reviewRaceId);
    const reviewBarrier = twoPartyBarrier();
    const reviewOutcomes = await Promise.all([
      review(reviewInput(reviewRace), { beforeRootLock: reviewBarrier }, client),
      review(reviewInput(reviewRace), { beforeRootLock: reviewBarrier }, concurrentClient),
    ]);
    expect(reviewOutcomes.map((outcome) => outcome.knowledgeRecordId)).toEqual([reviewRaceId, reviewRaceId]);
    expect(reviewOutcomes.filter((outcome) => outcome.duplicate)).toHaveLength(1);
    const reviewRaceResult = await current(reviewRaceId);
    expect(reviewRaceResult.stateVersion).toBe(2);
    expect(reviewRaceResult.currentRevision).toMatchObject({
      trust: "PERSONALLY_REVIEWED",
      reviewedAt: expect.any(Date),
    });
  });

  it("holds context-owner protection through edit commit during deletion and deactivation races", async () => {
    if (!client || !concurrentClient) throw new Error("Missing clients");
    const location = await createLocation("owner-race");
    const id = await create();
    const initial = await current(id);
    let lockHeldResolve: (() => void) | undefined;
    let releaseResolve: (() => void) | undefined;
    const lockHeld = new Promise<void>((resolve) => { lockHeldResolve = resolve; });
    const release = new Promise<void>((resolve) => { releaseResolve = resolve; });
    const editPromise = edit(editInput(initial, {
      contextKind: "EQUIPMENT",
      equipmentId: location.equipment.id,
      mineId: null,
    }), {
      afterContextResolved: async () => {
        lockHeldResolve?.();
        await release;
      },
    });
    await lockHeld;
    const deletePromise = concurrentClient.equipment.delete({ where: { id: location.equipment.id } });
    releaseResolve?.();
    const [editOutcome, deleteOutcome] = await Promise.allSettled([editPromise, deletePromise]);
    if (deleteOutcome.status === "fulfilled") phaseEquipmentIds.delete(location.equipment.id);
    if (editOutcome.status === "fulfilled") {
      expect((await current(id)).currentRevision).toMatchObject({ contextKind: "EQUIPMENT", equipmentDisplayNameSnapshot: location.equipment.displayName });
    } else {
      expect(editOutcome.reason).toMatchObject({ code: expect.stringMatching(/REFERENCE|PERSISTENCE/) });
      expect((await current(id)).stateVersion).toBe(1);
    }
    expect(await client.mine.findUnique({ where: { id: location.mine.id } })).not.toBeNull();

    const deactivation = await createLocation("deactivation-race");
    const mineRootId = await create();
    const mineRoot = await current(mineRootId);
    let mineLockResolve: (() => void) | undefined;
    let mineReleaseResolve: (() => void) | undefined;
    const mineLockHeld = new Promise<void>((resolve) => { mineLockResolve = resolve; });
    const mineRelease = new Promise<void>((resolve) => { mineReleaseResolve = resolve; });
    const mineEditPromise = edit(editInput(mineRoot, {
      contextKind: "MINE",
      mineId: deactivation.mine.id,
      equipmentId: null,
    }), {
      afterContextResolved: async () => {
        mineLockResolve?.();
        await mineRelease;
      },
    });
    await mineLockHeld;
    const deactivatePromise = concurrentClient.mine.update({
      where: { id: deactivation.mine.id },
      data: { status: "INACTIVE" },
    });
    mineReleaseResolve?.();
    const [mineEditOutcome] = await Promise.allSettled([mineEditPromise, deactivatePromise]);
    if (mineEditOutcome.status === "fulfilled") {
      expect((await current(mineRootId)).currentRevision).toMatchObject({
        contextKind: "MINE",
        mineId: deactivation.mine.id,
        mineNameSnapshot: deactivation.mine.name,
      });
    } else {
      expect(mineEditOutcome.reason).toMatchObject({ code: expect.stringMatching(/REFERENCE|PERSISTENCE/) });
      expect((await current(mineRootId)).stateVersion).toBe(1);
    }
  });

  it("rolls back faults at every mutation stage and rejects corrupt current aggregates", async () => {
    if (!client) throw new Error("Missing client");
    const rollbackLocation = await createLocation("rollback");
    for (const hook of [
      "afterReferencesDeleted",
      "afterRevisionUpdated",
      "afterReferencesInserted",
      "afterRootUpdated",
      "beforeCommit",
    ] as const) {
      const id = await create();
      const before = await current(id);
      await expect(edit(editInput(before, {
        title: `Fault ${hook}`,
        bodyMarkdown: "## Changed\n\nChanged body.",
        safetyCaution: "Changed caution.",
        contextKind: "MINE",
        mineId: rollbackLocation.mine.id,
        equipmentId: null,
        externalReferences: [
          { label: "Changed", url: "https://example.com/changed" },
        ],
      }), {
        [hook]: async () => { throw new Error(`${hook} fault`); },
      })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
      const after = await current(id);
      expect(after.stateVersion).toBe(1);
      expect(after.currentRevision?.title).toBe("Editable observation");
      expect(after.currentRevision?.bodyMarkdown).toBe("## Observation\n\nOriginal body.");
      expect(after.currentRevision?.safetyCaution).toBeNull();
      expect(after.currentRevision).toMatchObject({
        trust: "UNVERIFIED",
        reviewedAt: null,
        contextKind: "GENERAL",
        mineId: null,
        equipmentId: null,
      });
      expect(after.currentRevision?.externalReferences.map(({ label }) => label)).toEqual(["Original A", "Original B"]);
      expect(after.updatedAt).toEqual(before.updatedAt);
      expect(after.currentRevision?.updatedAt).toEqual(before.currentRevision?.updatedAt);
    }
    const invalidId = await create();
    const invalid = await current(invalidId);
    await expect(edit(editInput(invalid, {
      bodyMarkdown: "<script>unsafe</script>",
    }))).rejects.toMatchObject({ code: "INVALID_MARKDOWN" });
    await expect(edit(editInput(invalid, {
      contextKind: "MINE",
      mineId: "missing-mine",
      equipmentId: null,
    }))).rejects.toMatchObject({ code: "REFERENCE_NOT_FOUND" });
    expect((await current(invalidId)).stateVersion).toBe(1);

    const corruptId = await create();
    const corrupt = await current(corruptId);
    await client.knowledgeRecord.update({ where: { id: corruptId }, data: { currentRevisionId: null } });
    await expect(edit(editInput(corrupt))).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });

    const trustId = await create();
    const trust = await current(trustId);
    await expect(client.knowledgeRecordRevision.update({
      where: { id: trust.currentRevisionId! },
      data: { trust: "PERSONALLY_REVIEWED", reviewedAt: null },
    })).rejects.toBeDefined();
    await expect(client.knowledgeRecordRevision.update({
      where: { id: trust.currentRevisionId! },
      data: { origin: "REVISED", changeSummary: "Contradictory origin" },
    })).rejects.toBeDefined();
    await client.knowledgeRevisionExternalReference.update({
      where: {
        knowledgeRecordRevisionId_sequence: {
          knowledgeRecordRevisionId: trust.currentRevisionId!,
          sequence: 1,
        },
      },
      data: { sequence: 3 },
    });
    await expect(edit(editInput(trust))).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });
    await client.knowledgeRevisionExternalReference.update({
      where: {
        knowledgeRecordRevisionId_sequence: {
          knowledgeRecordRevisionId: trust.currentRevisionId!,
          sequence: 3,
        },
      },
      data: { sequence: 1 },
    });
    const otherId = await create();
    const other = await current(otherId);
    await expect(client.knowledgeRecord.update({
      where: { id: trustId },
      data: { currentRevisionId: other.currentRevisionId },
    })).rejects.toBeDefined();
  });

  it("cleans only tracked phase fixtures and preserves unrelated disposable data", async () => {
    if (!client) throw new Error("Missing client");
    const id = await create();
    expect(await client.knowledgeRecord.findUnique({ where: { id } })).not.toBeNull();
    await cleanup();
    expect(await client.knowledgeRecord.findUnique({ where: { id } })).toBeNull();
    expect(await client.city.findUnique({ where: { id: unrelatedCityId } })).not.toBeNull();
  });
});
