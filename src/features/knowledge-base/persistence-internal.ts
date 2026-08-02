import { randomUUID } from "node:crypto";

import { Prisma, type EquipmentCategory, type PrismaClient } from "@prisma/client";

import { knowledgeCreateMaximumAttempts } from "./constants";
import { knowledgeDetailIsCoherent, knowledgeDetailSelect } from "./data-internal";
import {
  KnowledgeBaseError,
  knowledgeIntegrityError,
  knowledgePersistenceError,
} from "./errors";
import { fingerprintKnowledgeCreatePayload } from "./fingerprint";
import { normalizeSingleLineText, normalizeTitleKey } from "./normalization";
import {
  isKnowledgeSubmissionKeyUniqueError,
  isRetryableKnowledgeCreateError,
} from "./retry";
import type {
  KnowledgeContextSnapshot,
  KnowledgeCreateInput,
  KnowledgeCreateResult,
} from "./types";
import { parseKnowledgeCreateInput } from "./validation";

type MineContextRow = Readonly<{
  mineId: string;
  mineName: string;
  mineStatus: string;
  cityName: string;
  cityState: string | null;
}>;

type EquipmentContextRow = Readonly<{
  equipmentId: string;
  equipmentDisplayName: string;
  equipmentNumber: string | null;
  equipmentCategory: EquipmentCategory;
  equipmentStatus: string;
  mineId: string;
  mineName: string;
  cityName: string;
  cityState: string | null;
}>;

type KnowledgeCreateTransaction = Prisma.TransactionClient;

export type KnowledgeCreateInternalHooks = Readonly<{
  afterContextResolved?: (
    transaction: KnowledgeCreateTransaction,
    context: KnowledgeContextSnapshot,
  ) => Promise<void>;
  afterReferencesInserted?: (
    transaction: KnowledgeCreateTransaction,
    rootId: string,
  ) => Promise<void>;
  beforePointerAssignment?: (
    transaction: KnowledgeCreateTransaction,
    rootId: string,
    revisionId: string,
  ) => Promise<void>;
  afterCommit?: (result: KnowledgeCreateResult) => Promise<void>;
}>;

export type KnowledgeCreateDependencies = Readonly<{
  client: PrismaClient;
  hooks?: KnowledgeCreateInternalHooks;
}>;

function validSnapshotText(value: string) {
  return value.trim().length > 0;
}

function snapshot(value: string) {
  return normalizeSingleLineText(value);
}

function optionalSnapshot(value: string | null) {
  const normalized = value === null ? "" : snapshot(value);
  return normalized.length > 0 ? normalized : null;
}

