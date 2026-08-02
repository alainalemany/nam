import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  knowledgeCreateMaximumAttempts,
  knowledgeMaximumMutableRevisionNumber,
  knowledgeMaximumMutableStateVersion,
  knowledgeMaximumStateVersion,
} from "./constants";
import {
  KnowledgeBaseError,
  knowledgeAlreadyArchivedError,
  knowledgeConcurrentModificationError,
  knowledgeCurrentAuthorityChangedError,
  knowledgeDeleteConfirmationError,
  knowledgeIntegrityError,
  knowledgeNotArchivedError,
  knowledgeNotFoundError,
  knowledgePersistenceError,
  knowledgeRevisionNumberExhaustedError,
  knowledgeStateVersionExhaustedError,
} from "./errors";
import {
  knowledgeHistoryIsCoherent,
  knowledgeHistoryRootSelect,
} from "./history-data-internal";
import { isRetryableKnowledgeMutationError } from "./retry";
import type {
  KnowledgeDeleteInput,
  KnowledgeLifecycleInput,
  KnowledgeLifecycleResult,
} from "./types";
import { parseKnowledgeDeleteInput, parseKnowledgeLifecycleInput } from "./validation";

type Transaction = Prisma.TransactionClient;
type Root = NonNullable<Awaited<ReturnType<typeof loadRoot>>>;
type Revision = Root["revisions"][number];

export type KnowledgeLifecycleFault =
  | "ARCHIVE_BEFORE_ROOT_LOCK"
  | "ARCHIVE_AFTER_LIFECYCLE"
  | "ARCHIVE_AFTER_VERSION"
  | "ARCHIVE_BEFORE_COMMIT"
  | "ARCHIVE_AFTER_COMMIT"
  | "RESTORE_BEFORE_ROOT_LOCK"
  | "RESTORE_AFTER_LIFECYCLE"
  | "RESTORE_AFTER_ARCHIVED_AT"
  | "RESTORE_AFTER_REVISION"
  | "RESTORE_AFTER_REFERENCES"
  | "RESTORE_AFTER_POINTER"
  | "RESTORE_AFTER_VERSION"
  | "RESTORE_BEFORE_COMMIT"
  | "RESTORE_AFTER_COMMIT"
  | "DELETE_BEFORE_ROOT_LOCK"
  | "DELETE_AFTER_LOCKS"
  | "DELETE_AFTER_POINTER_CLEAR"
  | "DELETE_AFTER_ROOT"
  | "DELETE_BEFORE_COMMIT"
  | "DELETE_AFTER_COMMIT";

export type KnowledgeLifecycleDependencies = Readonly<{
  client: PrismaClient;
  now?: () => Date;
  fault?: (point: KnowledgeLifecycleFault, client: Transaction | PrismaClient) => Promise<void>;
}>;

function loadRoot(client: PrismaClient | Transaction, id: string) {
  return client.knowledgeRecord.findUnique({
    where: { id },
    select: knowledgeHistoryRootSelect,
  });
}

