// @vitest-environment node

import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { reviewKnowledgeRecordWithDependencies, updateUnverifiedKnowledgeRecordWithDependencies } from "@/features/knowledge-base/edit-review-persistence-internal";
import {
  archiveKnowledgeRecordWithDependencies,
  deleteKnowledgeRecordWithDependencies,
  restoreKnowledgeRecordWithDependencies,
  type KnowledgeLifecycleFault,
} from "@/features/knowledge-base/lifecycle-persistence-internal";
import { createKnowledgeRecordWithDependencies } from "@/features/knowledge-base/persistence-internal";
import { reviseReviewedKnowledgeRecordWithDependencies } from "@/features/knowledge-base/revision-persistence-internal";
import type { KnowledgeCreateInput, KnowledgeEditInput } from "@/features/knowledge-base/types";
import { guardedKnowledgeBaseDatabaseUrl } from "../helpers/knowledge-base-postgres-guard";

const databaseUrl = guardedKnowledgeBaseDatabaseUrl();
const describePostgres = databaseUrl ? describe : describe.skip;
const client = databaseUrl ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
const concurrentClient = databaseUrl ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
const rootIds = new Set<string>();
const cityIds = new Set<string>();
const mineIds = new Set<string>();
const equipmentIds = new Set<string>();
let unrelatedCityId = "";

function createInput(overrides: Partial<KnowledgeCreateInput> = {}): KnowledgeCreateInput {
  return {
    submissionKey: randomUUID(), contentKind: "FIELD_NOTE", title: "Lifecycle field note",
    bodyMarkdown: "## Note\n\nLifecycle evidence.", safetyCaution: null,
    contextKind: "GENERAL", mineId: null, equipmentId: null,
    externalReferences: [{ label: "Manual", url: "https://example.com/manual" }], ...overrides,
  };
}

async function create(overrides: Partial<KnowledgeCreateInput> = {}) {
  if (!client) throw new Error("Missing disposable database client.");
  const result = await createKnowledgeRecordWithDependencies(createInput(overrides), { client });
  rootIds.add(result.knowledgeRecordId);
  return load(result.knowledgeRecordId);
}

async function load(id: string, databaseClient = client) {
  if (!databaseClient) throw new Error("Missing disposable database client.");
  return databaseClient.knowledgeRecord.findUniqueOrThrow({
    where: { id }, include: {
      currentRevision: { include: { externalReferences: { orderBy: { sequence: "asc" } } } },
      revisions: { include: { externalReferences: { orderBy: { sequence: "asc" } } }, orderBy: { revisionNumber: "asc" } },
    },
  });
}

function tokens(root: Awaited<ReturnType<typeof load>>) {
  return { knowledgeRecordId: root.id, expectedStateVersion: root.stateVersion, expectedCurrentRevisionId: root.currentRevisionId! };
}

async function reviewed() {
  if (!client) throw new Error("Missing client.");
  const root = await create();
  await reviewKnowledgeRecordWithDependencies(tokens(root), { client });
  return load(root.id);
}

async function revisedCurrent() {
  if (!client) throw new Error("Missing client.");
  const root = await reviewed();
  await reviseReviewedKnowledgeRecordWithDependencies({
    ...editInput(root),
    title: "Revised lifecycle note",
    changeSummary: "Revised for lifecycle evidence",
  }, { client });
  return load(root.id);
}

function holdFault(point: KnowledgeLifecycleFault) {
  let reached!: () => void;
  let release!: () => void;
  const reachedPromise = new Promise<void>((resolve) => { reached = resolve; });
  const releasePromise = new Promise<void>((resolve) => { release = resolve; });
  return {
    reached: reachedPromise,
    release,
    fault: async (candidate: KnowledgeLifecycleFault) => {
      if (candidate === point) { reached(); await releasePromise; }
    },
  };
}

function signalFault(point: KnowledgeLifecycleFault) {
  let reached!: () => void;
  const reachedPromise = new Promise<void>((resolve) => { reached = resolve; });
  return {
    reached: reachedPromise,
    fault: async (candidate: KnowledgeLifecycleFault) => { if (candidate === point) reached(); },
  };
}

async function signalPrecedesSettlement(signal: Promise<void>, operation: Promise<unknown>) {
  return Promise.race([
    signal.then(() => true),
    operation.then(() => false, () => false),
  ]);
}

async function settleHeldRace<THeld, TCompeting>(
  hold: ReturnType<typeof holdFault>,
  heldOperation: Promise<THeld>,
  startCompetingOperation: () => { reached: Promise<void>; promise: Promise<TCompeting> },
) {
  const heldReached = await signalPrecedesSettlement(hold.reached, heldOperation);
  if (!heldReached) throw new Error("Held lifecycle operation settled before reaching its overlap barrier.");

  const competing = startCompetingOperation();
  let competingReached = false;
  try {
    competingReached = await signalPrecedesSettlement(competing.reached, competing.promise);
  } finally {
    hold.release();
  }

  const outcomes = await Promise.allSettled([heldOperation, competing.promise]);
  if (!competingReached) throw new Error("Competing lifecycle operation settled before reaching its overlap barrier.");
  return outcomes;
}

