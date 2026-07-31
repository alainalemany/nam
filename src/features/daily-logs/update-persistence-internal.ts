import { Prisma, type PrismaClient } from "@prisma/client";

import {
  compatibilityMessage,
  validateSupplyRequestDailyLogCompatibility,
} from "@/features/supply-requests/daily-log-link-validation";
import { getCurrentSupplyRequestDetailWithClient } from "@/features/supply-requests/surface-data-internal";

import type { DailyLogFormInput } from "./validation";

export class LinkedDailyLogActivityEditError extends Error {
  readonly name = "LinkedDailyLogActivityEditError";
}

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function toDateOnly(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function activityMutationData(
  input: DailyLogFormInput,
  activity: DailyLogFormInput["activities"][number],
  sequence: number,
) {
  return {
    activityDate: toDateOnly(input.logDate),
    sequence,
    activityType: activity.activityType,
    title: activity.title,
    startTime: asNullable(activity.startTime),
    endTime: asNullable(activity.endTime),
    description: asNullable(activity.description),
    equipmentId: asNullable(activity.equipmentId),
    location: asNullable(activity.location),
    contractorCompany: asNullable(activity.contractorCompany),
    personName: asNullable(activity.personName),
    notes: asNullable(activity.notes),
  };
}

const activityIdentitySelect = {
  id: true,
  equipmentFuelEvent: {
    select: {
      id: true,
      operationalWorkDate: true,
      equipmentId: true,
    },
  },
  supplyRequestLink: {
    select: { supplyRequestId: true, role: true },
  },
} satisfies Prisma.DailyLogActivitySelect;

export async function updateDailyLogWithClient(
  client: PrismaClient,
  dailyLogId: string,
  input: DailyLogFormInput,
) {
  return client.$transaction(async (tx) => {
    let current = await tx.dailyLog.findUnique({
      where: { id: dailyLogId },
      select: {
        id: true,
        activities: { select: activityIdentitySelect },
      },
    });
    if (!current) {
      throw new LinkedDailyLogActivityEditError(
        "The Daily Log could not be found.",
      );
    }
    const currentById = new Map(
      current.activities.map((activity) => [activity.id, activity] as const),
    );
    const submittedIds = new Set<string>();
    for (const activity of input.activities) {
      if (!activity.activityId) continue;
      if (
        submittedIds.has(activity.activityId) ||
        !currentById.has(activity.activityId)
      ) {
        throw new LinkedDailyLogActivityEditError(
          "The Daily Log Activity identities changed. Reload before editing.",
        );
      }
      submittedIds.add(activity.activityId);
    }
    const discoveredLinked = current.activities.filter(
      (activity) => activity.supplyRequestLink !== null,
    );

    const requestIds = Array.from(
      new Set(
        discoveredLinked.map(
          (activity) => activity.supplyRequestLink!.supplyRequestId,
        ),
      ),
    ).sort();
    for (const requestId of requestIds) {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT "id"
          FROM "SupplyRequest"
          WHERE "id" = ${requestId}
          FOR UPDATE
        `,
      );
      if (locked.length !== 1 || locked[0]?.id !== requestId) {
        throw new LinkedDailyLogActivityEditError(
          "A linked Supply Request could not be validated. Reload and try again.",
        );
      }
    }
    const lockedActivities = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "DailyLogActivity"
        WHERE "dailyLogId" = ${dailyLogId}
        ORDER BY "id"
        FOR UPDATE
      `,
    );
    if (lockedActivities.length !== current.activities.length) {
      throw new LinkedDailyLogActivityEditError(
        "The Daily Log Activities changed after the form was loaded. Reload before editing.",
      );
    }
    current = await tx.dailyLog.findUnique({
      where: { id: dailyLogId },
      select: {
        id: true,
        activities: { select: activityIdentitySelect },
      },
    });
    if (!current) {
      throw new LinkedDailyLogActivityEditError(
        "The Daily Log could not be found.",
      );
    }
    if (
      current.activities.some(
        (activity) =>
          activity.supplyRequestLink &&
          !requestIds.includes(activity.supplyRequestLink.supplyRequestId),
      )
    ) {
      throw new LinkedDailyLogActivityEditError(
        "A Supply Request link changed while the Daily Log was being edited. Reload and try again.",
      );
    }
    const authoritativeById = new Map(
      current.activities.map((activity) => [activity.id, activity] as const),
    );
    if (
      Array.from(submittedIds).some((id) => !authoritativeById.has(id))
    ) {
      throw new LinkedDailyLogActivityEditError(
        "The Daily Log Activities changed after the form was loaded. Reload before editing.",
      );
    }

    const authoritativeLinked = current.activities.filter(
      (activity) => activity.supplyRequestLink !== null,
    );
    for (const currentActivity of authoritativeLinked) {
      const proposed = input.activities.find(
        (activity) => activity.activityId === currentActivity.id,
      );
      const link = currentActivity.supplyRequestLink!;
      // Daily Logs retain ownership of Activity deletion. Omitting a linked
      // Activity deliberately deletes it below; the database cascade removes
      // only the feature-owned link row.
      if (!proposed) continue;
      const detail = await getCurrentSupplyRequestDetailWithClient(
        tx,
        link.supplyRequestId,
      );
      if (!detail) {
        throw new LinkedDailyLogActivityEditError(
          "A linked Supply Request could not be validated. Reload and try again.",
        );
      }
      const proposedDate = input.logDate.toISOString().slice(0, 10);
      const issue = validateSupplyRequestDailyLogCompatibility(
        link.role,
        {
          namReference: detail.namReference,
          status: detail.status,
          operationalWorkDate: detail.operationalWorkDate,
          fulfillmentOperationalWorkDate: detail.fulfillmentOperationalWorkDate,
          equipmentId: detail.equipmentId,
          equipmentDisplayNameSnapshot: detail.equipmentDisplayName,
          equipmentNumberSnapshot: detail.equipmentNumber,
        },
        {
          activityType: proposed.activityType,
          title: proposed.title,
          activityDate: proposedDate,
          dailyLogDate: proposedDate,
          equipmentId: asNullable(proposed.equipmentId),
        },
      );
      if (issue) {
        throw new LinkedDailyLogActivityEditError(
          `${compatibilityMessage(issue)} Remove or replace the Supply Request link first.`,
        );
      }
    }

    for (const currentActivity of current.activities) {
      const fuelEvent = currentActivity.equipmentFuelEvent;
      if (!fuelEvent) continue;
      const proposed = input.activities.find(
        (activity) => activity.activityId === currentActivity.id,
      );
      // Daily Logs retain ownership of deliberate Activity deletion. The
      // existing SetNull relation detaches the Fuel Event when an Activity is
      // omitted, matching the pre-existing ownership contract.
      if (!proposed) continue;
      const proposedEquipmentId = asNullable(proposed.equipmentId);
      const equipmentCompatible =
        fuelEvent.equipmentId === null
          ? proposedEquipmentId === null
          : proposedEquipmentId === null ||
            proposedEquipmentId === fuelEvent.equipmentId;
      if (
        proposed.activityType !== "FUEL_SERVICE" ||
        input.logDate.toISOString().slice(0, 10) !==
          fuelEvent.operationalWorkDate.toISOString().slice(0, 10) ||
        !equipmentCompatible
      ) {
        throw new LinkedDailyLogActivityEditError(
          "This Activity is linked to an Equipment Fuel Event. Remove or replace that link first.",
        );
      }
    }

    await tx.dailyLog.update({
      where: { id: dailyLogId },
      data: {
        logDate: toDateOnly(input.logDate),
        shift: input.shift,
        mineId: asNullable(input.mineId),
        primaryEquipmentId: asNullable(input.primaryEquipmentId),
        summary: input.summary,
        weatherConditions: asNullable(input.weatherConditions),
        generalNotes: asNullable(input.generalNotes),
      },
    });
    await tx.dailyLogActivity.deleteMany({
      where: {
        dailyLogId,
        id: { notIn: Array.from(submittedIds) },
      },
    });
    for (const [index, activity] of input.activities.entries()) {
      const data = activityMutationData(input, activity, index + 1);
      if (activity.activityId) {
        await tx.dailyLogActivity.update({
          where: { id: activity.activityId },
          data,
        });
      } else {
        await tx.dailyLogActivity.create({
          data: { dailyLogId, ...data },
        });
      }
    }
    return { dailyLogId } as const;
  });
}