async function lockRoot(transaction: Transaction, id: string) {
  const rows = await transaction.$queryRaw<ReadonlyArray<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "KnowledgeRecord" WHERE "id" = CAST(${id} AS uuid) FOR UPDATE`,
  );
  if (rows.length === 0) throw knowledgeNotFoundError();
  if (rows.length !== 1 || rows[0]?.id !== id) throw knowledgeIntegrityError();
  const root = await loadRoot(transaction, id);
  if (!root?.currentRevisionId) throw knowledgeIntegrityError();
  const current = await transaction.$queryRaw<ReadonlyArray<{ id: string }>>(
    Prisma.sql`
      SELECT "id" FROM "KnowledgeRecordRevision"
      WHERE "id" = CAST(${root.currentRevisionId} AS uuid)
        AND "knowledgeRecordId" = CAST(${id} AS uuid)
      FOR UPDATE
    `,
  );
  if (current.length !== 1 || current[0]?.id !== root.currentRevisionId) {
    throw knowledgeIntegrityError();
  }
  return root;
}

async function lockHistory(transaction: Transaction, root: Root) {
  const revisions = await transaction.$queryRaw<ReadonlyArray<{ id: string }>>(
    Prisma.sql`
      SELECT "id" FROM "KnowledgeRecordRevision"
      WHERE "knowledgeRecordId" = CAST(${root.id} AS uuid)
      ORDER BY "revisionNumber", "id" FOR UPDATE
    `,
  );
  if (revisions.length !== root.revisions.length) throw knowledgeIntegrityError();
  await transaction.$queryRaw(
    Prisma.sql`
      SELECT reference."id"
      FROM "KnowledgeRevisionExternalReference" reference
      INNER JOIN "KnowledgeRecordRevision" revision
        ON revision."id" = reference."knowledgeRecordRevisionId"
      WHERE revision."knowledgeRecordId" = CAST(${root.id} AS uuid)
      ORDER BY revision."revisionNumber", reference."sequence", reference."id"
      FOR UPDATE OF reference
    `,
  );
  const locked = await loadRoot(transaction, root.id);
  if (!locked || !knowledgeHistoryIsCoherent(locked)) throw knowledgeIntegrityError();
  return locked;
}

function current(root: Root) {
  const revision = root.revisions.at(-1);
  if (!revision || revision.id !== root.currentRevisionId) throw knowledgeIntegrityError();
  return revision;
}

function requireAuthority(root: Root, input: KnowledgeLifecycleInput) {
  if (root.currentRevisionId !== input.expectedCurrentRevisionId) {
    throw knowledgeCurrentAuthorityChangedError();
  }
  if (root.stateVersion !== input.expectedStateVersion) {
    throw knowledgeConcurrentModificationError();
  }
  if (!knowledgeHistoryIsCoherent(root)) throw knowledgeIntegrityError();
}

function snapshot(value: unknown) {
  return JSON.stringify(value);
}

function historyMaterial(root: Root) {
  return JSON.stringify({ currentRevisionId: root.currentRevisionId, revisions: root.revisions });
}

function baselineMatchesInput(root: Root | null, input: KnowledgeLifecycleInput, lifecycle: "ACTIVE" | "ARCHIVED") {
  return root !== null && knowledgeHistoryIsCoherent(root) && root.lifecycle === lifecycle &&
    root.currentRevisionId === input.expectedCurrentRevisionId &&
    root.stateVersion === input.expectedStateVersion;
}

function archivedResultBaseline(root: Root | null, input: KnowledgeLifecycleInput) {
  return root !== null && knowledgeHistoryIsCoherent(root) && root.lifecycle === "ARCHIVED" &&
    root.currentRevisionId === input.expectedCurrentRevisionId &&
    root.stateVersion === input.expectedStateVersion + 1;
}

function copiedRevisionMatches(actual: Revision, retained: Revision) {
  return actual.revisionNumber === retained.revisionNumber + 1 &&
    actual.origin === "RESTORED" && actual.trust === "UNVERIFIED" &&
    actual.reviewedAt === null && actual.changeSummary === null &&
    actual.contentKind === retained.contentKind && actual.title === retained.title &&
    actual.normalizedTitle === retained.normalizedTitle &&
    actual.bodyMarkdown === retained.bodyMarkdown &&
    actual.safetyCaution === retained.safetyCaution &&
    actual.contextKind === retained.contextKind && actual.mineId === retained.mineId &&
    actual.equipmentId === retained.equipmentId &&
    actual.equipmentDisplayNameSnapshot === retained.equipmentDisplayNameSnapshot &&
    actual.equipmentNumberSnapshot === retained.equipmentNumberSnapshot &&
    actual.equipmentCategorySnapshot === retained.equipmentCategorySnapshot &&
    actual.mineNameSnapshot === retained.mineNameSnapshot &&
    actual.cityNameSnapshot === retained.cityNameSnapshot &&
    actual.cityStateSnapshot === retained.cityStateSnapshot &&
    actual.sourceDailyLogId === retained.sourceDailyLogId &&
    actual.sourceDailyLogDateSnapshot?.getTime() === retained.sourceDailyLogDateSnapshot?.getTime() &&
    actual.sourceDailyLogShiftSnapshot === retained.sourceDailyLogShiftSnapshot &&
    actual.relatedDefectId === retained.relatedDefectId &&
    actual.relatedDefectTitleSnapshot === retained.relatedDefectTitleSnapshot &&
    actual.relatedDefectReportedDateSnapshot?.getTime() === retained.relatedDefectReportedDateSnapshot?.getTime() &&
    actual.externalReferences.length === retained.externalReferences.length &&
    actual.externalReferences.every((reference, index) => {
      const expected = retained.externalReferences[index];
      return reference.sequence === expected?.sequence && reference.label === expected.label &&
        reference.url === expected.url && reference.normalizedUrl === expected.normalizedUrl;
    });
}

async function archiveAttempt(
  input: KnowledgeLifecycleInput,
  dependencies: KnowledgeLifecycleDependencies,
  baseline: Root | null,
  captureArchivedAt: (value: Date) => void,
) {
  const now = dependencies.now ?? (() => new Date());
  const result = await dependencies.client.$transaction(async (transaction) => {
    await dependencies.fault?.("ARCHIVE_BEFORE_ROOT_LOCK", transaction);
    const initial = await lockRoot(transaction, input.knowledgeRecordId);
    const locked = await lockHistory(transaction, initial);
    if (locked.currentRevisionId !== input.expectedCurrentRevisionId) {
      throw knowledgeCurrentAuthorityChangedError();
    }
    if (locked.lifecycle === "ARCHIVED" && locked.stateVersion === input.expectedStateVersion + 1 &&
      (baselineMatchesInput(baseline, input, "ACTIVE") ||
        (archivedResultBaseline(baseline, input) &&
          locked.archivedAt?.getTime() === baseline!.archivedAt?.getTime())) &&
      historyMaterial(locked) === historyMaterial(baseline!)) {
      return { knowledgeRecordId: initial.id, operation: "ARCHIVE", stateVersion: locked.stateVersion, duplicate: true } satisfies KnowledgeLifecycleResult;
    }
    requireAuthority(locked, input);
    if (locked.lifecycle !== "ACTIVE") throw knowledgeAlreadyArchivedError();
    if (locked.stateVersion > knowledgeMaximumMutableStateVersion) throw knowledgeStateVersionExhaustedError();
    const before = historyMaterial(locked);
    const archivedAt = now();
    captureArchivedAt(archivedAt);
    await transaction.knowledgeRecord.update({
      where: { id: locked.id },
      data: { lifecycle: "ARCHIVED", archivedAt },
    });
    await dependencies.fault?.("ARCHIVE_AFTER_LIFECYCLE", transaction);
    const updated = await transaction.knowledgeRecord.update({
      where: { id: locked.id }, data: { stateVersion: { increment: 1 } },
      select: { stateVersion: true },
    });
    await dependencies.fault?.("ARCHIVE_AFTER_VERSION", transaction);
    const completed = await loadRoot(transaction, locked.id);
    if (!completed || !knowledgeHistoryIsCoherent(completed) || completed.lifecycle !== "ARCHIVED" ||
      completed.archivedAt?.getTime() !== archivedAt.getTime() || completed.stateVersion !== input.expectedStateVersion + 1 ||
      historyMaterial(completed) !== before) throw knowledgeIntegrityError();
    await dependencies.fault?.("ARCHIVE_BEFORE_COMMIT", transaction);
    return { knowledgeRecordId: locked.id, operation: "ARCHIVE", stateVersion: updated.stateVersion, duplicate: false } satisfies KnowledgeLifecycleResult;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 20_000 });
  await dependencies.fault?.("ARCHIVE_AFTER_COMMIT", dependencies.client);
  return result;
}

async function restoreAttempt(
  input: KnowledgeLifecycleInput,
  dependencies: KnowledgeLifecycleDependencies,
  baseline: Root | null,
) {
  const result = await dependencies.client.$transaction(async (transaction) => {
    await dependencies.fault?.("RESTORE_BEFORE_ROOT_LOCK", transaction);
    const initial = await lockRoot(transaction, input.knowledgeRecordId);
    const locked = await lockHistory(transaction, initial);
    if (locked.currentRevisionId !== input.expectedCurrentRevisionId) {
      const retained = locked.revisions.find((revision) => revision.id === input.expectedCurrentRevisionId);
      const restored = locked.revisions.at(-1);
      const baselineRetained = baseline?.revisions.find((revision) => revision.id === input.expectedCurrentRevisionId);
      if (locked.lifecycle === "ACTIVE" && locked.stateVersion === input.expectedStateVersion + 1 &&
        baseline && knowledgeHistoryIsCoherent(baseline) && baseline.lifecycle === "ACTIVE" &&
        baseline.stateVersion === input.expectedStateVersion + 1 &&
        historyMaterial(locked) === historyMaterial(baseline) && baselineRetained &&
        retained && snapshot(retained) === snapshot(baselineRetained) &&
        retained.trust === "PERSONALLY_REVIEWED" && restored &&
        copiedRevisionMatches(restored, baselineRetained)) {
        return { knowledgeRecordId: initial.id, operation: "RESTORE", stateVersion: locked.stateVersion, duplicate: true, revisionNumber: restored.revisionNumber } satisfies KnowledgeLifecycleResult;
      }
      throw knowledgeCurrentAuthorityChangedError();
    }
    if (locked.lifecycle === "ACTIVE" && locked.stateVersion === input.expectedStateVersion + 1 &&
      baseline && knowledgeHistoryIsCoherent(baseline) && baseline.lifecycle === "ACTIVE" &&
      baseline.stateVersion === input.expectedStateVersion + 1 &&
      current(locked).trust === "UNVERIFIED" &&
      historyMaterial(locked) === historyMaterial(baseline)) {
      return { knowledgeRecordId: initial.id, operation: "RESTORE", stateVersion: locked.stateVersion, duplicate: true, revisionNumber: current(locked).revisionNumber } satisfies KnowledgeLifecycleResult;
    }
    requireAuthority(locked, input);
    if (locked.lifecycle !== "ARCHIVED") throw knowledgeNotArchivedError();
    if (!locked.archivedAt) throw knowledgeIntegrityError();
    if (locked.stateVersion > knowledgeMaximumMutableStateVersion) throw knowledgeStateVersionExhaustedError();
    const retained = current(locked);
    let revisionNumber = retained.revisionNumber;
    let newRevisionId: string | null = null;
    if (retained.trust === "PERSONALLY_REVIEWED") {
      if (retained.revisionNumber > knowledgeMaximumMutableRevisionNumber) {
        throw knowledgeRevisionNumberExhaustedError();
      }
      newRevisionId = randomUUID();
      revisionNumber += 1;
      await transaction.knowledgeRecordRevision.create({
        data: {
          id: newRevisionId,
          knowledgeRecordId: locked.id,
          revisionNumber,
          origin: "RESTORED",
          contentKind: retained.contentKind,
          trust: "UNVERIFIED",
          title: retained.title,
          normalizedTitle: retained.normalizedTitle,
          bodyMarkdown: retained.bodyMarkdown,
          safetyCaution: retained.safetyCaution,
          contextKind: retained.contextKind,
          mineId: retained.mineId,
          equipmentId: retained.equipmentId,
          equipmentDisplayNameSnapshot: retained.equipmentDisplayNameSnapshot,
          equipmentNumberSnapshot: retained.equipmentNumberSnapshot,
          equipmentCategorySnapshot: retained.equipmentCategorySnapshot,
          mineNameSnapshot: retained.mineNameSnapshot,
          cityNameSnapshot: retained.cityNameSnapshot,
          cityStateSnapshot: retained.cityStateSnapshot,
          sourceDailyLogId: retained.sourceDailyLogId,
          sourceDailyLogDateSnapshot: retained.sourceDailyLogDateSnapshot,
          sourceDailyLogShiftSnapshot: retained.sourceDailyLogShiftSnapshot,
          relatedDefectId: retained.relatedDefectId,
          relatedDefectTitleSnapshot: retained.relatedDefectTitleSnapshot,
          relatedDefectReportedDateSnapshot: retained.relatedDefectReportedDateSnapshot,
          changeSummary: null,
          reviewedAt: null,
        },
      });
      await dependencies.fault?.("RESTORE_AFTER_REVISION", transaction);
      if (retained.externalReferences.length) {
        await transaction.knowledgeRevisionExternalReference.createMany({
          data: retained.externalReferences.map((reference) => ({
            id: randomUUID(), knowledgeRecordRevisionId: newRevisionId!,
            sequence: reference.sequence, label: reference.label,
            url: reference.url, normalizedUrl: reference.normalizedUrl,
          })),
        });
      }
      await dependencies.fault?.("RESTORE_AFTER_REFERENCES", transaction);
      await transaction.knowledgeRecord.update({ where: { id: locked.id }, data: { currentRevisionId: newRevisionId } });
      await dependencies.fault?.("RESTORE_AFTER_POINTER", transaction);
    }
    await transaction.knowledgeRecord.update({
      where: { id: locked.id },
      data: { lifecycle: "ACTIVE", archivedAt: null },
    });
    await dependencies.fault?.("RESTORE_AFTER_LIFECYCLE", transaction);
    await dependencies.fault?.("RESTORE_AFTER_ARCHIVED_AT", transaction);
    const updated = await transaction.knowledgeRecord.update({
      where: { id: locked.id }, data: { stateVersion: { increment: 1 } }, select: { stateVersion: true },
    });
    await dependencies.fault?.("RESTORE_AFTER_VERSION", transaction);
    const completed = await loadRoot(transaction, locked.id);
    if (!completed || !knowledgeHistoryIsCoherent(completed) || completed.lifecycle !== "ACTIVE" ||
      completed.archivedAt !== null || completed.stateVersion !== input.expectedStateVersion + 1) {
      throw knowledgeIntegrityError();
    }
    if (retained.trust === "UNVERIFIED") {
      if (completed.currentRevisionId !== retained.id || snapshot(completed.revisions) !== snapshot(locked.revisions)) {
        throw knowledgeIntegrityError();
      }
    } else {
      const restored = completed.revisions.at(-1);
      const old = completed.revisions.at(-2);
      if (!restored || !old || restored.id !== newRevisionId || old.id !== retained.id ||
        !copiedRevisionMatches(restored, retained) || snapshot(old) !== snapshot(retained)) {
        throw knowledgeIntegrityError();
      }
    }
    await dependencies.fault?.("RESTORE_BEFORE_COMMIT", transaction);
    return { knowledgeRecordId: locked.id, operation: "RESTORE", stateVersion: updated.stateVersion, duplicate: false, revisionNumber } satisfies KnowledgeLifecycleResult;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 20_000 });
  await dependencies.fault?.("RESTORE_AFTER_COMMIT", dependencies.client);
  return result;
}

type DeleteCapture = Readonly<{ revisionIds: readonly string[]; referenceIds: readonly string[]; mineIds: readonly string[]; equipmentIds: readonly string[] }>;

async function deleteAttempt(
  input: KnowledgeDeleteInput,
  dependencies: KnowledgeLifecycleDependencies,
  capture: (value: DeleteCapture) => void,
) {
  const result = await dependencies.client.$transaction(async (transaction) => {
    await dependencies.fault?.("DELETE_BEFORE_ROOT_LOCK", transaction);
    const initial = await lockRoot(transaction, input.knowledgeRecordId);
    requireAuthority(initial, input);
    const locked = await lockHistory(transaction, initial);
    const selectedCurrent = current(locked);
    if (input.confirmationTitle !== selectedCurrent.title) throw knowledgeDeleteConfirmationError();
    const referenceRows = await transaction.knowledgeRevisionExternalReference.findMany({
      where: { revision: { knowledgeRecordId: locked.id } }, select: { id: true },
    });
    const value = {
      revisionIds: locked.revisions.map((revision) => revision.id),
      referenceIds: referenceRows.map((reference) => reference.id),
      mineIds: [...new Set(locked.revisions.flatMap((revision) => revision.mineId ? [revision.mineId] : []))],
      equipmentIds: [...new Set(locked.revisions.flatMap((revision) => revision.equipmentId ? [revision.equipmentId] : []))],
    } satisfies DeleteCapture;
    capture(value);
    await dependencies.fault?.("DELETE_AFTER_LOCKS", transaction);
    await transaction.knowledgeRecord.update({ where: { id: locked.id }, data: { currentRevisionId: null } });
    await dependencies.fault?.("DELETE_AFTER_POINTER_CLEAR", transaction);
    await transaction.knowledgeRecord.delete({ where: { id: locked.id } });
    await dependencies.fault?.("DELETE_AFTER_ROOT", transaction);
    const [rootCount, revisionCount, referenceCount, mineCount, equipmentCount] = await Promise.all([
      transaction.knowledgeRecord.count({ where: { id: locked.id } }),
      transaction.knowledgeRecordRevision.count({ where: { id: { in: [...value.revisionIds] } } }),
      transaction.knowledgeRevisionExternalReference.count({ where: { id: { in: [...value.referenceIds] } } }),
      transaction.mine.count({ where: { id: { in: [...value.mineIds] } } }),
      transaction.equipment.count({ where: { id: { in: [...value.equipmentIds] } } }),
    ]);
    if (rootCount || revisionCount || referenceCount || mineCount !== value.mineIds.length || equipmentCount !== value.equipmentIds.length) {
      throw knowledgeIntegrityError();
    }
    await dependencies.fault?.("DELETE_BEFORE_COMMIT", transaction);
    return { knowledgeRecordId: locked.id, operation: "DELETE", stateVersion: null, duplicate: false } satisfies KnowledgeLifecycleResult;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 20_000 });
  await dependencies.fault?.("DELETE_AFTER_COMMIT", dependencies.client);
  return result;
}

async function reconcileDelete(client: PrismaClient, id: string, capture: DeleteCapture) {
  const [rootCount, revisionCount, referenceCount, mineCount, equipmentCount] = await Promise.all([
    client.knowledgeRecord.count({ where: { id } }),
    client.knowledgeRecordRevision.count({ where: { id: { in: [...capture.revisionIds] } } }),
    client.knowledgeRevisionExternalReference.count({ where: { id: { in: [...capture.referenceIds] } } }),
    client.mine.count({ where: { id: { in: [...capture.mineIds] } } }),
    client.equipment.count({ where: { id: { in: [...capture.equipmentIds] } } }),
  ]);
  return rootCount === 0 && revisionCount === 0 && referenceCount === 0 &&
    mineCount === capture.mineIds.length && equipmentCount === capture.equipmentIds.length;
}

async function runLifecycle(
  operation: () => Promise<KnowledgeLifecycleResult>,
) {
  for (let attempt = 1; attempt <= knowledgeCreateMaximumAttempts; attempt += 1) {
    try { return await operation(); } catch (error) {
      if (error instanceof KnowledgeBaseError) throw error;
      if (isRetryableKnowledgeMutationError(error)) {
        if (attempt < knowledgeCreateMaximumAttempts) continue;
        throw knowledgePersistenceError();
      }
      throw error;
    }
  }
  throw knowledgePersistenceError();
}

export function archiveKnowledgeRecordWithDependencies(input: KnowledgeLifecycleInput, dependencies: KnowledgeLifecycleDependencies) {
  const parsed = parseKnowledgeLifecycleInput(input, knowledgeMaximumStateVersion);
  return runLifecycle(async () => {
    const baseline = await loadRoot(dependencies.client, parsed.knowledgeRecordId).catch(() => null);
    let intendedArchivedAt: Date | null = null;
    try { return await archiveAttempt(parsed, dependencies, baseline, (value) => { intendedArchivedAt = value; }); } catch (error) {
      if (error instanceof KnowledgeBaseError || isRetryableKnowledgeMutationError(error)) throw error;
      const root = await loadRoot(dependencies.client, parsed.knowledgeRecordId).catch(() => null);
      const expectedArchivedAt = intendedArchivedAt ??
        (archivedResultBaseline(baseline, parsed) ? baseline!.archivedAt : null);
      if (root && root.lifecycle === "ARCHIVED" && root.archivedAt &&
        expectedArchivedAt && root.archivedAt.getTime() === expectedArchivedAt.getTime() &&
        root.stateVersion === parsed.expectedStateVersion + 1 &&
        root.currentRevisionId === parsed.expectedCurrentRevisionId && knowledgeHistoryIsCoherent(root) &&
        baselineMatchesInput(baseline, parsed, "ACTIVE") &&
        historyMaterial(root) === historyMaterial(baseline!)) {
        return { knowledgeRecordId: root.id, operation: "ARCHIVE", stateVersion: root.stateVersion, duplicate: true };
      }
      throw knowledgePersistenceError();
    }
  });
}

export function restoreKnowledgeRecordWithDependencies(input: KnowledgeLifecycleInput, dependencies: KnowledgeLifecycleDependencies) {
  const parsed = parseKnowledgeLifecycleInput(input, knowledgeMaximumStateVersion);
  return runLifecycle(async () => {
    const baseline = await loadRoot(dependencies.client, parsed.knowledgeRecordId).catch(() => null);
    try { return await restoreAttempt(parsed, dependencies, baseline); } catch (error) {
      if (error instanceof KnowledgeBaseError || isRetryableKnowledgeMutationError(error)) throw error;
      const root = await loadRoot(dependencies.client, parsed.knowledgeRecordId).catch(() => null);
      if (root && root.lifecycle === "ACTIVE" && root.archivedAt === null &&
        root.stateVersion === parsed.expectedStateVersion + 1 && knowledgeHistoryIsCoherent(root) &&
        baselineMatchesInput(baseline, parsed, "ARCHIVED")) {
        const restored = current(root);
        if (restored.id === parsed.expectedCurrentRevisionId && restored.trust === "UNVERIFIED" &&
          historyMaterial(root) === historyMaterial(baseline!)) {
          return { knowledgeRecordId: root.id, operation: "RESTORE", stateVersion: root.stateVersion, duplicate: true, revisionNumber: restored.revisionNumber };
        }
        const retained = root.revisions.find((revision) => revision.id === parsed.expectedCurrentRevisionId);
        const baselineRetained = baseline!.revisions.find((revision) => revision.id === parsed.expectedCurrentRevisionId);
        if (retained?.trust === "PERSONALLY_REVIEWED" && baselineRetained &&
          snapshot(retained) === snapshot(baselineRetained) &&
          copiedRevisionMatches(restored, baselineRetained)) {
          return { knowledgeRecordId: root.id, operation: "RESTORE", stateVersion: root.stateVersion, duplicate: true, revisionNumber: restored.revisionNumber };
        }
      }
      throw knowledgePersistenceError();
    }
  });
}

export async function deleteKnowledgeRecordWithDependencies(input: KnowledgeDeleteInput, dependencies: KnowledgeLifecycleDependencies) {
  const parsed = parseKnowledgeDeleteInput(input);
  let captured: DeleteCapture | null = null;
  return runLifecycle(async () => {
    captured = null;
    try { return await deleteAttempt(parsed, dependencies, (value) => { captured = value; }); } catch (error) {
      if (error instanceof KnowledgeBaseError || isRetryableKnowledgeMutationError(error)) throw error;
      const proof = captured as DeleteCapture | null;
      if (proof && await reconcileDelete(dependencies.client, parsed.knowledgeRecordId, proof).catch(() => false)) {
        return { knowledgeRecordId: parsed.knowledgeRecordId, operation: "DELETE", stateVersion: null, duplicate: true };
      }
      throw knowledgePersistenceError();
    }
  });
}