export async function resolveKnowledgeContext(
  transaction: KnowledgeCreateTransaction,
  input: Pick<KnowledgeCreateInput, "contextKind" | "mineId" | "equipmentId">,
): Promise<KnowledgeContextSnapshot> {
  if (input.contextKind === "GENERAL") return { kind: "GENERAL" };

  if (input.contextKind === "MINE" && input.mineId) {
    const rows = await transaction.$queryRaw<MineContextRow[]>(Prisma.sql`
      SELECT
        m."id" AS "mineId",
        m."name" AS "mineName",
        m."status"::text AS "mineStatus",
        c."name" AS "cityName",
        c."state" AS "cityState"
      FROM "Mine" m
      INNER JOIN "City" c ON c."id" = m."cityId"
      WHERE m."id" = ${input.mineId}
      FOR KEY SHARE OF m, c
    `);
    const mine = rows[0];
    if (!mine) {
      throw new KnowledgeBaseError(
        "REFERENCE_NOT_FOUND",
        "The selected Mine could not be found.",
        "mineId",
      );
    }
    if (mine.mineStatus !== "ACTIVE") {
      throw new KnowledgeBaseError(
        "REFERENCE_INACTIVE",
        "Select an active Mine.",
        "mineId",
      );
    }
    if (!validSnapshotText(mine.mineName) || !validSnapshotText(mine.cityName)) {
      throw knowledgeIntegrityError();
    }
    return {
      kind: "MINE",
      mineId: mine.mineId,
      mineName: snapshot(mine.mineName),
      cityName: snapshot(mine.cityName),
      cityState: optionalSnapshot(mine.cityState),
    };
  }

  if (input.contextKind === "EQUIPMENT" && input.equipmentId) {
    const rows = await transaction.$queryRaw<EquipmentContextRow[]>(Prisma.sql`
      SELECT
        e."id" AS "equipmentId",
        e."displayName" AS "equipmentDisplayName",
        e."equipmentNumber" AS "equipmentNumber",
        e."category" AS "equipmentCategory",
        e."status"::text AS "equipmentStatus",
        m."id" AS "mineId",
        m."name" AS "mineName",
        c."name" AS "cityName",
        c."state" AS "cityState"
      FROM "Equipment" e
      INNER JOIN "Mine" m ON m."id" = e."mineId"
      INNER JOIN "City" c ON c."id" = m."cityId"
      WHERE e."id" = ${input.equipmentId}
      FOR KEY SHARE OF e, m, c
    `);
    const equipment = rows[0];
    if (!equipment) {
      throw new KnowledgeBaseError(
        "REFERENCE_NOT_FOUND",
        "The selected Equipment could not be found.",
        "equipmentId",
      );
    }
    if (equipment.equipmentStatus !== "ACTIVE") {
      throw new KnowledgeBaseError(
        "REFERENCE_INACTIVE",
        "Select active Equipment.",
        "equipmentId",
      );
    }
    if (
      !validSnapshotText(equipment.equipmentDisplayName) ||
      !validSnapshotText(equipment.mineName) ||
      !validSnapshotText(equipment.cityName)
    ) {
      throw knowledgeIntegrityError();
    }
    return {
      kind: "EQUIPMENT",
      equipmentId: equipment.equipmentId,
      equipmentDisplayName: snapshot(equipment.equipmentDisplayName),
      equipmentNumber: optionalSnapshot(equipment.equipmentNumber),
      equipmentCategory: equipment.equipmentCategory,
      mineId: equipment.mineId,
      mineName: snapshot(equipment.mineName),
      cityName: snapshot(equipment.cityName),
      cityState: optionalSnapshot(equipment.cityState),
    };
  }
  throw new KnowledgeBaseError(
    "INVALID_CONTEXT",
    "Choose one valid Knowledge Record context.",
    "contextKind",
  );
}

async function loadSubmissionAggregate(
  client: PrismaClient | Prisma.TransactionClient,
  submissionKey: string,
) {
  return client.knowledgeRecord.findUnique({
    where: { createSubmissionKey: submissionKey },
    select: {
      ...knowledgeDetailSelect,
      createSubmissionFingerprint: true,
    },
  });
}

async function reconcileSubmission(
  client: PrismaClient | Prisma.TransactionClient,
  submissionKey: string,
  fingerprint: string,
): Promise<KnowledgeCreateResult | null> {
  const existing = await loadSubmissionAggregate(client, submissionKey);
  if (!existing) return null;
  if (!knowledgeDetailIsCoherent(existing)) throw knowledgeIntegrityError();
  if (existing.createSubmissionFingerprint !== fingerprint) {
    throw new KnowledgeBaseError(
      "DUPLICATE_SUBMISSION_CONFLICT",
      "This form submission key was already used for different Knowledge Record content.",
    );
  }
  return { knowledgeRecordId: existing.id, duplicate: true };
}

export function knowledgeRevisionContextData(context: KnowledgeContextSnapshot) {
  const cleared = {
    mineId: null,
    equipmentId: null,
    equipmentDisplayNameSnapshot: null,
    equipmentNumberSnapshot: null,
    equipmentCategorySnapshot: null,
    mineNameSnapshot: null,
    cityNameSnapshot: null,
    cityStateSnapshot: null,
  };
  if (context.kind === "GENERAL") {
    return { ...cleared, contextKind: "GENERAL" as const };
  }
  if (context.kind === "MINE") {
    return {
      ...cleared,
      contextKind: "MINE" as const,
      mineId: context.mineId,
      mineNameSnapshot: context.mineName,
      cityNameSnapshot: context.cityName,
      cityStateSnapshot: context.cityState,
    };
  }
  return {
    ...cleared,
    contextKind: "EQUIPMENT" as const,
    mineId: context.mineId,
    equipmentId: context.equipmentId,
    equipmentDisplayNameSnapshot: context.equipmentDisplayName,
    equipmentNumberSnapshot: context.equipmentNumber,
    equipmentCategorySnapshot: context.equipmentCategory,
    mineNameSnapshot: context.mineName,
    cityNameSnapshot: context.cityName,
    cityStateSnapshot: context.cityState,
  };
}

