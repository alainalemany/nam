import { Prisma, type PrismaClient } from "@prisma/client";

import {
  optionLabel,
  shiftOptions,
} from "@/features/daily-logs/constants";

import {
  SupplyRequestDailyLogLinkQueryError,
} from "./daily-log-link-errors";
import type {
  SupplyRequestDailyLogLinkContext,
  SupplyRequestDailyLogLinkSummary,
  SupplyRequestDailyLogRoleValue,
} from "./daily-log-link-types";
import {
  supplyRequestDailyLogCanonicalTitle,
  supplyRequestDailyLogRoleDate,
  validateSupplyRequestDailyLogCompatibility,
} from "./daily-log-link-validation";
import {
  supplyRequestDerivedTitle,
  supplyRequestEquipmentSnapshotLabel,
} from "./surface-display";
import { getCurrentSupplyRequestDetailWithClient } from "./surface-data-internal";
import { parseSupplyRequestRouteId } from "./surface-validation";

const candidateDailyLogLimit = 50;
const candidateActivityLimit = 100;

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dailyLogHref(id: string) {
  return `/daily-logs/${encodeURIComponent(id)}`;
}

function mapExistingLink(
  link: {
    role: SupplyRequestDailyLogRoleValue;
    dailyLogActivity: {
      id: string;
      title: string;
      sequence: number;
      startTime: string | null;
      endTime: string | null;
      dailyLog: { id: string; logDate: Date };
    };
  },
): SupplyRequestDailyLogLinkSummary {
  return {
    role: link.role,
    activityId: link.dailyLogActivity.id,
    activityTitle: link.dailyLogActivity.title,
    activitySequence: link.dailyLogActivity.sequence,
    activityStartTime: link.dailyLogActivity.startTime,
    activityEndTime: link.dailyLogActivity.endTime,
    dailyLogId: link.dailyLogActivity.dailyLog.id,
    dailyLogDate: dateKey(link.dailyLogActivity.dailyLog.logDate),
    dailyLogHref: dailyLogHref(link.dailyLogActivity.dailyLog.id),
  };
}

