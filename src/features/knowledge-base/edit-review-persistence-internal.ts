import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import { knowledgeCreateMaximumAttempts } from "./constants";
import {
  knowledgeDetailIsCoherent,
  knowledgeDetailSelect,
} from "./data-internal";
import {
  KnowledgeBaseError,
  knowledgeConcurrentModificationError,
  knowledgeCurrentAuthorityChangedError,
  knowledgeIntegrityError,
  knowledgeNoMaterialChangeError,
  knowledgeNotEditableError,
  knowledgeNotFoundError,
  knowledgePersistenceError,
} from "./errors";
import {
  knowledgeRevisionContextData,
  resolveKnowledgeContext,
} from "./persistence-internal";
import { isRetryableKnowledgeMutationError } from "./retry";
import {
  knowledgeRelationshipDataMatches,
  retainedKnowledgeRelationshipData,
  retainedKnowledgeRelationshipMatches,
  resolveKnowledgeEditRelationships,
  type KnowledgeRelationshipData,
} from "./relationship-persistence-internal";
import type {
  KnowledgeEditInput,
  KnowledgeMutationResult,
  KnowledgeReviewInput,
} from "./types";
import {
  parseKnowledgeEditInput,
  parseKnowledgeReviewInput,
} from "./validation";
import { normalizeTitleKey } from "./normalization";

type Transaction = Prisma.TransactionClient;
type LoadedAggregate = NonNullable<
  Awaited<ReturnType<typeof loadKnowledgeMutationAggregate>>
>;
type RevisionContextData = ReturnType<typeof knowledgeRevisionContextData>;

export type KnowledgeEditReviewHooks = Readonly<{
  beforeRootLock?: (transaction: Transaction) => Promise<void>;
  afterContextResolved?: (transaction: Transaction) => Promise<void>;
  afterRelationshipsResolved?: (transaction: Transaction) => Promise<void>;
  afterReferencesDeleted?: (transaction: Transaction) => Promise<void>;
  afterRevisionUpdated?: (transaction: Transaction) => Promise<void>;
  afterReferencesInserted?: (transaction: Transaction) => Promise<void>;
  afterRootUpdated?: (transaction: Transaction) => Promise<void>;
  beforeCommit?: (transaction: Transaction) => Promise<void>;
  afterCommit?: (result: KnowledgeMutationResult) => Promise<void>;
}>;

export type KnowledgeEditReviewDependencies = Readonly<{
  client: PrismaClient;
  hooks?: KnowledgeEditReviewHooks;
  now?: () => Date;
}>;

export async function loadKnowledgeMutationAggregate(client: PrismaClient | Transaction, id: string) {
  return client.knowledgeRecord.findUnique({
    where: { id },
    select: knowledgeDetailSelect,
  });
}

async function lockAggregate(transaction: Transaction, id: string) {
  const roots = await transaction.$queryRaw<ReadonlyArray<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "KnowledgeRecord" WHERE "id" = CAST(${id} AS uuid) FOR UPDATE`,
  );
  if (roots.length === 0) throw knowledgeNotFoundError();
  if (roots.length !== 1 || roots[0]?.id !== id) throw knowledgeIntegrityError();
  const aggregate = await loadKnowledgeMutationAggregate(transaction, id);
  if (!aggregate || !aggregate.currentRevisionId || !aggregate.currentRevision) {
    throw knowledgeIntegrityError();
  }
  const revisions = await transaction.$queryRaw<ReadonlyArray<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "KnowledgeRecordRevision"
      WHERE "id" = CAST(${aggregate.currentRevisionId} AS uuid)
        AND "knowledgeRecordId" = CAST(${id} AS uuid)
      FOR UPDATE
    `,
  );
  if (
    revisions.length !== 1 ||
    revisions[0]?.id !== aggregate.currentRevisionId
  ) {
    throw knowledgeIntegrityError();
  }
  const locked = await loadKnowledgeMutationAggregate(transaction, id);
  if (
    !locked ||
    !locked.currentRevision ||
    locked.currentRevisionId !== locked.currentRevision.id ||
    locked.currentRevision.knowledgeRecordId !== locked.id
  ) {
    throw knowledgeIntegrityError();
  }
  return locked;
}

