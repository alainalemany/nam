import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  knowledgeCreateMaximumAttempts,
  knowledgeMaximumMutableRevisionNumber,
} from "./constants";
import { knowledgeDetailIsCoherent } from "./data-internal";
import {
  knowledgeChangeSummaryRequiredError,
  KnowledgeBaseError,
  knowledgeConcurrentModificationError,
  knowledgeCurrentAuthorityChangedError,
  knowledgeIntegrityError,
  knowledgeNoMaterialChangeError,
  knowledgeNotEditableError,
  knowledgeNotFoundError,
  knowledgePersistenceError,
  knowledgeRevisionNumberExhaustedError,
} from "./errors";
import {
  knowledgeHistoryIsCoherent,
  knowledgeHistoryRootSelect,
  knowledgeHistoryRevisionSelect,
} from "./history-data-internal";
import {
  knowledgeContextDataMatches,
  lockKnowledgeExternalReferences,
  loadKnowledgeMutationAggregate,
  resolveKnowledgeEditContextData,
  retainedKnowledgeContextData,
  updateUnverifiedKnowledgeRecordWithDependencies,
  type KnowledgeEditReviewDependencies,
} from "./edit-review-persistence-internal";
import { normalizeTitleKey } from "./normalization";
import { isRetryableKnowledgeMutationError } from "./retry";
import type { KnowledgeEditInput, KnowledgeMutationResult } from "./types";
import { parseKnowledgeEditInput } from "./validation";

type Transaction = Prisma.TransactionClient;
type Aggregate = NonNullable<Awaited<ReturnType<typeof loadKnowledgeMutationAggregate>>>;
type Revision = NonNullable<Aggregate["currentRevision"]>;
type ContextData = ReturnType<typeof retainedKnowledgeContextData>;

export type KnowledgeRevisionHooks = Readonly<{
  beforeRootLock?: (transaction: Transaction) => Promise<void>;
  afterContextResolved?: (transaction: Transaction) => Promise<void>;
  afterRevisionInserted?: (transaction: Transaction, revisionId: string) => Promise<void>;
  afterReferencesInserted?: (transaction: Transaction, revisionId: string) => Promise<void>;
  afterPointerAdvanced?: (transaction: Transaction, revisionId: string) => Promise<void>;
  afterRootUpdated?: (transaction: Transaction, revisionId: string) => Promise<void>;
  beforeCommit?: (transaction: Transaction, revisionId: string) => Promise<void>;
  afterCommit?: (result: KnowledgeMutationResult) => Promise<void>;
}>;

export type KnowledgeRevisionDependencies = Readonly<{
  client: PrismaClient;
  hooks?: KnowledgeRevisionHooks;
}>;

