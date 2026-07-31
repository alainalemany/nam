import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  SupplyRequestDailyLogLinkError,
  unexpectedSupplyRequestDailyLogLinkError,
} from "./daily-log-link-errors";
import { runSupplyRequestDailyLogLinkWithRetry } from "./daily-log-link-retry";
import type { SupplyRequestDailyLogRoleValue } from "./daily-log-link-types";
import {
  compatibilityMessage,
  parseRemoveSupplyRequestDailyLogLinkInput,
  parseSetSupplyRequestDailyLogLinkInput,
  validateSupplyRequestDailyLogCompatibility,
  type RemoveSupplyRequestDailyLogLinkInput,
  type SetSupplyRequestDailyLogLinkInput,
  type ValidatedRemoveSupplyRequestDailyLogLinkInput,
  type ValidatedSetSupplyRequestDailyLogLinkInput,
} from "./daily-log-link-validation";
import { getCurrentSupplyRequestDetailWithClient } from "./surface-data-internal";

export type SetSupplyRequestDailyLogLinkResult = Readonly<{
  supplyRequestId: string;
  namReference: string;
  role: SupplyRequestDailyLogRoleValue;
  dailyLogActivityId: string;
  operation: "CREATED" | "REPLACED" | "RETAINED";
}>;

export type RemoveSupplyRequestDailyLogLinkResult = Readonly<{
  supplyRequestId: string;
  namReference: string;
  role: SupplyRequestDailyLogRoleValue;
  removedDailyLogActivityId: string;
}>;

export type SupplyRequestDailyLogLinkDependencies = Readonly<{
  client: PrismaClient;
  generateId?: () => string;
  afterRootLocked?: () => void | Promise<void>;
  afterOldLinkDeleted?: () => void | Promise<void>;
}>;

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function invalidCurrentVersion(): never {
  throw new SupplyRequestDailyLogLinkError(
    "CURRENT_VERSION_INVALID",
    "The Supply Request current-version state is invalid. Reload before managing Daily Log links.",
  );
}

function nextId(generateId: () => string) {
  const id = generateId();
  if (typeof id !== "string" || id.trim().length === 0) {
    throw unexpectedSupplyRequestDailyLogLinkError();
  }
  return id;
}