function editInput(root: Awaited<ReturnType<typeof load>>): KnowledgeEditInput {
  return {
    ...tokens(root), contentKind: root.currentRevision!.contentKind, changeSummary: null,
    title: "Edited lifecycle note", bodyMarkdown: "## Note\n\nEdited.", safetyCaution: null,
    contextKind: "GENERAL", mineId: null, equipmentId: null, externalReferences: [],
  };
}

async function owners() {
  if (!client) throw new Error("Missing client.");
  const key = `kb-lifecycle-${randomUUID()}`;
  const city = await client.city.create({ data: { id: `${key}-city`, name: `Lifecycle City ${key}`, state: "WY" } }); cityIds.add(city.id);
  const mine = await client.mine.create({ data: { id: `${key}-mine`, cityId: city.id, name: `Lifecycle Mine ${key}`, status: "ACTIVE" } }); mineIds.add(mine.id);
  const equipment = await client.equipment.create({ data: { id: `${key}-equipment`, mineId: mine.id, displayName: "Lifecycle Dragline", category: "DRAGLINE", status: "ACTIVE" } }); equipmentIds.add(equipment.id);
  return { city, mine, equipment };
}

async function cleanup() {
  if (!client) return;
  if (rootIds.size) {
    await client.knowledgeRecord.updateMany({ where: { id: { in: [...rootIds] } }, data: { currentRevisionId: null } });
    await client.knowledgeRecord.deleteMany({ where: { id: { in: [...rootIds] } } });
  }
  if (equipmentIds.size) await client.equipment.deleteMany({ where: { id: { in: [...equipmentIds] } } });
  if (mineIds.size) await client.mine.deleteMany({ where: { id: { in: [...mineIds] } } });
  if (cityIds.size) await client.city.deleteMany({ where: { id: { in: [...cityIds] } } });
  rootIds.clear(); equipmentIds.clear(); mineIds.clear(); cityIds.clear();
}