async function lockReviewedAggregate(transaction: Transaction, id: string) {
  const roots = await transaction.$queryRaw<ReadonlyArray<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "KnowledgeRecord" WHERE "id" = CAST(${id} AS uuid) FOR UPDATE`,
  );
  if (roots.length === 0) throw knowledgeNotFoundError();
  if (roots.length !== 1 || roots[0]?.id !== id) throw knowledgeIntegrityError();
  const aggregate = await loadKnowledgeMutationAggregate(transaction, id);
  if (!aggregate?.currentRevisionId || !aggregate.currentRevision) throw knowledgeIntegrityError();
  const revisions = await transaction.$queryRaw<ReadonlyArray<{ id: string }>>(
    Prisma.sql`
      SELECT "id" FROM "KnowledgeRecordRevision"
      WHERE "id" = CAST(${aggregate.currentRevisionId} AS uuid)
        AND "knowledgeRecordId" = CAST(${id} AS uuid)
      FOR UPDATE
    `,
  );
  if (revisions.length !== 1 || revisions[0]?.id !== aggregate.currentRevisionId) {
    throw knowledgeIntegrityError();
  }
  const locked = await loadKnowledgeMutationAggregate(transaction, id);
  if (!locked?.currentRevision || locked.currentRevisionId !== locked.currentRevision.id) {
    throw knowledgeIntegrityError();
  }
  return locked;
}

type RevisionSnapshot = ReturnType<typeof revisionSnapshot>;
function revisionSnapshot(revision: Revision) {
  return {
    id: revision.id,
    knowledgeRecordId: revision.knowledgeRecordId,
    revisionNumber: revision.revisionNumber,
    origin: revision.origin,
    contentKind: revision.contentKind,
    trust: revision.trust,
    title: revision.title,
    normalizedTitle: revision.normalizedTitle,
    bodyMarkdown: revision.bodyMarkdown,
    safetyCaution: revision.safetyCaution,
    context: retainedKnowledgeContextData(revision),
    changeSummary: revision.changeSummary,
    reviewedAt: revision.reviewedAt?.getTime() ?? null,
    createdAt: revision.createdAt.getTime(),
    updatedAt: revision.updatedAt.getTime(),
    references: revision.externalReferences.map(({ sequence, label, url, normalizedUrl }) => ({
      sequence, label, url, normalizedUrl,
    })),
  };
}

function snapshotMatches(revision: Revision, expected: RevisionSnapshot) {
  const actual = revisionSnapshot(revision);
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function referencesMatch(revision: Revision, input: KnowledgeEditInput) {
  return revision.externalReferences.length === input.externalReferences.length &&
    revision.externalReferences.every((reference, index) => {
      const expected = input.externalReferences[index];
      return reference.sequence === index + 1 && reference.label === expected?.label &&
        reference.url === expected?.url && reference.normalizedUrl === expected?.url;
    });
}

function materialMatches(revision: Revision, input: KnowledgeEditInput, context: ContextData) {
  return revision.contentKind === input.contentKind && revision.title === input.title &&
    revision.normalizedTitle === normalizeTitleKey(input.title) &&
    revision.bodyMarkdown === input.bodyMarkdown &&
    revision.safetyCaution === input.safetyCaution &&
    knowledgeContextDataMatches(revision, context) && referencesMatch(revision, input);
}

async function fullRevision(client: PrismaClient | Transaction, id: string) {
  return client.knowledgeRecordRevision.findUnique({
    where: { id },
    select: knowledgeHistoryRevisionSelect,
  });
}

async function reviewedRevisionResultMatches(
  client: PrismaClient | Transaction,
  input: KnowledgeEditInput,
  newRevisionId: string,
  oldSnapshot: RevisionSnapshot,
  context: ContextData,
) {
  const root = await client.knowledgeRecord.findUnique({
    where: { id: input.knowledgeRecordId },
    select: knowledgeHistoryRootSelect,
  });
  if (!root || !knowledgeHistoryIsCoherent(root) ||
      root.currentRevisionId !== newRevisionId ||
      root.stateVersion !== input.expectedStateVersion + 1) return false;
  const current = root.revisions.at(-1);
  const retained = await fullRevision(client, input.expectedCurrentRevisionId);
  if (!current || !retained || current.id !== newRevisionId ||
      current.revisionNumber !== oldSnapshot.revisionNumber + 1 ||
      current.origin !== "REVISED" || current.trust !== "UNVERIFIED" ||
      current.reviewedAt !== null || current.changeSummary !== input.changeSummary ||
      !materialMatches(current as Revision, input, context) ||
      !snapshotMatches(retained as Revision, oldSnapshot)) return false;
  return true;
}

async function reviewedRevisionAttempt(
  input: KnowledgeEditInput,
  dependencies: KnowledgeRevisionDependencies,
  capture: (value: { newRevisionId: string; oldSnapshot: RevisionSnapshot; context: ContextData }) => void,
) {
  const hooks = dependencies.hooks ?? {};
  const newRevisionId = randomUUID();
  const result = await dependencies.client.$transaction(async (transaction) => {
    await hooks.beforeRootLock?.(transaction);
    const aggregate = await lockReviewedAggregate(transaction, input.knowledgeRecordId);
    const current = aggregate.currentRevision!;
    if (aggregate.lifecycle !== "ACTIVE") throw knowledgeNotEditableError();
    if (current.id !== input.expectedCurrentRevisionId) throw knowledgeCurrentAuthorityChangedError();
    if (aggregate.stateVersion !== input.expectedStateVersion) throw knowledgeConcurrentModificationError();
    if (!knowledgeDetailIsCoherent(aggregate)) throw knowledgeIntegrityError();
    if (current.trust !== "PERSONALLY_REVIEWED") throw knowledgeNotEditableError();
    if (current.revisionNumber > knowledgeMaximumMutableRevisionNumber) {
      throw knowledgeRevisionNumberExhaustedError();
    }
    const context = await resolveKnowledgeEditContextData(transaction, current, input);
    await hooks.afterContextResolved?.(transaction);
    await lockKnowledgeExternalReferences(transaction, current.id);
    const protectedCurrent = await fullRevision(transaction, current.id);
    if (!protectedCurrent) throw knowledgeIntegrityError();
    const oldSnapshot = revisionSnapshot(protectedCurrent as Revision);
    if (materialMatches(protectedCurrent as Revision, input, context)) {
      throw knowledgeNoMaterialChangeError();
    }
    if (!input.changeSummary) throw knowledgeChangeSummaryRequiredError();
    capture({ newRevisionId, oldSnapshot, context });
    const nextRevisionNumber = current.revisionNumber + 1;
    await transaction.knowledgeRecordRevision.create({
      data: {
        id: newRevisionId,
        knowledgeRecordId: aggregate.id,
        revisionNumber: nextRevisionNumber,
        origin: "REVISED",
        contentKind: input.contentKind,
        trust: "UNVERIFIED",
        title: input.title,
        normalizedTitle: normalizeTitleKey(input.title),
        bodyMarkdown: input.bodyMarkdown,
        safetyCaution: input.safetyCaution,
        ...context,
        changeSummary: input.changeSummary,
        reviewedAt: null,
      },
    });
    await hooks.afterRevisionInserted?.(transaction, newRevisionId);
    if (input.externalReferences.length) {
      await transaction.knowledgeRevisionExternalReference.createMany({
        data: input.externalReferences.map((reference, index) => ({
          id: randomUUID(),
          knowledgeRecordRevisionId: newRevisionId,
          sequence: index + 1,
          label: reference.label,
          url: reference.url,
          normalizedUrl: reference.url,
        })),
      });
    }
    await hooks.afterReferencesInserted?.(transaction, newRevisionId);
    await transaction.knowledgeRecord.update({
      where: { id: aggregate.id },
      data: { currentRevisionId: newRevisionId },
    });
    await hooks.afterPointerAdvanced?.(transaction, newRevisionId);
    const root = await transaction.knowledgeRecord.update({
      where: { id: aggregate.id },
      data: { stateVersion: { increment: 1 } },
      select: { stateVersion: true },
    });
    await hooks.afterRootUpdated?.(transaction, newRevisionId);
    if (!await reviewedRevisionResultMatches(transaction, input, newRevisionId, oldSnapshot, context)) {
      throw knowledgeIntegrityError();
    }
    await hooks.beforeCommit?.(transaction, newRevisionId);
    return {
      knowledgeRecordId: aggregate.id,
      stateVersion: root.stateVersion,
      duplicate: false,
      revisionNumber: nextRevisionNumber,
    } satisfies KnowledgeMutationResult;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5_000,
    timeout: 15_000,
  });
  await hooks.afterCommit?.(result);
  return result;
}

export async function reviseReviewedKnowledgeRecordWithDependencies(
  input: KnowledgeEditInput,
  dependencies: KnowledgeRevisionDependencies,
) {
  const parsed = parseKnowledgeEditInput(input);
  let expected: { newRevisionId: string; oldSnapshot: RevisionSnapshot; context: ContextData } | null = null;
  for (let attempt = 1; attempt <= knowledgeCreateMaximumAttempts; attempt += 1) {
    expected = null;
    try {
      return await reviewedRevisionAttempt(parsed, dependencies, (value) => { expected = value; });
    } catch (error) {
      if (error instanceof KnowledgeBaseError) throw error;
      if (isRetryableKnowledgeMutationError(error)) {
        if (attempt < knowledgeCreateMaximumAttempts) continue;
        throw knowledgePersistenceError();
      }
      try {
        const captured = expected as {
          newRevisionId: string;
          oldSnapshot: RevisionSnapshot;
          context: ContextData;
        } | null;
        if (captured && await reviewedRevisionResultMatches(
          dependencies.client,
          parsed,
          captured.newRevisionId,
          captured.oldSnapshot,
          captured.context,
        )) {
          return {
            knowledgeRecordId: parsed.knowledgeRecordId,
            stateVersion: parsed.expectedStateVersion + 1,
            duplicate: true,
            revisionNumber: captured.oldSnapshot.revisionNumber + 1,
          } satisfies KnowledgeMutationResult;
        }
      } catch {
        // Ambiguous reconciliation is intentionally non-diagnostic.
      }
      throw knowledgePersistenceError();
    }
  }
  throw knowledgePersistenceError();
}

export async function mutateKnowledgeRecordWithDependencies(
  input: KnowledgeEditInput,
  dependencies: KnowledgeRevisionDependencies & KnowledgeEditReviewDependencies,
) {
  try {
    return await updateUnverifiedKnowledgeRecordWithDependencies(input, dependencies);
  } catch (error) {
    if (!(error instanceof KnowledgeBaseError) || error.code !== "RECORD_NOT_EDITABLE") throw error;
    return reviseReviewedKnowledgeRecordWithDependencies(input, dependencies);
  }
}