function requireMutableAuthority(
  aggregate: LoadedAggregate,
  expectedStateVersion: number,
  expectedCurrentRevisionId: string,
) {
  const revision = aggregate.currentRevision;
  if (!revision) throw knowledgeIntegrityError();
  if (aggregate.lifecycle !== "ACTIVE") throw knowledgeNotEditableError();
  if (revision.id !== expectedCurrentRevisionId) {
    throw knowledgeCurrentAuthorityChangedError();
  }
  if (aggregate.stateVersion !== expectedStateVersion) {
    throw knowledgeConcurrentModificationError();
  }
  return revision;
}

export async function lockKnowledgeExternalReferences(
  transaction: Transaction,
  revisionId: string,
) {
  await transaction.$queryRaw(
    Prisma.sql`
      SELECT "id"
      FROM "KnowledgeRevisionExternalReference"
      WHERE "knowledgeRecordRevisionId" = CAST(${revisionId} AS uuid)
      ORDER BY "sequence", "id"
      FOR UPDATE
    `,
  );
}

export function retainedKnowledgeContextData(
  revision: NonNullable<LoadedAggregate["currentRevision"]>,
): RevisionContextData {
  return {
    contextKind: revision.contextKind,
    mineId: revision.mineId,
    equipmentId: revision.equipmentId,
    equipmentDisplayNameSnapshot: revision.equipmentDisplayNameSnapshot,
    equipmentNumberSnapshot: revision.equipmentNumberSnapshot,
    equipmentCategorySnapshot: revision.equipmentCategorySnapshot,
    mineNameSnapshot: revision.mineNameSnapshot,
    cityNameSnapshot: revision.cityNameSnapshot,
    cityStateSnapshot: revision.cityStateSnapshot,
  } as RevisionContextData;
}

export async function resolveKnowledgeEditContextData(
  transaction: Transaction,
  revision: NonNullable<LoadedAggregate["currentRevision"]>,
  input: KnowledgeEditInput,
): Promise<RevisionContextData> {
  const unchanged =
    revision.contextKind === input.contextKind &&
    ((input.contextKind === "GENERAL" &&
      revision.mineId === null &&
      revision.equipmentId === null) ||
      (input.contextKind === "MINE" &&
        revision.mineId === input.mineId &&
        revision.equipmentId === null) ||
      (input.contextKind === "EQUIPMENT" &&
        revision.equipmentId === input.equipmentId));
  if (unchanged) {
    if (input.contextKind === "MINE" && input.mineId) {
      const rows = await transaction.$queryRaw<ReadonlyArray<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Mine" WHERE "id" = ${input.mineId} FOR KEY SHARE`,
      );
      if (rows.length !== 1) throw knowledgeIntegrityError();
    }
    if (input.contextKind === "EQUIPMENT" && input.equipmentId) {
      const rows = await transaction.$queryRaw<ReadonlyArray<{ id: string }>>(
        Prisma.sql`
          SELECT e."id"
          FROM "Equipment" e
          INNER JOIN "Mine" m ON m."id" = e."mineId"
          INNER JOIN "City" c ON c."id" = m."cityId"
          WHERE e."id" = ${input.equipmentId}
          FOR KEY SHARE OF e, m, c
        `,
      );
      if (rows.length !== 1) throw knowledgeIntegrityError();
    }
    return retainedKnowledgeContextData(revision);
  }
  if (
    (input.contextKind === "MINE" && !input.mineId) ||
    (input.contextKind === "EQUIPMENT" && !input.equipmentId)
  ) {
    throw new KnowledgeBaseError(
      "INVALID_CONTEXT",
      "Choose an active Mine or Equipment when changing context.",
      "contextKind",
    );
  }
  return knowledgeRevisionContextData(
    await resolveKnowledgeContext(transaction, input),
  );
}

export function knowledgeContextDataMatches(
  revision: NonNullable<LoadedAggregate["currentRevision"]>,
  data: RevisionContextData,
) {
  return (
    revision.contextKind === data.contextKind &&
    revision.mineId === data.mineId &&
    revision.equipmentId === data.equipmentId &&
    revision.equipmentDisplayNameSnapshot === data.equipmentDisplayNameSnapshot &&
    revision.equipmentNumberSnapshot === data.equipmentNumberSnapshot &&
    revision.equipmentCategorySnapshot === data.equipmentCategorySnapshot &&
    revision.mineNameSnapshot === data.mineNameSnapshot &&
    revision.cityNameSnapshot === data.cityNameSnapshot &&
    revision.cityStateSnapshot === data.cityStateSnapshot
  );
}