describePostgres("Knowledge Base lifecycle PostgreSQL evidence", () => {
  beforeAll(async () => {
    if (!client) return;
    unrelatedCityId = `kb-lifecycle-unrelated-${randomUUID()}`;
    await client.city.create({ data: { id: unrelatedCityId, name: "Unrelated lifecycle fixture", state: "WY" } });
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
    } finally { await concurrentClient?.$disconnect(); await client.$disconnect(); }
  });

  it("archives Active Unverified and Personally Reviewed aggregates without material drift", async () => {
    if (!client) throw new Error("Missing client.");
    for (const root of [await create(), await reviewed()]) {
      const before = root.revisions;
      const result = await archiveKnowledgeRecordWithDependencies(tokens(root), { client, now: () => new Date("2026-08-02T12:00:00Z") });
      const after = await load(root.id);
      expect(result).toMatchObject({ operation: "ARCHIVE", stateVersion: root.stateVersion + 1 });
      expect(after).toMatchObject({ lifecycle: "ARCHIVED", archivedAt: new Date("2026-08-02T12:00:00Z"), currentRevisionId: root.currentRevisionId });
      expect(after.revisions).toEqual(before);
      await expect(updateUnverifiedKnowledgeRecordWithDependencies(editInput(after), { client })).rejects.toMatchObject({ code: "RECORD_NOT_EDITABLE" });
    }
  });

  it("restores Archived Unverified in place without rewriting history or references", async () => {
    if (!client) throw new Error("Missing client.");
    const root = await create();
    await archiveKnowledgeRecordWithDependencies(tokens(root), { client });
    const archived = await load(root.id); const before = archived.revisions;
    await restoreKnowledgeRecordWithDependencies(tokens(archived), { client });
    const restored = await load(root.id);
    expect(restored).toMatchObject({ lifecycle: "ACTIVE", archivedAt: null, currentRevisionId: root.currentRevisionId, stateVersion: 3 });
    expect(restored.revisions).toEqual(before);
  });

  it("restores Archived Personally Reviewed through one independent RESTORED revision", async () => {
    if (!client) throw new Error("Missing client.");
    const root = await reviewed(); const retained = root.revisions[0]!;
    await archiveKnowledgeRecordWithDependencies(tokens(root), { client });
    const archived = await load(root.id);
    await restoreKnowledgeRecordWithDependencies(tokens(archived), { client });
    const restored = await load(root.id);
    expect(restored).toMatchObject({ lifecycle: "ACTIVE", archivedAt: null, stateVersion: 4 });
    expect(restored.revisions).toHaveLength(2);
    expect(restored.revisions[0]).toEqual(retained);
    expect(restored.currentRevision).toMatchObject({ revisionNumber: 2, origin: "RESTORED", trust: "UNVERIFIED", reviewedAt: null, changeSummary: null });
    expect(restored.currentRevision!.externalReferences.map(({ label, url }) => ({ label, url }))).toEqual([{ label: "Manual", url: "https://example.com/manual" }]);
    expect(restored.currentRevision!.externalReferences[0]!.id).not.toBe(retained.externalReferences[0]!.id);
  });

  it("permanently deletes complete aggregates across lifecycle states while preserving owners", async () => {
    if (!client) throw new Error("Missing client.");
    const location = await owners();
    const activeGeneral = await create({ externalReferences: [] });
    const activeReviewed = await reviewed();
    const archivedEquipment = await create({ contextKind: "EQUIPMENT", equipmentId: location.equipment.id, externalReferences: Array.from({ length: 10 }, (_, index) => ({ label: `Reference ${index + 1}`, url: `https://example.com/${index + 1}` })) });
    await archiveKnowledgeRecordWithDependencies(tokens(archivedEquipment), { client });
    const archivedReviewed = await reviewed();
    await archiveKnowledgeRecordWithDependencies(tokens(archivedReviewed), { client });
    const activeHistory = await revisedCurrent();
    const archivedHistory = await revisedCurrent();
    await archiveKnowledgeRecordWithDependencies(tokens(archivedHistory), { client });
    const restoredCurrent = await reviewed();
    await archiveKnowledgeRecordWithDependencies(tokens(restoredCurrent), { client });
    await restoreKnowledgeRecordWithDependencies(tokens(await load(restoredCurrent.id)), { client });
    const mineOnly = await owners();
    const snapshotOnly = await create({ contextKind: "MINE", mineId: mineOnly.mine.id });
    await client.equipment.delete({ where: { id: mineOnly.equipment.id } }); equipmentIds.delete(mineOnly.equipment.id);
    await client.mine.delete({ where: { id: mineOnly.mine.id } }); mineIds.delete(mineOnly.mine.id);
    const snapshotOnlyLoaded = await load(snapshotOnly.id);
    expect(snapshotOnlyLoaded.currentRevision!.mineId).toBeNull();
    const unrelated = await create({ title: "Unrelated lifecycle aggregate" });
    const targets = [
      activeGeneral,
      activeReviewed,
      await load(archivedEquipment.id),
      await load(archivedReviewed.id),
      activeHistory,
      await load(archivedHistory.id),
      await load(restoredCurrent.id),
      snapshotOnlyLoaded,
    ];
    expect(targets.map((root) => `${root.lifecycle}:${root.currentRevision!.trust}:${root.revisions.length}`)).toEqual([
      "ACTIVE:UNVERIFIED:1",
      "ACTIVE:PERSONALLY_REVIEWED:1",
      "ARCHIVED:UNVERIFIED:1",
      "ARCHIVED:PERSONALLY_REVIEWED:1",
      "ACTIVE:UNVERIFIED:2",
      "ARCHIVED:UNVERIFIED:2",
      "ACTIVE:UNVERIFIED:2",
      "ACTIVE:UNVERIFIED:1",
    ]);
    for (const root of targets) {
      await deleteKnowledgeRecordWithDependencies({ ...tokens(root), confirmationTitle: root.currentRevision!.title }, { client });
      rootIds.delete(root.id);
      await expect(client.knowledgeRecord.findUnique({ where: { id: root.id } })).resolves.toBeNull();
      await expect(client.knowledgeRecordRevision.count({ where: { knowledgeRecordId: root.id } })).resolves.toBe(0);
      await expect(client.knowledgeRevisionExternalReference.count({ where: { revision: { knowledgeRecordId: root.id } } })).resolves.toBe(0);
      await expect(client.knowledgeRecord.findUnique({ where: { id: unrelated.id } })).resolves.not.toBeNull();
    }
    await expect(client.mine.findUnique({ where: { id: location.mine.id } })).resolves.not.toBeNull();
    await expect(client.equipment.findUnique({ where: { id: location.equipment.id } })).resolves.not.toBeNull();
    await expect(client.city.findUnique({ where: { id: location.city.id } })).resolves.not.toBeNull();
  });

  it("serializes archive, restore, delete, and owner races without lost updates", async () => {
    if (!client || !concurrentClient) throw new Error("Missing clients.");
    const root = await create();
    const archiveEditHold = holdFault("ARCHIVE_AFTER_LIFECYCLE");
    const archive = archiveKnowledgeRecordWithDependencies(tokens(root), { client, fault: archiveEditHold.fault });
    const outcomes = await settleHeldRace(archiveEditHold, archive, () => {
      let started!: () => void;
      const reached = new Promise<void>((resolve) => { started = resolve; });
      return {
        reached,
        promise: updateUnverifiedKnowledgeRecordWithDependencies(editInput(root), {
          client: concurrentClient,
          hooks: { beforeRootLock: async () => { started(); } },
        }),
      };
    });
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const afterArchive = await load(root.id);
    expect(afterArchive).toMatchObject({ lifecycle: "ARCHIVED", stateVersion: 2 });
    const restoreInput = tokens(afterArchive);
    const unverifiedRestoreHold = holdFault("RESTORE_AFTER_LIFECYCLE");
    const unverifiedRestoreOne = restoreKnowledgeRecordWithDependencies(restoreInput, { client, fault: unverifiedRestoreHold.fault });
    const unverifiedRestoreSignal = signalFault("RESTORE_BEFORE_ROOT_LOCK");
    const restores = await settleHeldRace(unverifiedRestoreHold, unverifiedRestoreOne, () => ({
      reached: unverifiedRestoreSignal.reached,
      promise: restoreKnowledgeRecordWithDependencies(restoreInput, { client: concurrentClient, fault: unverifiedRestoreSignal.fault }),
    }));
    expect(restores.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(2);
    expect(restores.filter((outcome) => outcome.status === "fulfilled" && outcome.value.duplicate)).toHaveLength(1);
    expect((await load(root.id)).stateVersion).toBe(3);

    const archiveReviewRoot = await create();
    const archiveReviewHold = holdFault("ARCHIVE_AFTER_LIFECYCLE");
    const archiveReview = archiveKnowledgeRecordWithDependencies(tokens(archiveReviewRoot), { client, fault: archiveReviewHold.fault });
    const archiveReviewOutcomes = await settleHeldRace(archiveReviewHold, archiveReview, () => {
      let reviewStarted!: () => void;
      const reached = new Promise<void>((resolve) => { reviewStarted = resolve; });
      return {
        reached,
        promise: reviewKnowledgeRecordWithDependencies(tokens(archiveReviewRoot), {
          client: concurrentClient,
          hooks: { beforeRootLock: async () => { reviewStarted(); } },
        }),
      };
    });
    expect(archiveReviewOutcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(await load(archiveReviewRoot.id)).toMatchObject({ lifecycle: "ARCHIVED", stateVersion: 2, currentRevision: { trust: "UNVERIFIED" } });

    const archiveRevisionRoot = await reviewed();
    const archiveRevisionHold = holdFault("ARCHIVE_AFTER_LIFECYCLE");
    const archiveRevision = archiveKnowledgeRecordWithDependencies(tokens(archiveRevisionRoot), { client, fault: archiveRevisionHold.fault });
    const archiveRevisionOutcomes = await settleHeldRace(archiveRevisionHold, archiveRevision, () => {
      let revisionStarted!: () => void;
      const reached = new Promise<void>((resolve) => { revisionStarted = resolve; });
      return {
        reached,
        promise: reviseReviewedKnowledgeRecordWithDependencies({
          ...editInput(archiveRevisionRoot), changeSummary: "Concurrent revision", title: "Concurrent revised note",
        }, { client: concurrentClient, hooks: { beforeRootLock: async () => { revisionStarted(); } } }),
      };
    });
    expect(archiveRevisionOutcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(await load(archiveRevisionRoot.id)).toMatchObject({ lifecycle: "ARCHIVED", stateVersion: 3, revisions: [{ trust: "PERSONALLY_REVIEWED" }] });

    const reviewedRestoreRoot = await reviewed();
    await archiveKnowledgeRecordWithDependencies(tokens(reviewedRestoreRoot), { client });
    const reviewedArchived = await load(reviewedRestoreRoot.id);
    const reviewedRestoreHold = holdFault("RESTORE_AFTER_REVISION");
    const reviewedRestoreOne = restoreKnowledgeRecordWithDependencies(tokens(reviewedArchived), { client, fault: reviewedRestoreHold.fault });
    const restoreSignal = signalFault("RESTORE_BEFORE_ROOT_LOCK");
    const reviewedRestoreOutcomes = await settleHeldRace(reviewedRestoreHold, reviewedRestoreOne, () => ({
      reached: restoreSignal.reached,
      promise: restoreKnowledgeRecordWithDependencies(tokens(reviewedArchived), { client: concurrentClient, fault: restoreSignal.fault }),
    }));
    expect(reviewedRestoreOutcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(2);
    expect(reviewedRestoreOutcomes.filter((outcome) => outcome.status === "fulfilled" && outcome.value.duplicate)).toHaveLength(1);
    expect(await load(reviewedRestoreRoot.id)).toMatchObject({ lifecycle: "ACTIVE", stateVersion: 4, revisions: [{ trust: "PERSONALLY_REVIEWED" }, { origin: "RESTORED", trust: "UNVERIFIED" }] });

    const restoreDeleteRoot = await create();
    await archiveKnowledgeRecordWithDependencies(tokens(restoreDeleteRoot), { client });
    const restoreDeleteArchived = await load(restoreDeleteRoot.id);
    const restoreDeleteHold = holdFault("RESTORE_AFTER_LIFECYCLE");
    const restoreBeforeDelete = restoreKnowledgeRecordWithDependencies(tokens(restoreDeleteArchived), { client, fault: restoreDeleteHold.fault });
    const deleteSignal = signalFault("DELETE_BEFORE_ROOT_LOCK");
    const restoreDeleteOutcomes = await settleHeldRace(restoreDeleteHold, restoreBeforeDelete, () => ({
      reached: deleteSignal.reached,
      promise: deleteKnowledgeRecordWithDependencies({ ...tokens(restoreDeleteArchived), confirmationTitle: restoreDeleteArchived.currentRevision!.title }, { client: concurrentClient, fault: deleteSignal.fault }),
    }));
    expect(restoreDeleteOutcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(await load(restoreDeleteRoot.id)).toMatchObject({ lifecycle: "ACTIVE", stateVersion: 3 });

    async function deleteWinsAgainst(
      target: Awaited<ReturnType<typeof load>>,
      competitor: () => { promise: Promise<unknown>; reached: Promise<void> },
    ) {
      const heldDelete = holdFault("DELETE_AFTER_LOCKS");
      const deleting = deleteKnowledgeRecordWithDependencies(
        { ...tokens(target), confirmationTitle: target.currentRevision!.title },
        { client: client!, fault: heldDelete.fault },
      );
      const outcomes = await settleHeldRace(heldDelete, deleting, competitor);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes[1]).toMatchObject({ status: "rejected", reason: { code: "RECORD_NOT_FOUND" } });
      await expect(client!.knowledgeRecord.findUnique({ where: { id: target.id } })).resolves.toBeNull();
      await expect(client!.knowledgeRecordRevision.count({ where: { knowledgeRecordId: target.id } })).resolves.toBe(0);
      rootIds.delete(target.id);
    }

    const deleteEditRoot = await create();
    await deleteWinsAgainst(deleteEditRoot, () => {
      let started!: () => void; const reached = new Promise<void>((resolve) => { started = resolve; });
      return { reached, promise: updateUnverifiedKnowledgeRecordWithDependencies(editInput(deleteEditRoot), { client: concurrentClient, hooks: { beforeRootLock: async () => { started(); } } }) };
    });
    const deleteReviewRoot = await create();
    await deleteWinsAgainst(deleteReviewRoot, () => {
      let started!: () => void; const reached = new Promise<void>((resolve) => { started = resolve; });
      return { reached, promise: reviewKnowledgeRecordWithDependencies(tokens(deleteReviewRoot), { client: concurrentClient, hooks: { beforeRootLock: async () => { started(); } } }) };
    });
    const deleteRevisionRoot = await reviewed();
    await deleteWinsAgainst(deleteRevisionRoot, () => {
      let started!: () => void; const reached = new Promise<void>((resolve) => { started = resolve; });
      return { reached, promise: reviseReviewedKnowledgeRecordWithDependencies({ ...editInput(deleteRevisionRoot), title: "Losing revision", changeSummary: "Losing concurrent revision" }, { client: concurrentClient, hooks: { beforeRootLock: async () => { started(); } } }) };
    });
    const deleteArchiveRoot = await create();
    await deleteWinsAgainst(deleteArchiveRoot, () => {
      const signal = signalFault("ARCHIVE_BEFORE_ROOT_LOCK");
      return { reached: signal.reached, promise: archiveKnowledgeRecordWithDependencies(tokens(deleteArchiveRoot), { client: concurrentClient, fault: signal.fault }) };
    });
    const deleteDeleteRoot = await create();
    await deleteWinsAgainst(deleteDeleteRoot, () => {
      const signal = signalFault("DELETE_BEFORE_ROOT_LOCK");
      return { reached: signal.reached, promise: deleteKnowledgeRecordWithDependencies({ ...tokens(deleteDeleteRoot), confirmationTitle: deleteDeleteRoot.currentRevision!.title }, { client: concurrentClient, fault: signal.fault }) };
    });

    function deleteEquipmentWithSignal(equipmentId: string) {
      let started!: () => void;
      const reached = new Promise<void>((resolve) => { started = resolve; });
      return {
        reached,
        promise: concurrentClient!.$transaction(async (transaction) => {
          started();
          return transaction.equipment.delete({ where: { id: equipmentId } });
        }),
      };
    }

    const ownerLocation = await owners();
    const ownerRaceRoot = await create({ contextKind: "EQUIPMENT", equipmentId: ownerLocation.equipment.id });
    const ownerArchiveHold = holdFault("ARCHIVE_AFTER_LIFECYCLE");
    const ownerArchive = archiveKnowledgeRecordWithDependencies(tokens(ownerRaceRoot), { client, fault: ownerArchiveHold.fault });
    const ownerArchiveOutcomes = await settleHeldRace(ownerArchiveHold, ownerArchive, () => deleteEquipmentWithSignal(ownerLocation.equipment.id));
    expect(ownerArchiveOutcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    equipmentIds.delete(ownerLocation.equipment.id);
    const ownerRaceAfter = await load(ownerRaceRoot.id);
    expect(ownerRaceAfter).toMatchObject({ lifecycle: "ARCHIVED", currentRevision: { equipmentId: null, equipmentDisplayNameSnapshot: "Lifecycle Dragline" } });

    const unverifiedRestoreLocation = await owners();
    const unverifiedOwnerRoot = await create({ contextKind: "EQUIPMENT", equipmentId: unverifiedRestoreLocation.equipment.id });
    await archiveKnowledgeRecordWithDependencies(tokens(unverifiedOwnerRoot), { client });
    const unverifiedOwnerArchived = await load(unverifiedOwnerRoot.id);
    const unverifiedOwnerHold = holdFault("RESTORE_AFTER_LIFECYCLE");
    const unverifiedOwnerRestore = restoreKnowledgeRecordWithDependencies(tokens(unverifiedOwnerArchived), { client, fault: unverifiedOwnerHold.fault });
    const unverifiedOwnerOutcomes = await settleHeldRace(unverifiedOwnerHold, unverifiedOwnerRestore, () => deleteEquipmentWithSignal(unverifiedRestoreLocation.equipment.id));
    expect(unverifiedOwnerOutcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    equipmentIds.delete(unverifiedRestoreLocation.equipment.id);
    expect(await load(unverifiedOwnerRoot.id)).toMatchObject({ lifecycle: "ACTIVE", currentRevision: { equipmentId: null, equipmentDisplayNameSnapshot: "Lifecycle Dragline" } });

    const reviewedRestoreLocation = await owners();
    const reviewedOwnerRoot = await create({ contextKind: "EQUIPMENT", equipmentId: reviewedRestoreLocation.equipment.id });
    await reviewKnowledgeRecordWithDependencies(tokens(reviewedOwnerRoot), { client });
    const reviewedOwnerCurrent = await load(reviewedOwnerRoot.id);
    await archiveKnowledgeRecordWithDependencies(tokens(reviewedOwnerCurrent), { client });
    const reviewedOwnerArchived = await load(reviewedOwnerRoot.id);
    const reviewedOwnerHold = holdFault("RESTORE_AFTER_REVISION");
    const reviewedOwnerRestore = restoreKnowledgeRecordWithDependencies(tokens(reviewedOwnerArchived), { client, fault: reviewedOwnerHold.fault });
    const reviewedOwnerOutcomes = await settleHeldRace(reviewedOwnerHold, reviewedOwnerRestore, () => deleteEquipmentWithSignal(reviewedRestoreLocation.equipment.id));
    expect(reviewedOwnerOutcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    equipmentIds.delete(reviewedRestoreLocation.equipment.id);
    const reviewedOwnerAfter = await load(reviewedOwnerRoot.id);
    expect(reviewedOwnerAfter).toMatchObject({ lifecycle: "ACTIVE", revisions: [
      { trust: "PERSONALLY_REVIEWED", equipmentId: null, equipmentDisplayNameSnapshot: "Lifecycle Dragline" },
      { origin: "RESTORED", trust: "UNVERIFIED", equipmentId: null, equipmentDisplayNameSnapshot: "Lifecycle Dragline" },
    ] });

    const deleteOwnerLocation = await owners();
    const deleteOwnerRoot = await create({ contextKind: "EQUIPMENT", equipmentId: deleteOwnerLocation.equipment.id });
    const deleteOwnerHold = holdFault("DELETE_AFTER_LOCKS");
    const deleteOwnerAggregate = deleteKnowledgeRecordWithDependencies(
      { ...tokens(deleteOwnerRoot), confirmationTitle: deleteOwnerRoot.currentRevision!.title },
      { client, fault: deleteOwnerHold.fault },
    );
    const deleteOwnerOutcomes = await settleHeldRace(deleteOwnerHold, deleteOwnerAggregate, () => deleteEquipmentWithSignal(deleteOwnerLocation.equipment.id));
    expect(deleteOwnerOutcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    rootIds.delete(deleteOwnerRoot.id); equipmentIds.delete(deleteOwnerLocation.equipment.id);
    await expect(client.knowledgeRecord.findUnique({ where: { id: deleteOwnerRoot.id } })).resolves.toBeNull();
    await expect(client.mine.findUnique({ where: { id: deleteOwnerLocation.mine.id } })).resolves.not.toBeNull();
    await expect(client.city.findUnique({ where: { id: deleteOwnerLocation.city.id } })).resolves.not.toBeNull();
  }, 30_000);

  it("rolls back archive, both restore paths, and delete at every internal fault boundary", async () => {
    if (!client) throw new Error("Missing client.");
    const probe = async (root: Awaited<ReturnType<typeof load>>, operation: "archive" | "restore" | "delete", points: readonly KnowledgeLifecycleFault[]) => {
      for (const point of points) {
        const before = await load(root.id);
        const dependencies = { client, fault: async (candidate: KnowledgeLifecycleFault) => { if (candidate === point) throw new Error("probe"); } };
        const promise = operation === "archive"
          ? archiveKnowledgeRecordWithDependencies(tokens(before), dependencies)
          : operation === "restore"
            ? restoreKnowledgeRecordWithDependencies(tokens(before), dependencies)
            : deleteKnowledgeRecordWithDependencies({ ...tokens(before), confirmationTitle: before.currentRevision!.title }, dependencies);
        await expect(promise).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
        expect(await load(root.id)).toEqual(before);
      }
    };
    const active = await create();
    await probe(active, "archive", ["ARCHIVE_AFTER_LIFECYCLE", "ARCHIVE_AFTER_VERSION", "ARCHIVE_BEFORE_COMMIT"]);
    await archiveKnowledgeRecordWithDependencies(tokens(await load(active.id)), { client });
    await probe(await load(active.id), "restore", ["RESTORE_AFTER_LIFECYCLE", "RESTORE_AFTER_ARCHIVED_AT", "RESTORE_AFTER_VERSION", "RESTORE_BEFORE_COMMIT"]);
    const reviewedRoot = await reviewed(); await archiveKnowledgeRecordWithDependencies(tokens(reviewedRoot), { client });
    await probe(await load(reviewedRoot.id), "restore", ["RESTORE_AFTER_REVISION", "RESTORE_AFTER_REFERENCES", "RESTORE_AFTER_POINTER", "RESTORE_AFTER_LIFECYCLE", "RESTORE_AFTER_VERSION", "RESTORE_BEFORE_COMMIT"]);
    await probe(await load(reviewedRoot.id), "delete", ["DELETE_AFTER_LOCKS", "DELETE_AFTER_POINTER_CLEAR", "DELETE_AFTER_ROOT", "DELETE_BEFORE_COMMIT"]);
    const restoredDuplicate = await restoreKnowledgeRecordWithDependencies(
      tokens(await load(reviewedRoot.id)),
      { client, fault: async (point) => { if (point === "RESTORE_AFTER_COMMIT") throw new Error("ambiguous"); } },
    );
    expect(restoredDuplicate.duplicate).toBe(true);
    await restoreKnowledgeRecordWithDependencies(tokens(await load(active.id)), { client });
    const archivedDuplicate = await archiveKnowledgeRecordWithDependencies(
      tokens(await load(active.id)),
      { client, fault: async (point) => { if (point === "ARCHIVE_AFTER_COMMIT") throw new Error("ambiguous"); } },
    );
    expect(archivedDuplicate.duplicate).toBe(true);

    const falseArchive = await create();
    await expect(archiveKnowledgeRecordWithDependencies(tokens(falseArchive), {
      client,
      fault: async (point, database) => {
        if (point === "ARCHIVE_AFTER_COMMIT") {
          await database.knowledgeRecordRevision.update({ where: { id: falseArchive.currentRevisionId! }, data: { bodyMarkdown: "## Note\n\nUnrelated later archive material." } });
          throw new Error("ambiguous");
        }
      },
    })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });

    const falseUnverifiedRestore = await create();
    await archiveKnowledgeRecordWithDependencies(tokens(falseUnverifiedRestore), { client });
    const falseUnverifiedArchived = await load(falseUnverifiedRestore.id);
    await expect(restoreKnowledgeRecordWithDependencies(tokens(falseUnverifiedArchived), {
      client,
      fault: async (point, database) => {
        if (point === "RESTORE_AFTER_COMMIT") {
          await database.knowledgeRecordRevision.update({ where: { id: falseUnverifiedArchived.currentRevisionId! }, data: { bodyMarkdown: "## Note\n\nUnrelated later restore material." } });
          throw new Error("ambiguous");
        }
      },
    })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });

    const falseReviewedRestore = await reviewed();
    await archiveKnowledgeRecordWithDependencies(tokens(falseReviewedRestore), { client });
    const falseReviewedArchived = await load(falseReviewedRestore.id);
    await expect(restoreKnowledgeRecordWithDependencies(tokens(falseReviewedArchived), {
      client,
      fault: async (point, database) => {
        if (point === "RESTORE_AFTER_COMMIT") {
          await database.knowledgeRecordRevision.update({ where: { id: falseReviewedArchived.currentRevisionId! }, data: { bodyMarkdown: "## Note\n\nUnrelated retained material." } });
          throw new Error("ambiguous");
        }
      },
    })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });

    const deleteTarget = await load(reviewedRoot.id);
    const deletedDuplicate = await deleteKnowledgeRecordWithDependencies(
      { ...tokens(deleteTarget), confirmationTitle: deleteTarget.currentRevision!.title },
      { client, fault: async (point) => { if (point === "DELETE_AFTER_COMMIT") throw new Error("ambiguous"); } },
    );
    expect(deletedDuplicate.duplicate).toBe(true);
    rootIds.delete(reviewedRoot.id);
  });

  it("rejects stale authority, corrupt lifecycle state, and exhaustion safely", async () => {
    if (!client) throw new Error("Missing client.");
    const root = await create();
    await expect(archiveKnowledgeRecordWithDependencies({ ...tokens(root), expectedStateVersion: 2 }, { client })).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    await expect(archiveKnowledgeRecordWithDependencies({ ...tokens(root), expectedCurrentRevisionId: randomUUID() }, { client })).rejects.toMatchObject({ code: "CURRENT_AUTHORITY_CHANGED" });
    await client.knowledgeRecord.update({ where: { id: root.id }, data: { currentRevisionId: null } });
    await expect(archiveKnowledgeRecordWithDependencies(tokens(root), { client })).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });
    await client.knowledgeRecord.update({ where: { id: root.id }, data: { currentRevisionId: root.currentRevisionId, stateVersion: 2_147_483_647 } });
    const exhausted = await load(root.id);
    await expect(archiveKnowledgeRecordWithDependencies(tokens(exhausted), { client })).rejects.toMatchObject({ code: "STATE_VERSION_EXHAUSTED" });
    await deleteKnowledgeRecordWithDependencies({ ...tokens(exhausted), confirmationTitle: exhausted.currentRevision!.title }, { client });
    rootIds.delete(root.id);

    const pointerRoot = await reviewed();
    const stalePointerTokens = tokens(pointerRoot);
    await reviseReviewedKnowledgeRecordWithDependencies({ ...editInput(pointerRoot), title: "Advanced pointer", changeSummary: "Advance pointer evidence" }, { client });
    await expect(archiveKnowledgeRecordWithDependencies(stalePointerTokens, { client })).rejects.toMatchObject({ code: "CURRENT_AUTHORITY_CHANGED" });

    const retainedCorrupt = await revisedCurrent();
    await client.knowledgeRecordRevision.update({
      where: { id: retainedCorrupt.revisions[0]!.id },
      data: { trust: "UNVERIFIED", reviewedAt: null },
    });
    await expect(archiveKnowledgeRecordWithDependencies(tokens(retainedCorrupt), { client })).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });

    const markdownCorrupt = await create();
    await client.knowledgeRecordRevision.update({ where: { id: markdownCorrupt.currentRevisionId! }, data: { bodyMarkdown: "<script>alert(1)</script>" } });
    await expect(deleteKnowledgeRecordWithDependencies({ ...tokens(markdownCorrupt), confirmationTitle: markdownCorrupt.currentRevision!.title }, { client })).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });

    const referenceCorrupt = await create();
    await client.knowledgeRevisionExternalReference.update({ where: { id: referenceCorrupt.currentRevision!.externalReferences[0]!.id }, data: { sequence: 2 } });
    await expect(archiveKnowledgeRecordWithDependencies(tokens(referenceCorrupt), { client })).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });

    const ownerOne = await create(); const ownerTwo = await create();
    await expect(client.knowledgeRecord.update({ where: { id: ownerOne.id }, data: { currentRevisionId: ownerTwo.currentRevisionId } })).rejects.toBeTruthy();

    const numbering = await revisedCurrent();
    await expect(client.knowledgeRecordRevision.update({ where: { id: numbering.revisions[1]!.id }, data: { revisionNumber: 1 } })).rejects.toBeTruthy();

    const lifecycleConstraint = await create();
    await expect(client.$executeRaw(
      Prisma.sql`UPDATE "KnowledgeRecord" SET "lifecycle" = 'ARCHIVED' WHERE "id" = CAST(${lifecycleConstraint.id} AS uuid)`,
    )).rejects.toBeTruthy();
  });

  it("uses exact tracked cleanup and preserves the unrelated City fixture", async () => {
    if (!client) throw new Error("Missing client.");
    const root = await create();
    expect(await client.city.findUnique({ where: { id: unrelatedCityId } })).not.toBeNull();
    expect(await client.knowledgeRecord.count({ where: { id: root.id } })).toBe(1);
  });
});