async function lockSupplyRequestRoot(
  transaction: Prisma.TransactionClient,
  supplyRequestId: string,
) {
  const locked = await transaction.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "SupplyRequest"
      WHERE "id" = ${supplyRequestId}
      FOR UPDATE
    `,
  );
  if (locked.length === 0) {
    throw new SupplyRequestDailyLogLinkError(
      "REQUEST_NOT_FOUND",
      "The Supply Request could not be found.",
    );
  }
  if (
    locked.length !== 1 ||
    typeof locked[0]?.id !== "string" ||
    locked[0].id !== supplyRequestId
  ) {
    invalidCurrentVersion();
  }
}

async function loadLockedCurrentDetail(
  transaction: Prisma.TransactionClient,
  supplyRequestId: string,
) {
  const detail = await getCurrentSupplyRequestDetailWithClient(
    transaction,
    supplyRequestId,
  );
  if (!detail) invalidCurrentVersion();
  return detail;
}

function assertExpectedLink(
  expectedActivityId: string | undefined,
  actualActivityId: string | undefined,
) {
  if (expectedActivityId !== actualActivityId) {
    throw new SupplyRequestDailyLogLinkError(
      "STALE_LINK_STATE",
      "This Daily Log link changed after the page was loaded. Reload before trying again.",
    );
  }
}

function mapCompatibilityIssue(issue: ReturnType<typeof validateSupplyRequestDailyLogCompatibility>) {
  if (!issue) return;
  throw new SupplyRequestDailyLogLinkError(
    issue,
    compatibilityMessage(issue),
    "dailyLogActivityId",
  );
}

function mapKnownUniqueFailure(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = error.meta?.target;
    const fields = Array.isArray(target)
      ? target.filter((value): value is string => typeof value === "string")
      : typeof target === "string"
        ? [target]
        : [];
    if (
      fields.includes("dailyLogActivityId") ||
      fields.includes("SupplyRequestDailyLogLink_activity_key")
    ) {
      throw new SupplyRequestDailyLogLinkError(
        "ACTIVITY_ALREADY_LINKED",
        "That Daily Log Activity is already linked to a Supply Request role. Reload and choose another Activity.",
        "dailyLogActivityId",
      );
    }
    if (
      (fields.includes("supplyRequestId") && fields.includes("role")) ||
      fields.includes("SupplyRequestDailyLogLink_request_role_key")
    ) {
      throw new SupplyRequestDailyLogLinkError(
        "STALE_LINK_STATE",
        "This Daily Log link changed after the page was loaded. Reload before trying again.",
      );
    }
  }
  throw unexpectedSupplyRequestDailyLogLinkError();
}

async function setAttempt(
  client: PrismaClient,
  input: ValidatedSetSupplyRequestDailyLogLinkInput,
  generateId: () => string,
  afterRootLocked?: () => void | Promise<void>,
  afterOldLinkDeleted?: () => void | Promise<void>,
): Promise<SetSupplyRequestDailyLogLinkResult> {
  try {
    return await client.$transaction(
      async (transaction) => {
        await lockSupplyRequestRoot(transaction, input.supplyRequestId);
        await afterRootLocked?.();
        const detail = await loadLockedCurrentDetail(
          transaction,
          input.supplyRequestId,
        );
        const existing = await transaction.supplyRequestDailyLogLink.findUnique({
          where: {
            supplyRequestId_role: {
              supplyRequestId: input.supplyRequestId,
              role: input.role,
            },
          },
          select: { id: true, dailyLogActivityId: true },
        });
        assertExpectedLink(
          input.expectedDailyLogActivityId,
          existing?.dailyLogActivityId,
        );

        const lockedActivities = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT "id"
            FROM "DailyLogActivity"
            WHERE "id" = ${input.dailyLogActivityId}
            FOR UPDATE
          `,
        );
        if (lockedActivities.length === 0) {
          throw new SupplyRequestDailyLogLinkError(
            "ACTIVITY_NOT_FOUND",
            "The selected Daily Log Activity could not be found.",
            "dailyLogActivityId",
          );
        }
        if (
          lockedActivities.length !== 1 ||
          lockedActivities[0]?.id !== input.dailyLogActivityId
        ) {
          throw unexpectedSupplyRequestDailyLogLinkError();
        }

        const activity = await transaction.dailyLogActivity.findUnique({
          where: { id: input.dailyLogActivityId },
          select: {
            id: true,
            activityType: true,
            title: true,
            activityDate: true,
            equipmentId: true,
            dailyLog: { select: { id: true, logDate: true } },
            supplyRequestLink: {
              select: {
                id: true,
                supplyRequestId: true,
                role: true,
              },
            },
          },
        });
        if (!activity) {
          throw new SupplyRequestDailyLogLinkError(
            "ACTIVITY_NOT_FOUND",
            "The selected Daily Log Activity could not be found.",
            "dailyLogActivityId",
          );
        }
        mapCompatibilityIssue(
          validateSupplyRequestDailyLogCompatibility(
            input.role,
            {
              namReference: detail.namReference,
              status: detail.status,
              operationalWorkDate: detail.operationalWorkDate,
              fulfillmentOperationalWorkDate:
                detail.fulfillmentOperationalWorkDate,
              equipmentId: detail.equipmentId,
              equipmentDisplayNameSnapshot: detail.equipmentDisplayName,
              equipmentNumberSnapshot: detail.equipmentNumber,
            },
            {
              activityType: activity.activityType,
              title: activity.title,
              activityDate: dateKey(activity.activityDate),
              dailyLogDate: dateKey(activity.dailyLog.logDate),
              equipmentId: activity.equipmentId,
            },
          ),
        );

        if (
          activity.supplyRequestLink &&
          activity.supplyRequestLink.id !== existing?.id
        ) {
          throw new SupplyRequestDailyLogLinkError(
            "ACTIVITY_ALREADY_LINKED",
            "That Daily Log Activity is already linked to a Supply Request role. Choose another Activity.",
            "dailyLogActivityId",
          );
        }
        if (existing?.dailyLogActivityId === activity.id) {
          return {
            supplyRequestId: detail.supplyRequestId,
            namReference: detail.namReference,
            role: input.role,
            dailyLogActivityId: activity.id,
            operation: "RETAINED",
          };
        }

        if (existing) {
          await transaction.supplyRequestDailyLogLink.delete({
            where: { id: existing.id },
          });
          await afterOldLinkDeleted?.();
        }
        await transaction.supplyRequestDailyLogLink.create({
          data: {
            id: nextId(generateId),
            supplyRequestId: detail.supplyRequestId,
            dailyLogActivityId: activity.id,
            role: input.role,
          },
          select: { id: true },
        });
        return {
          supplyRequestId: detail.supplyRequestId,
          namReference: detail.namReference,
          role: input.role,
          dailyLogActivityId: activity.id,
          operation: existing ? "REPLACED" : "CREATED",
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  } catch (error) {
    if (error instanceof SupplyRequestDailyLogLinkError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      mapKnownUniqueFailure(error);
    }
    throw error;
  }
}