function editResultMatches(
  aggregate: LoadedAggregate,
  input: KnowledgeEditInput,
  expectedContext: RevisionContextData,
  expectedRelationships: KnowledgeRelationshipData,
) {
  const revision = aggregate.currentRevision;
  if (
    !revision ||
    !knowledgeDetailIsCoherent(aggregate) ||
    aggregate.lifecycle !== "ACTIVE" ||
    aggregate.stateVersion !== input.expectedStateVersion + 1 ||
    revision.id !== input.expectedCurrentRevisionId ||
    revision.trust !== "UNVERIFIED" ||
    revision.contentKind !== input.contentKind ||
    revision.title !== input.title ||
    revision.normalizedTitle !== normalizeTitleKey(input.title) ||
    revision.bodyMarkdown !== input.bodyMarkdown ||
    revision.safetyCaution !== input.safetyCaution ||
    revision.externalReferences.length !== input.externalReferences.length
  ) {
    return false;
  }
  if (
    !knowledgeContextDataMatches(revision, expectedContext) ||
    !knowledgeRelationshipDataMatches(revision, expectedRelationships)
  ) return false;
  return revision.externalReferences.every((reference, index) => {
    const expected = input.externalReferences[index];
    return (
      reference.sequence === index + 1 &&
      reference.label === expected?.label &&
      reference.url === expected?.url &&
      reference.normalizedUrl === expected?.url
    );
  });
}

function editMaterialMatches(
  aggregate: LoadedAggregate,
  input: KnowledgeEditInput,
  expectedContext: RevisionContextData,
  expectedRelationships: KnowledgeRelationshipData,
) {
  const revision = aggregate.currentRevision;
  return Boolean(
    revision &&
    revision.id === input.expectedCurrentRevisionId &&
    revision.trust === "UNVERIFIED" &&
    revision.contentKind === input.contentKind &&
    revision.title === input.title &&
    revision.normalizedTitle === normalizeTitleKey(input.title) &&
    revision.bodyMarkdown === input.bodyMarkdown &&
    revision.safetyCaution === input.safetyCaution &&
    knowledgeContextDataMatches(revision, expectedContext) &&
    knowledgeRelationshipDataMatches(revision, expectedRelationships) &&
    revision.externalReferences.length === input.externalReferences.length &&
    revision.externalReferences.every((reference, index) => {
      const expected = input.externalReferences[index];
      return reference.sequence === index + 1 &&
        reference.label === expected?.label &&
        reference.url === expected?.url &&
        reference.normalizedUrl === expected?.url;
    })
  );
}

async function reconcileEdit(
  client: PrismaClient,
  input: KnowledgeEditInput,
  expectedContext: RevisionContextData,
  expectedRelationships: KnowledgeRelationshipData,
) {
  const aggregate = await loadKnowledgeMutationAggregate(client, input.knowledgeRecordId);
  if (!aggregate) return null;
  if (!editResultMatches(aggregate, input, expectedContext, expectedRelationships)) return null;
  return {
    knowledgeRecordId: aggregate.id,
    stateVersion: aggregate.stateVersion,
    duplicate: true,
    revisionNumber: aggregate.currentRevision!.revisionNumber,
  } satisfies KnowledgeMutationResult;
}