async function createAttempt(
  client: PrismaClient,
  input: KnowledgeCreateInput,
  hooks: KnowledgeCreateInternalHooks,
  captureFingerprint: (fingerprint: string) => void,
): Promise<KnowledgeCreateResult> {
  const result = await client.$transaction(
    async (transaction) => {
      const context = await resolveKnowledgeContext(transaction, input);
      await hooks.afterContextResolved?.(transaction, context);
      const fingerprint = fingerprintKnowledgeCreatePayload(input, context);
      captureFingerprint(fingerprint);
      const duplicate = await reconcileSubmission(
        transaction,
        input.submissionKey,
        fingerprint,
      );
      if (duplicate) return duplicate;

      const rootId = randomUUID();
      const revisionId = randomUUID();
      await transaction.knowledgeRecord.create({
        data: {
          id: rootId,
          lifecycle: "ACTIVE",
          stateVersion: 1,
          createSubmissionKey: input.submissionKey,
          createSubmissionFingerprint: fingerprint,
          archivedAt: null,
        },
      });
      await transaction.knowledgeRecordRevision.create({
        data: {
          id: revisionId,
          knowledgeRecordId: rootId,
          revisionNumber: 1,
          origin: "INITIAL",
          contentKind: input.contentKind,
          trust: "UNVERIFIED",
          title: input.title,
          normalizedTitle: normalizeTitleKey(input.title),
          bodyMarkdown: input.bodyMarkdown,
          safetyCaution: input.safetyCaution,
          ...knowledgeRevisionContextData(context),
          changeSummary: null,
          reviewedAt: null,
        },
      });
      if (input.externalReferences.length > 0) {
        await transaction.knowledgeRevisionExternalReference.createMany({
          data: input.externalReferences.map((reference, index) => ({
            id: randomUUID(),
            knowledgeRecordRevisionId: revisionId,
            sequence: index + 1,
            label: reference.label,
            url: reference.url,
            normalizedUrl: reference.url,
          })),
        });
      }
      await hooks.afterReferencesInserted?.(transaction, rootId);
      await hooks.beforePointerAssignment?.(transaction, rootId, revisionId);
      await transaction.knowledgeRecord.update({
        where: { id: rootId },
        data: { currentRevisionId: revisionId },
      });
      const completed = await transaction.knowledgeRecord.findUnique({
        where: { id: rootId },
        select: knowledgeDetailSelect,
      });
      if (!completed || !knowledgeDetailIsCoherent(completed)) {
        throw knowledgeIntegrityError();
      }
      return { knowledgeRecordId: rootId, duplicate: false };
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

export async function createKnowledgeRecordWithDependencies(
  input: KnowledgeCreateInput,
  dependencies: KnowledgeCreateDependencies,
): Promise<KnowledgeCreateResult> {
  const parsed = parseKnowledgeCreateInput(input);
  const hooks = dependencies.hooks ?? {};
  let expectedFingerprint: string | null = null;
  for (let attempt = 1; attempt <= knowledgeCreateMaximumAttempts; attempt += 1) {
    try {
      return await createAttempt(
        dependencies.client,
        parsed,
        hooks,
        (fingerprint) => {
          expectedFingerprint = fingerprint;
        },
      );
    } catch (error) {
      if (error instanceof KnowledgeBaseError) throw error;
      if (isKnowledgeSubmissionKeyUniqueError(error)) {
        if (!expectedFingerprint) throw knowledgePersistenceError();
        const reconciled = await reconcileSubmission(
          dependencies.client,
          parsed.submissionKey,
          expectedFingerprint,
        );
        if (reconciled) return reconciled;
        throw knowledgePersistenceError();
      }

      if (
        isRetryableKnowledgeCreateError(error) &&
        attempt < knowledgeCreateMaximumAttempts
      ) {
        continue;
      }

      // A connection failure may occur after commit. Reconcile using only the
      // immutable submission identity; never replay an ambiguous outcome.
      try {
        if (!expectedFingerprint) throw knowledgePersistenceError();
        const reconciled = await reconcileSubmission(
          dependencies.client,
          parsed.submissionKey,
          expectedFingerprint,
        );
        if (reconciled) return reconciled;
      } catch (reconciliationError) {
        if (reconciliationError instanceof KnowledgeBaseError) {
          throw reconciliationError;
        }
      }
      throw knowledgePersistenceError();
    }
  }
  throw knowledgePersistenceError();
}