export async function getSupplyRequestDailyLogLinkContextWithClient(
  client: PrismaClient,
  idInput: unknown,
  role: SupplyRequestDailyLogRoleValue,
): Promise<SupplyRequestDailyLogLinkContext | null> {
  const id = parseSupplyRequestRouteId(idInput);
  if (!id) return null;

  return client.$transaction(
    async (transaction) => {
      const rootExists = await transaction.supplyRequest.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!rootExists) return null;
      const detail = await getCurrentSupplyRequestDetailWithClient(transaction, id);
      if (!detail) {
        throw new SupplyRequestDailyLogLinkQueryError(
          "CURRENT_VERSION_INVALID",
        );
      }
      const aggregate = {
        namReference: detail.namReference,
        status: detail.status,
        operationalWorkDate: detail.operationalWorkDate,
        fulfillmentOperationalWorkDate: detail.fulfillmentOperationalWorkDate,
        equipmentId: detail.equipmentId,
        equipmentDisplayNameSnapshot: detail.equipmentDisplayName,
        equipmentNumberSnapshot: detail.equipmentNumber,
      } as const;
      const expectedRoleDate = supplyRequestDailyLogRoleDate(role, aggregate);
      const requiredActivityTitle = supplyRequestDailyLogCanonicalTitle(
        role,
        aggregate,
      );
      const existing = await transaction.supplyRequestDailyLogLink.findUnique({
        where: {
          supplyRequestId_role: { supplyRequestId: id, role },
        },
        select: {
          role: true,
          dailyLogActivity: {
            select: {
              id: true,
              activityType: true,
              title: true,
              activityDate: true,
              sequence: true,
              startTime: true,
              endTime: true,
              equipmentId: true,
              dailyLog: { select: { id: true, logDate: true } },
            },
          },
        },
      });
      if (existing) {
        const issue = validateSupplyRequestDailyLogCompatibility(role, aggregate, {
          activityType: existing.dailyLogActivity.activityType,
          title: existing.dailyLogActivity.title,
          activityDate: dateKey(existing.dailyLogActivity.activityDate),
          dailyLogDate: dateKey(existing.dailyLogActivity.dailyLog.logDate),
          equipmentId: existing.dailyLogActivity.equipmentId,
        });
        if (issue) {
          throw new SupplyRequestDailyLogLinkQueryError(
            "LINK_INTEGRITY_INVALID",
            "The existing Daily Log link is incompatible with the current Supply Request. Remove or repair the link before continuing.",
          );
        }
      }

      const eligible = role === "SUBMISSION" || expectedRoleDate !== null;
      const dailyLogs = !eligible || !expectedRoleDate
        ? []
        : await transaction.dailyLog.findMany({
            where: { logDate: new Date(`${expectedRoleDate}T00:00:00.000Z`) },
            select: {
              id: true,
              logDate: true,
              shift: true,
              summary: true,
              mine: {
                select: {
                  name: true,
                  city: { select: { name: true, state: true } },
                },
              },
              primaryEquipment: {
                select: { displayName: true, equipmentNumber: true },
              },
              activities: {
                where: {
                  activityDate: new Date(`${expectedRoleDate}T00:00:00.000Z`),
                  activityType: "SUPPLY_REQUEST",
                  title: requiredActivityTitle,
                  AND: [
                    detail.equipmentId === null
                      ? { equipmentId: null }
                      : {
                          OR: [
                            { equipmentId: null },
                            { equipmentId: detail.equipmentId },
                          ],
                        },
                    {
                      OR: [
                        { supplyRequestLink: { is: null } },
                        {
                          supplyRequestLink: {
                            is: { supplyRequestId: id, role },
                          },
                        },
                      ],
                    },
                  ],
                },
                select: {
                  id: true,
                  dailyLogId: true,
                  sequence: true,
                  startTime: true,
                  endTime: true,
                  title: true,
                  equipment: {
                    select: { displayName: true, equipmentNumber: true },
                  },
                  supplyRequestLink: {
                    select: { supplyRequestId: true, role: true },
                  },
                },
                orderBy: [{ sequence: "asc" }, { id: "asc" }],
                take: candidateActivityLimit,
              },
            },
            orderBy: [
              { shift: "asc" },
              { createdAt: "asc" },
              { id: "asc" },
            ],
            take: candidateDailyLogLimit,
          });

      return {
        supplyRequestId: detail.supplyRequestId,
        namReference: detail.namReference,
        currentVersionNumber: detail.versionNumber,
        currentStatus: detail.status,
        requestTitle: supplyRequestDerivedTitle(
          detail.equipmentLabel,
          detail.operationalWorkDate,
        ),
        equipmentLabel: detail.equipmentLabel,
        expectedRoleDate,
        requiredActivityTitle,
        role,
        eligible,
        unavailableReason: eligible
          ? null
          : "Fulfillment linking is available only while the current Supply Request is Fulfilled with complete fulfillment facts.",
        existingLink: existing ? mapExistingLink(existing) : null,
        dailyLogs: dailyLogs.map((log) => ({
          id: log.id,
          logDate: dateKey(log.logDate),
          shiftLabel: optionLabel(shiftOptions, log.shift),
          mineLabel: log.mine
            ? `${log.mine.name} · ${log.mine.city.name}${
                log.mine.city.state ? `, ${log.mine.city.state}` : ""
              }`
            : null,
          primaryEquipmentLabel: log.primaryEquipment
            ? supplyRequestEquipmentSnapshotLabel(
                log.primaryEquipment.displayName,
                log.primaryEquipment.equipmentNumber,
              )
            : null,
          summary: log.summary,
          detailHref: dailyLogHref(log.id),
          editHref: `${dailyLogHref(log.id)}/edit`,
          activities: log.activities.map((activity) => ({
            id: activity.id,
            dailyLogId: activity.dailyLogId,
            sequence: activity.sequence,
            startTime: activity.startTime,
            endTime: activity.endTime,
            title: activity.title,
            equipmentLabel: activity.equipment
              ? supplyRequestEquipmentSnapshotLabel(
                  activity.equipment.displayName,
                  activity.equipment.equipmentNumber,
                )
              : null,
            dailyLogHref: dailyLogHref(log.id),
            currentlyLinked:
              activity.supplyRequestLink?.supplyRequestId === id &&
              activity.supplyRequestLink.role === role,
          })),
        })),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}

export const supplyRequestDailyLogCandidateLimits = {
  dailyLogs: candidateDailyLogLimit,
  activitiesPerDailyLog: candidateActivityLimit,
} as const;