async function editAttempt(
  client: PrismaClient,
  input: KnowledgeEditInput,
  hooks: KnowledgeEditReviewHooks,
  captureContext: (context: RevisionContextData) => void,
  captureRelationships: (relationships: KnowledgeRelationshipData) => void,
) {
  const result = await client.$transaction(
    async (transaction) => {
      await hooks.beforeRootLock?.(transaction);
      const aggregate = await lockAggregate(transaction, input.knowledgeRecordId);
      const revision = requireMutableAuthority(
        aggregate,
        input.expectedStateVersion,
        input.expectedCurrentRevisionId,
      );
      if (!knowledgeDetailIsCoherent(aggregate)) throw knowledgeIntegrityError();
      if (revision.trust !== "UNVERIFIED") throw knowledgeNotEditableError();
      if (input.changeSummary !== null) {
        throw new KnowledgeBaseError(
          "INVALID_INPUT",
          "Change summary is only used for Personally Reviewed material.",
          "changeSummary",
        );
      }

      const context = await resolveKnowledgeEditContextData(transaction, revision, input);
      captureContext(context);
      await hooks.afterContextResolved?.(transaction);
      const relationships = await resolveKnowledgeEditRelationships(transaction, revision, input);
      captureRelationships(relationships);
      await hooks.afterRelationshipsResolved?.(transaction);
      await lockKnowledgeExternalReferences(transaction, revision.id);
      if (editMaterialMatches(aggregate, input, context, relationships)) {
        throw knowledgeNoMaterialChangeError();
      }
      await transaction.knowledgeRevisionExternalReference.deleteMany({
        where: { knowledgeRecordRevisionId: revision.id },
      });
      await hooks.afterReferencesDeleted?.(transaction);

      await transaction.knowledgeRecordRevision.update({
        where: { id: revision.id },
        data: {
          title: input.title,
          normalizedTitle: normalizeTitleKey(input.title),
          contentKind: input.contentKind,
          bodyMarkdown: input.bodyMarkdown,
          safetyCaution: input.safetyCaution,
          ...context,
          ...relationships,
        },
      });
      await hooks.afterRevisionUpdated?.(transaction);
      if (input.externalReferences.length > 0) {
        await transaction.knowledgeRevisionExternalReference.createMany({
          data: input.externalReferences.map((reference, index) => ({
            id: randomUUID(),
            knowledgeRecordRevisionId: revision.id,
            sequence: index + 1,
            label: reference.label,
            url: reference.url,
            normalizedUrl: reference.url,
          })),
        });
      }
      await hooks.afterReferencesInserted?.(transaction);
      const root = await transaction.knowledgeRecord.update({
        where: { id: aggregate.id },
        data: { stateVersion: { increment: 1 } },
        select: { stateVersion: true },
      });
      await hooks.afterRootUpdated?.(transaction);
      const completed = await loadKnowledgeMutationAggregate(transaction, aggregate.id);
      if (
        !completed ||
        !editResultMatches(completed, input, context, relationships)
      ) {
        throw knowledgeIntegrityError();
      }
      await hooks.beforeCommit?.(transaction);
      return {
        knowledgeRecordId: aggregate.id,
        stateVersion: root.stateVersion,
        duplicate: false,
        revisionNumber: revision.revisionNumber,
      } satisfies KnowledgeMutationResult;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
  await hooks.afterCommit?.(result);
  return result;
}

export async function updateUnverifiedKnowledgeRecordWithDependencies(
  input: KnowledgeEditInput,
  dependencies: KnowledgeEditReviewDependencies,
) {
  const parsed = parseKnowledgeEditInput(input);
  const hooks = dependencies.hooks ?? {};
  let expectedContext: RevisionContextData | null = null;
  let expectedRelationships: KnowledgeRelationshipData | null = null;
  for (let attempt = 1; attempt <= knowledgeCreateMaximumAttempts; attempt += 1) {
    expectedContext = null;
    expectedRelationships = null;
    try {
      return await editAttempt(
        dependencies.client,
        parsed,
        hooks,
        (context) => {
          expectedContext = context;
        },
        (relationships) => {
          expectedRelationships = relationships;
        },
      );
    } catch (error) {
      if (error instanceof KnowledgeBaseError) throw error;
      if (isRetryableKnowledgeMutationError(error)) {
        if (attempt < knowledgeCreateMaximumAttempts) continue;
        throw knowledgePersistenceError();
      }
      try {
        if (!expectedContext || !expectedRelationships) {
          throw knowledgePersistenceError();
        }
        const reconciled = await reconcileEdit(
          dependencies.client,
          parsed,
          expectedContext,
          expectedRelationships,
        );
        if (reconciled) return reconciled;
      } catch {
        // Reconciliation is intentionally non-diagnostic at the public boundary.
      }
      throw knowledgePersistenceError();
    }
  }
  throw knowledgePersistenceError();
}

type ReviewMaterialSnapshot = Readonly<{
  revisionNumber: number;
  origin: NonNullable<LoadedAggregate["currentRevision"]>["origin"];
  contentKind: NonNullable<LoadedAggregate["currentRevision"]>["contentKind"];
  title: string;
  normalizedTitle: string;
  bodyMarkdown: string;
  safetyCaution: string | null;
  context: RevisionContextData;
  relationships: KnowledgeRelationshipData;
  changeSummary: string | null;
  createdAt: number;
  references: readonly Readonly<{
    sequence: number;
    label: string;
    url: string;
    normalizedUrl: string;
  }>[];
}>;

function reviewMaterialSnapshot(
  revision: NonNullable<LoadedAggregate["currentRevision"]>,
): ReviewMaterialSnapshot {
  return {
    revisionNumber: revision.revisionNumber,
    origin: revision.origin,
    contentKind: revision.contentKind,
    title: revision.title,
    normalizedTitle: revision.normalizedTitle,
    bodyMarkdown: revision.bodyMarkdown,
    safetyCaution: revision.safetyCaution,
    context: retainedKnowledgeContextData(revision),
    relationships: retainedKnowledgeRelationshipData(revision),
    changeSummary: revision.changeSummary,
    createdAt: revision.createdAt.getTime(),
    references: revision.externalReferences.map((reference) => ({
      sequence: reference.sequence,
      label: reference.label,
      url: reference.url,
      normalizedUrl: reference.normalizedUrl,
    })),
  };
}

function retainedLiveIdMatches(
  actual: string | null,
  expected: string | null,
) {
  return actual === expected || (expected !== null && actual === null);
}

function reviewMaterialMatches(
  revision: NonNullable<LoadedAggregate["currentRevision"]>,
  expected: ReviewMaterialSnapshot,
) {
  const actualContext = retainedKnowledgeContextData(revision);
  return (
    revision.revisionNumber === expected.revisionNumber &&
    revision.origin === expected.origin &&
    revision.contentKind === expected.contentKind &&
    revision.title === expected.title &&
    revision.normalizedTitle === expected.normalizedTitle &&
    revision.bodyMarkdown === expected.bodyMarkdown &&
    revision.safetyCaution === expected.safetyCaution &&
    actualContext.contextKind === expected.context.contextKind &&
    retainedLiveIdMatches(actualContext.mineId, expected.context.mineId) &&
    retainedLiveIdMatches(
      actualContext.equipmentId,
      expected.context.equipmentId,
    ) &&
    actualContext.equipmentDisplayNameSnapshot ===
      expected.context.equipmentDisplayNameSnapshot &&
    actualContext.equipmentNumberSnapshot ===
      expected.context.equipmentNumberSnapshot &&
    actualContext.equipmentCategorySnapshot ===
      expected.context.equipmentCategorySnapshot &&
    actualContext.mineNameSnapshot === expected.context.mineNameSnapshot &&
    actualContext.cityNameSnapshot === expected.context.cityNameSnapshot &&
    actualContext.cityStateSnapshot === expected.context.cityStateSnapshot &&
    retainedKnowledgeRelationshipMatches(revision, expected.relationships) &&
    revision.changeSummary === expected.changeSummary &&
    revision.createdAt.getTime() === expected.createdAt &&
    revision.externalReferences.length === expected.references.length &&
    revision.externalReferences.every((reference, index) => {
      const expectedReference = expected.references[index];
      if (!expectedReference) return false;
      return (
        reference.sequence === expectedReference.sequence &&
        reference.label === expectedReference.label &&
        reference.url === expectedReference.url &&
        reference.normalizedUrl === expectedReference.normalizedUrl
      );
    })
  );
}

function reviewedResultMatches(
  aggregate: LoadedAggregate,
  input: KnowledgeReviewInput,
  expectedMaterial?: ReviewMaterialSnapshot,
) {
  const revision = aggregate.currentRevision;
  return Boolean(
    revision &&
      knowledgeDetailIsCoherent(aggregate) &&
      aggregate.lifecycle === "ACTIVE" &&
      aggregate.stateVersion === input.expectedStateVersion + 1 &&
      revision.id === input.expectedCurrentRevisionId &&
      revision.trust === "PERSONALLY_REVIEWED" &&
      revision.reviewedAt &&
      (!expectedMaterial || reviewMaterialMatches(revision, expectedMaterial)),
  );
}

async function reconcileReview(
  client: PrismaClient,
  input: KnowledgeReviewInput,
  expectedMaterial: ReviewMaterialSnapshot,
) {
  const aggregate = await loadKnowledgeMutationAggregate(client, input.knowledgeRecordId);
  if (!aggregate || !reviewedResultMatches(aggregate, input, expectedMaterial)) {
    return null;
  }
  return {
    knowledgeRecordId: aggregate.id,
    stateVersion: aggregate.stateVersion,
    duplicate: true,
    revisionNumber: aggregate.currentRevision!.revisionNumber,
  } satisfies KnowledgeMutationResult;
}

async function reviewAttempt(
  client: PrismaClient,
  input: KnowledgeReviewInput,
  hooks: KnowledgeEditReviewHooks,
  now: () => Date,
  captureMaterial: (material: ReviewMaterialSnapshot) => void,
) {
  const result = await client.$transaction(
    async (transaction) => {
      await hooks.beforeRootLock?.(transaction);
      const aggregate = await lockAggregate(transaction, input.knowledgeRecordId);
      const revision = aggregate.currentRevision;
      if (!revision) throw knowledgeIntegrityError();
      if (aggregate.lifecycle !== "ACTIVE") throw knowledgeNotEditableError();
      if (revision.id !== input.expectedCurrentRevisionId) {
        throw knowledgeCurrentAuthorityChangedError();
      }
      if (revision.trust === "PERSONALLY_REVIEWED") {
        if (aggregate.stateVersion === input.expectedStateVersion + 1) {
          if (!knowledgeDetailIsCoherent(aggregate)) {
            throw knowledgeIntegrityError();
          }
          await lockKnowledgeExternalReferences(transaction, revision.id);
          const protectedDuplicate = await loadKnowledgeMutationAggregate(
            transaction,
            aggregate.id,
          );
          if (!protectedDuplicate || !reviewedResultMatches(protectedDuplicate, input)) {
            throw knowledgeIntegrityError();
          }
          return {
            knowledgeRecordId: aggregate.id,
            stateVersion: aggregate.stateVersion,
            duplicate: true,
            revisionNumber: revision.revisionNumber,
          } satisfies KnowledgeMutationResult;
        }
      }
      if (aggregate.stateVersion !== input.expectedStateVersion) {
        throw knowledgeConcurrentModificationError();
      }
      if (!knowledgeDetailIsCoherent(aggregate)) throw knowledgeIntegrityError();
      if (revision.trust !== "UNVERIFIED") throw knowledgeNotEditableError();
      await lockKnowledgeExternalReferences(transaction, revision.id);
      const protectedAggregate = await loadKnowledgeMutationAggregate(transaction, aggregate.id);
      if (
        !protectedAggregate ||
        !knowledgeDetailIsCoherent(protectedAggregate) ||
        protectedAggregate.currentRevisionId !== input.expectedCurrentRevisionId ||
        protectedAggregate.stateVersion !== input.expectedStateVersion ||
        protectedAggregate.currentRevision?.trust !== "UNVERIFIED"
      ) {
        throw knowledgeIntegrityError();
      }
      const expectedMaterial = reviewMaterialSnapshot(
        protectedAggregate.currentRevision,
      );
      captureMaterial(expectedMaterial);
      await transaction.knowledgeRecordRevision.update({
        where: { id: revision.id },
        data: { trust: "PERSONALLY_REVIEWED", reviewedAt: now() },
      });
      await hooks.afterRevisionUpdated?.(transaction);
      const root = await transaction.knowledgeRecord.update({
        where: { id: aggregate.id },
        data: { stateVersion: { increment: 1 } },
        select: { stateVersion: true },
      });
      await hooks.afterRootUpdated?.(transaction);
      const completed = await loadKnowledgeMutationAggregate(transaction, aggregate.id);
      if (!completed || !reviewedResultMatches(completed, input, expectedMaterial)) {
        throw knowledgeIntegrityError();
      }
      await hooks.beforeCommit?.(transaction);
      return {
        knowledgeRecordId: aggregate.id,
        stateVersion: root.stateVersion,
        duplicate: false,
        revisionNumber: revision.revisionNumber,
      } satisfies KnowledgeMutationResult;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
  await hooks.afterCommit?.(result);
  return result;
}

export async function reviewKnowledgeRecordWithDependencies(
  input: KnowledgeReviewInput,
  dependencies: KnowledgeEditReviewDependencies,
) {
  const parsed = parseKnowledgeReviewInput(input);
  const hooks = dependencies.hooks ?? {};
  const now = dependencies.now ?? (() => new Date());
  let expectedMaterial: ReviewMaterialSnapshot | null = null;
  for (let attempt = 1; attempt <= knowledgeCreateMaximumAttempts; attempt += 1) {
    expectedMaterial = null;
    try {
      return await reviewAttempt(
        dependencies.client,
        parsed,
        hooks,
        now,
        (material) => {
          expectedMaterial = material;
        },
      );
    } catch (error) {
      if (error instanceof KnowledgeBaseError) throw error;
      if (isRetryableKnowledgeMutationError(error)) {
        if (attempt < knowledgeCreateMaximumAttempts) continue;
        throw knowledgePersistenceError();
      }
      try {
        if (!expectedMaterial) throw knowledgePersistenceError();
        const reconciled = await reconcileReview(
          dependencies.client,
          parsed,
          expectedMaterial,
        );
        if (reconciled) return reconciled;
      } catch {
        // Reconciliation is intentionally non-diagnostic at the public boundary.
      }
      throw knowledgePersistenceError();
    }
  }
  throw knowledgePersistenceError();
}