async function removeAttempt(
  client: PrismaClient,
  input: ValidatedRemoveSupplyRequestDailyLogLinkInput,
): Promise<RemoveSupplyRequestDailyLogLinkResult> {
  return client.$transaction(
    async (transaction) => {
      await lockSupplyRequestRoot(transaction, input.supplyRequestId);
      const root = await transaction.supplyRequest.findUnique({
        where: { id: input.supplyRequestId },
        select: { id: true, namReference: true },
      });
      if (!root) {
        throw new SupplyRequestDailyLogLinkError(
          "REQUEST_NOT_FOUND",
          "The Supply Request could not be found.",
        );
      }
      const existing = await transaction.supplyRequestDailyLogLink.findUnique({
        where: {
          supplyRequestId_role: {
            supplyRequestId: root.id,
            role: input.role,
          },
        },
        select: { id: true, dailyLogActivityId: true },
      });
      if (!existing) {
        throw new SupplyRequestDailyLogLinkError(
          "LINK_NOT_FOUND",
          "This Daily Log link is no longer present. Reload the Supply Request.",
        );
      }
      assertExpectedLink(
        input.expectedDailyLogActivityId,
        existing.dailyLogActivityId,
      );
      await transaction.supplyRequestDailyLogLink.delete({
        where: { id: existing.id },
      });
      return {
        supplyRequestId: root.id,
        namReference: root.namReference,
        role: input.role,
        removedDailyLogActivityId: existing.dailyLogActivityId,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}

export async function setSupplyRequestDailyLogLinkWithDependencies(
  input: SetSupplyRequestDailyLogLinkInput,
  dependencies: SupplyRequestDailyLogLinkDependencies,
) {
  try {
    const parsed = parseSetSupplyRequestDailyLogLinkInput(input);
    const generateId = dependencies.generateId ?? randomUUID;
    return await runSupplyRequestDailyLogLinkWithRetry(() =>
      setAttempt(
        dependencies.client,
        parsed,
        generateId,
        dependencies.afterRootLocked,
        dependencies.afterOldLinkDeleted,
      ),
    );
  } catch (error) {
    if (error instanceof SupplyRequestDailyLogLinkError) throw error;
    throw unexpectedSupplyRequestDailyLogLinkError();
  }
}

export async function removeSupplyRequestDailyLogLinkWithDependencies(
  input: RemoveSupplyRequestDailyLogLinkInput,
  dependencies: Pick<SupplyRequestDailyLogLinkDependencies, "client">,
) {
  try {
    const parsed = parseRemoveSupplyRequestDailyLogLinkInput(input);
    return await runSupplyRequestDailyLogLinkWithRetry(() =>
      removeAttempt(dependencies.client, parsed),
    );
  } catch (error) {
    if (error instanceof SupplyRequestDailyLogLinkError) throw error;
    throw unexpectedSupplyRequestDailyLogLinkError();
  }
}
