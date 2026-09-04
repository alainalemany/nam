import {
  Prisma,
  type DraglineDelayCodeCategory,
  type DraglineDelayReportStatus,
  type PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  DRAGLINE_DELAY_CODE_CATALOG_VERSION,
  getDraglineDelayCode,
} from "./catalog";
import { calculateDraglineShiftTotals } from "./calculations";
import {
  normalizeDraglineDelayReportSubmission,
  type DraglineDelayReportSubmissionInput,
} from "./validation";

const reportInclude = {
  operators: true,
  timelineEntries: true,
  downtimeBlocks: { include: { activities: true } },
  groundChecks: true,
  corrections: true,
} satisfies Prisma.DraglineDelayReportInclude;

type ExistingReport = Prisma.DraglineDelayReportGetPayload<{
  include: typeof reportInclude;
}>;

type DraglineDelayReportMutation = "draft" | "complete" | "correct";

export class DraglineDelayReportPersistenceError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly kind: "validation" | "stale" | "not-found" = "validation",
  ) {
    super(message);
  }
}

function staleMessage(operation: DraglineDelayReportMutation) {
  if (operation === "complete") {
    return "This report changed elsewhere; reload before completing.";
  }
  if (operation === "correct") {
    return "This report changed elsewhere; reload before saving the correction.";
  }
  return "This Draft was updated elsewhere. Reload it before saving again.";
}

function workDateToUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function equipmentSnapshot(equipment: {
  displayName: string;
  equipmentNumber: string | null;
  category: ExistingReport["equipmentCategory"];
  mine: { name: string; city: { name: string; state: string | null } };
}) {
  return {
    equipmentDisplayName: equipment.displayName,
    equipmentNumber: equipment.equipmentNumber,
    equipmentCategory: equipment.category,
    mineName: equipment.mine.name,
    cityName: equipment.mine.city.name,
    cityState: equipment.mine.city.state,
  };
}

function preservedEquipmentSnapshot(existing: ExistingReport) {
  return {
    equipmentDisplayName: existing.equipmentDisplayName,
    equipmentNumber: existing.equipmentNumber,
    equipmentCategory: existing.equipmentCategory,
    mineName: existing.mineName,
    cityName: existing.cityName,
    cityState: existing.cityState,
  };
}

async function resolveEmployees(
  transaction: Prisma.TransactionClient,
  input: DraglineDelayReportSubmissionInput,
  existing?: ExistingReport,
) {
  const employeeIds = [
    ...input.operators.map((operator) => operator.employeeId),
    ...(input.supervisorId ? [input.supervisorId] : []),
  ];
  const employees = await transaction.employee.findMany({
    where: { id: { in: employeeIds } },
  });
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const existingOperators = new Map(existing?.operators.map((operator) => [operator.id, operator]));

  const operators = input.operators.map((operator, index) => {
    const employee = byId.get(operator.employeeId);
    if (!employee) {
      throw new DraglineDelayReportPersistenceError(
        "The selected Operator could not be found.",
        `operators.${index}.employeeId`,
      );
    }
    const existingOperator = operator.id ? existingOperators.get(operator.id) : undefined;
    const unchanged = existingOperator?.employeeId === employee.id;
    if (!unchanged && !employee.isActive) {
      throw new DraglineDelayReportPersistenceError(
        "Select an active Employee as Operator.",
        `operators.${index}.employeeId`,
      );
    }
    return {
      id: operator.id,
      sequence: operator.sequence,
      employeeId: employee.id,
      employeeDisplayName: unchanged
        ? existingOperator.employeeDisplayName
        : employee.displayName,
      employeeCode: unchanged ? existingOperator.employeeCode : employee.employeeCode,
    };
  });

  if (!input.supervisorId) {
    return {
      operators,
      supervisor: {
        supervisorId: null,
        supervisorDisplayName: null,
        supervisorEmployeeCode: null,
      },
    };
  }

  const supervisor = byId.get(input.supervisorId);
  if (!supervisor) {
    throw new DraglineDelayReportPersistenceError(
      "The selected Supervisor could not be found.",
      "supervisorId",
    );
  }
  const unchangedSupervisor = existing?.supervisorId === supervisor.id;
  if (!unchangedSupervisor && (!supervisor.isActive || !supervisor.isSupervisor)) {
    throw new DraglineDelayReportPersistenceError(
      "Select an active supervisor-eligible Employee.",
      "supervisorId",
    );
  }

  return {
    operators,
    supervisor: {
      supervisorId: supervisor.id,
      supervisorDisplayName: unchangedSupervisor
        ? existing.supervisorDisplayName
        : supervisor.displayName,
      supervisorEmployeeCode: unchangedSupervisor
        ? existing.supervisorEmployeeCode
        : supervisor.employeeCode,
    },
  };
}

async function resolveLake(
  transaction: Prisma.TransactionClient,
  lakeId: string | undefined,
  mineId: string,
  existing?: ExistingReport,
) {
  if (!lakeId) {
    return {
      lakeId: null,
      lakeDisplayNameSnapshot:
        existing?.lakeId == null ? existing?.lakeDisplayNameSnapshot ?? null : null,
    };
  }

  const lake = await transaction.lake.findUnique({ where: { id: lakeId } });
  if (!lake) {
    throw new DraglineDelayReportPersistenceError(
      "The selected Lake could not be found.",
      "lakeId",
    );
  }
  if (lake.mineId !== mineId) {
    throw new DraglineDelayReportPersistenceError(
      "Select a Lake belonging to the Equipment's Mine.",
      "lakeId",
    );
  }
  const unchanged = existing?.lakeId === lake.id;
  if (!unchanged && lake.status !== "ACTIVE") {
    throw new DraglineDelayReportPersistenceError(
      "Select an active Lake.",
      "lakeId",
    );
  }
  return {
    lakeId: lake.id,
    lakeDisplayNameSnapshot: unchanged
      ? existing.lakeDisplayNameSnapshot
      : lake.name,
  };
}

function assertOwnedChildIds(
  submittedIds: Array<string | undefined>,
  existingIds: Set<string>,
  label: string,
) {
  for (const id of submittedIds) {
    if (id && !existingIds.has(id)) {
      throw new DraglineDelayReportPersistenceError(
        `${label} no longer belongs to this report. Reload before saving.`,
        undefined,
        "stale",
      );
    }
  }
}

async function persistOperators(
  transaction: Prisma.TransactionClient,
  reportId: string,
  operators: Array<{
    id?: string;
    sequence: number;
    employeeId: string;
    employeeDisplayName: string;
    employeeCode: string | null;
  }>,
) {
  const retainedIds = operators.flatMap((operator) => (operator.id ? [operator.id] : []));
  await transaction.draglineDelayReportOperator.deleteMany({
    where: { reportId, id: { notIn: retainedIds } },
  });
  if (retainedIds.length) {
    await transaction.draglineDelayReportOperator.updateMany({
      where: { reportId, id: { in: retainedIds } },
      data: { sequence: { increment: 1000 }, employeeId: null },
    });
  }

  for (const operator of operators) {
    const data = {
      sequence: operator.sequence,
      employeeId: operator.employeeId,
      employeeDisplayName: operator.employeeDisplayName,
      employeeCode: operator.employeeCode,
    };
    if (operator.id) {
      await transaction.draglineDelayReportOperator.update({
        where: { id: operator.id },
        data,
      });
    } else {
      await transaction.draglineDelayReportOperator.create({
        data: { reportId, ...data },
      });
    }
  }
}

async function persistTimelineEntries(
  transaction: Prisma.TransactionClient,
  reportId: string,
  entries: Array<{
    id?: string;
    sequence: number;
    startMinuteOffset: number;
    delayCode: string;
    description?: string;
    durationMinutes?: number;
    causesDowntime: boolean;
  }>,
) {
  const retainedIds = entries.flatMap((entry) => (entry.id ? [entry.id] : []));
  await transaction.draglineDelayReportTimelineEntry.deleteMany({
    where: { reportId, id: { notIn: retainedIds } },
  });
  if (retainedIds.length) {
    await transaction.draglineDelayReportTimelineEntry.updateMany({
      where: { reportId, id: { in: retainedIds } },
      data: { sequence: { increment: 1000 } },
    });
  }

  for (const entry of entries) {
    const delayCode = getDraglineDelayCode(entry.delayCode);
    if (!delayCode) {
      throw new DraglineDelayReportPersistenceError(
        "Select an official Delay Code from Catalog V1.",
        "timelineEntries",
      );
    }
    const data = {
      sequence: entry.sequence,
      startMinuteOffset: entry.startMinuteOffset,
      delayCodeCatalogVersion: DRAGLINE_DELAY_CODE_CATALOG_VERSION,
      delayCode: delayCode.code,
      delayCodeDescription: delayCode.description,
      delayCodeCategory: delayCode.category as DraglineDelayCodeCategory,
      description: entry.description ?? null,
      durationMinutes: entry.durationMinutes ?? null,
      causesDowntime: entry.causesDowntime,
    };
    if (entry.id) {
      await transaction.draglineDelayReportTimelineEntry.update({
        where: { id: entry.id },
        data,
      });
    } else {
      await transaction.draglineDelayReportTimelineEntry.create({
        data: { reportId, ...data },
      });
    }
  }
}

async function persistGroundChecks(
  transaction: Prisma.TransactionClient,
  reportId: string,
  groundChecks: Array<{
    id?: string;
    sequence: number;
    startMinuteOffset: number;
  }>,
) {
  const retainedIds = groundChecks.flatMap((groundCheck) =>
    groundCheck.id ? [groundCheck.id] : [],
  );
  await transaction.draglineDelayReportGroundCheck.deleteMany({
    where: { reportId, id: { notIn: retainedIds } },
  });
  if (retainedIds.length) {
    await transaction.draglineDelayReportGroundCheck.updateMany({
      where: { reportId, id: { in: retainedIds } },
      data: { sequence: { increment: 1000 } },
    });
  }

  for (const groundCheck of groundChecks) {
    const data = {
      sequence: groundCheck.sequence,
      startMinuteOffset: groundCheck.startMinuteOffset,
    };
    if (groundCheck.id) {
      await transaction.draglineDelayReportGroundCheck.update({
        where: { id: groundCheck.id },
        data,
      });
    } else {
      await transaction.draglineDelayReportGroundCheck.create({
        data: { reportId, ...data },
      });
    }
  }
}

async function persistDowntimeBlockActivities(
  transaction: Prisma.TransactionClient,
  downtimeBlockId: string,
  activities: Array<{
    id?: string;
    sequence: number;
    delayCode: string;
    description?: string;
  }>,
) {
  const retainedIds = activities.flatMap((activity) =>
    activity.id ? [activity.id] : [],
  );
  await transaction.draglineDelayReportDowntimeBlockActivity.deleteMany({
    where: { downtimeBlockId, id: { notIn: retainedIds } },
  });
  if (retainedIds.length) {
    await transaction.draglineDelayReportDowntimeBlockActivity.updateMany({
      where: { downtimeBlockId, id: { in: retainedIds } },
      data: { sequence: { increment: 1000 } },
    });
  }

  for (const activity of activities) {
    const delayCode = getDraglineDelayCode(activity.delayCode);
    if (!delayCode || delayCode.code === "13") {
      throw new DraglineDelayReportPersistenceError(
        delayCode
          ? "Code 13 — Shift Change must remain a normal Timeline row."
          : "Select an official Delay Code from Catalog V1.",
        "downtimeBlocks",
      );
    }
    const data = {
      sequence: activity.sequence,
      delayCodeCatalogVersion: DRAGLINE_DELAY_CODE_CATALOG_VERSION,
      delayCode: delayCode.code,
      delayCodeDescription: delayCode.description,
      delayCodeCategory: delayCode.category as DraglineDelayCodeCategory,
      description: activity.description ?? null,
    };
    if (activity.id) {
      await transaction.draglineDelayReportDowntimeBlockActivity.update({
        where: { id: activity.id },
        data,
      });
    } else {
      await transaction.draglineDelayReportDowntimeBlockActivity.create({
        data: { downtimeBlockId, ...data },
      });
    }
  }
}

async function persistDowntimeBlocks(
  transaction: Prisma.TransactionClient,
  reportId: string,
  blocks: Array<{
    id?: string;
    sequence: number;
    startMinuteOffset: number;
    durationMinutes: number;
    description?: string;
    activities: Array<{
      id?: string;
      sequence: number;
      delayCode: string;
      description?: string;
    }>;
  }>,
) {
  const retainedIds = blocks.flatMap((block) => (block.id ? [block.id] : []));
  await transaction.draglineDelayReportDowntimeBlock.deleteMany({
    where: { reportId, id: { notIn: retainedIds } },
  });
  if (retainedIds.length) {
    await transaction.draglineDelayReportDowntimeBlock.updateMany({
      where: { reportId, id: { in: retainedIds } },
      data: { sequence: { increment: 1000 } },
    });
  }

  for (const block of blocks) {
    const data = {
      sequence: block.sequence,
      startMinuteOffset: block.startMinuteOffset,
      durationMinutes: block.durationMinutes,
      description: block.description ?? null,
    };
    if (block.id) {
      await transaction.draglineDelayReportDowntimeBlock.update({
        where: { id: block.id },
        data,
      });
      await persistDowntimeBlockActivities(
        transaction,
        block.id,
        block.activities,
      );
    } else {
      await transaction.draglineDelayReportDowntimeBlock.create({
        data: {
          reportId,
          ...data,
          activities: {
            create: block.activities.map((activity) => {
              const delayCode = getDraglineDelayCode(activity.delayCode);
              if (!delayCode || delayCode.code === "13") {
                throw new DraglineDelayReportPersistenceError(
                  delayCode
                    ? "Code 13 — Shift Change must remain a normal Timeline row."
                    : "Select an official Delay Code from Catalog V1.",
                  "downtimeBlocks",
                );
              }
              return {
                sequence: activity.sequence,
                delayCodeCatalogVersion: DRAGLINE_DELAY_CODE_CATALOG_VERSION,
                delayCode: delayCode.code,
                delayCodeDescription: delayCode.description,
                delayCodeCategory:
                  delayCode.category as DraglineDelayCodeCategory,
                description: activity.description ?? null,
              };
            }),
          },
        },
      });
    }
  }
}

export async function persistDraglineDelayReportInTransaction(
  transaction: Prisma.TransactionClient,
  input: DraglineDelayReportSubmissionInput,
  reportId?: string,
  operation: DraglineDelayReportMutation = "draft",
  correctionReason?: string,
) {
  const loadedExisting = reportId
    ? await transaction.draglineDelayReport.findUnique({
        where: { id: reportId },
        include: reportInclude,
      })
    : undefined;

  if (reportId && !loadedExisting) {
    throw new DraglineDelayReportPersistenceError(
      "Dragline Delay Report could not be found.",
      undefined,
      "not-found",
    );
  }
  const existing = loadedExisting ?? undefined;
  if (!existing && operation !== "draft") {
    throw new DraglineDelayReportPersistenceError(
      "Save the Draft before completing or correcting it.",
    );
  }
  const expectedStatus = operation === "correct" ? "COMPLETED" : "DRAFT";
  if (existing && existing.status !== expectedStatus) {
    throw new DraglineDelayReportPersistenceError(
      operation === "correct"
        ? "Only Completed reports can be corrected."
        : "Only Draft reports can be saved or completed.",
    );
  }
  if (existing && input.recordVersion !== existing.recordVersion) {
    throw new DraglineDelayReportPersistenceError(
      staleMessage(operation),
      "recordVersion",
      "stale",
    );
  }
  const normalizedCorrectionReason = correctionReason?.trim();
  if (operation === "correct" && !normalizedCorrectionReason) {
    throw new DraglineDelayReportPersistenceError(
      "Correction Reason is required.",
      "correctionReason",
    );
  }
  if (!existing && input.recordVersion !== undefined) {
    throw new DraglineDelayReportPersistenceError(
      "A new report must not include a record version.",
      "recordVersion",
    );
  }

  const existingOperatorIds = new Set(
    existing?.operators.map((operator) => operator.id),
  );
  const existingTimelineIds = new Set(
    existing?.timelineEntries.map((entry) => entry.id),
  );
  const existingGroundCheckIds = new Set(
    existing?.groundChecks.map((groundCheck) => groundCheck.id),
  );
  const existingDowntimeBlocks = new Map(
    existing?.downtimeBlocks.map((block) => [block.id, block]),
  );
  const existingDowntimeBlockIds = new Set(existingDowntimeBlocks.keys());
  const existingDowntimeBlockActivityIds = new Map(
    existing?.downtimeBlocks.flatMap((block) =>
      block.activities.map((activity) => [activity.id, block.id] as const),
    ),
  );
  assertOwnedChildIds(
    input.operators.map((operator) => operator.id),
    existingOperatorIds,
    "Operator row",
  );
  assertOwnedChildIds(
    input.timelineEntries.map((entry) => entry.id),
    existingTimelineIds,
    "Timeline row",
  );
  assertOwnedChildIds(
    input.groundChecks.map((groundCheck) => groundCheck.id),
    existingGroundCheckIds,
    "Ground Check row",
  );
  assertOwnedChildIds(
    input.downtimeBlocks.map((block) => block.id),
    existingDowntimeBlockIds,
    "Shared Downtime Block",
  );
  input.downtimeBlocks.forEach((block, blockIndex) => {
    block.activities.forEach((activity, activityIndex) => {
      if (!activity.id) return;
      if (
        !block.id ||
        existingDowntimeBlockActivityIds.get(activity.id) !== block.id
      ) {
        throw new DraglineDelayReportPersistenceError(
          "Activity row no longer belongs to this Shared Downtime Block. Reload before saving.",
          `downtimeBlocks.${blockIndex}.activities.${activityIndex}.id`,
          "stale",
        );
      }
    });
  });
  if (!existing && input.operators.some((operator) => operator.id)) {
    throw new DraglineDelayReportPersistenceError(
      "New Operator rows must not include IDs.",
    );
  }
  if (!existing && input.timelineEntries.some((entry) => entry.id)) {
    throw new DraglineDelayReportPersistenceError(
      "New timeline rows must not include IDs.",
    );
  }
  if (!existing && input.groundChecks.some((groundCheck) => groundCheck.id)) {
    throw new DraglineDelayReportPersistenceError(
      "New Ground Check rows must not include IDs.",
    );
  }
  if (
    !existing &&
    input.downtimeBlocks.some(
      (block) => block.id || block.activities.some((activity) => activity.id),
    )
  ) {
    throw new DraglineDelayReportPersistenceError(
      "New Shared Downtime Blocks and Activities must not include IDs.",
    );
  }

  const equipment = await transaction.equipment.findUnique({
    where: { id: input.equipmentId },
    include: { mine: { include: { city: true } } },
  });
  if (!equipment) {
    throw new DraglineDelayReportPersistenceError(
      "The selected Equipment could not be found.",
      "equipmentId",
    );
  }
  if (equipment.category !== "DRAGLINE") {
    throw new DraglineDelayReportPersistenceError(
      "Select Dragline Equipment for this report.",
      "equipmentId",
    );
  }
  const equipmentChanged = existing?.equipmentId !== equipment.id;
  if ((!existing || equipmentChanged) && equipment.status !== "ACTIVE") {
    throw new DraglineDelayReportPersistenceError(
      "Select active Dragline Equipment.",
      "equipmentId",
    );
  }

  const normalized = normalizeDraglineDelayReportSubmission(input);
  const totals = calculateDraglineShiftTotals(
    input.shift,
    normalized.timelineEntries,
    normalized.groundChecks,
    normalized.downtimeBlocks,
  );
  const people = await resolveEmployees(transaction, input, existing);
  const lake = await resolveLake(
    transaction,
    input.lakeId,
    equipment.mineId,
    existing,
  );
  const snapshot =
    existing && !equipmentChanged
      ? preservedEquipmentSnapshot(existing)
      : equipmentSnapshot(equipment);
  const resultingStatus: DraglineDelayReportStatus =
    operation === "draft" ? "DRAFT" : "COMPLETED";
  const completedAt =
    operation === "complete"
      ? new Date()
      : operation === "correct"
        ? existing?.completedAt
        : null;
  const parentData = {
    status: resultingStatus,
    completedAt,
    operationalWorkDate: workDateToUtc(input.operationalWorkDate),
    shift: input.shift,
    equipmentId: equipment.id,
    ...snapshot,
    startingHourMeter: input.startingHourMeter,
    endingHourMeter: input.endingHourMeter ?? null,
    ...people.supervisor,
    ...lake,
    normalDiggingBuckets: input.normalDiggingBuckets ?? null,
    benchfillBuckets: input.benchfillBuckets ?? null,
    stationStartFeet: normalized.stationStartFeet ?? null,
    stationEndFeet: normalized.stationEndFeet ?? null,
    depthFeet: input.depthFeet ?? null,
    fuelGallons: input.fuelGallons ?? null,
    cableDragFeet: input.cableDragFeet ?? null,
    hoistFeet: input.hoistFeet ?? null,
    comments: input.comments ?? null,
    safetyItemsFound: input.safetyItemsFound ?? null,
    actionTaken: input.actionTaken ?? null,
    ...totals,
  };

  if (!existing) {
    return transaction.draglineDelayReport.create({
      data: {
        ...parentData,
        operators: {
          create: people.operators.map(({ id: _id, ...operator }) => operator),
        },
        timelineEntries: {
          create: normalized.timelineEntries.map((entry) => {
            const delayCode = getDraglineDelayCode(entry.delayCode)!;
            return {
              sequence: entry.sequence,
              startMinuteOffset: entry.startMinuteOffset,
              delayCodeCatalogVersion: DRAGLINE_DELAY_CODE_CATALOG_VERSION,
              delayCode: delayCode.code,
              delayCodeDescription: delayCode.description,
              delayCodeCategory: delayCode.category as DraglineDelayCodeCategory,
              description: entry.description ?? null,
              durationMinutes: entry.durationMinutes ?? null,
              causesDowntime: entry.causesDowntime,
            };
          }),
        },
        groundChecks: {
          create: normalized.groundChecks.map((groundCheck) => ({
            sequence: groundCheck.sequence,
            startMinuteOffset: groundCheck.startMinuteOffset,
          })),
        },
        downtimeBlocks: {
          create: normalized.downtimeBlocks.map((block) => ({
            sequence: block.sequence,
            startMinuteOffset: block.startMinuteOffset,
            durationMinutes: block.durationMinutes,
            description: block.description ?? null,
            activities: {
              create: block.activities.map((activity) => {
                const delayCode = getDraglineDelayCode(activity.delayCode)!;
                return {
                  sequence: activity.sequence,
                  delayCodeCatalogVersion: DRAGLINE_DELAY_CODE_CATALOG_VERSION,
                  delayCode: delayCode.code,
                  delayCodeDescription: delayCode.description,
                  delayCodeCategory:
                    delayCode.category as DraglineDelayCodeCategory,
                  description: activity.description ?? null,
                };
              }),
            },
          })),
        },
      },
      select: { id: true, recordVersion: true },
    });
  }

  const updated = await transaction.draglineDelayReport.updateMany({
    where: {
      id: existing.id,
      status: expectedStatus,
      recordVersion: input.recordVersion,
    },
    data: { ...parentData, recordVersion: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new DraglineDelayReportPersistenceError(
      staleMessage(operation),
      "recordVersion",
      "stale",
    );
  }

  await persistOperators(transaction, existing.id, people.operators);
  await persistTimelineEntries(
    transaction,
    existing.id,
    normalized.timelineEntries,
  );
  await persistGroundChecks(transaction, existing.id, normalized.groundChecks);
  await persistDowntimeBlocks(
    transaction,
    existing.id,
    normalized.downtimeBlocks,
  );

  if (operation === "correct") {
    const sequence =
      existing.corrections.reduce(
        (maximum, correction) => Math.max(maximum, correction.sequence),
        0,
      ) + 1;
    await transaction.draglineDelayReportCorrection.create({
      data: {
        reportId: existing.id,
        sequence,
        reason: normalizedCorrectionReason!,
        previousRecordVersion: existing.recordVersion,
        resultingRecordVersion: existing.recordVersion + 1,
      },
    });
  }

  return { id: existing.id, recordVersion: existing.recordVersion + 1 };
}

export function completeDraglineDelayReportInTransaction(
  transaction: Prisma.TransactionClient,
  input: DraglineDelayReportSubmissionInput,
  reportId: string,
) {
  return persistDraglineDelayReportInTransaction(
    transaction,
    input,
    reportId,
    "complete",
  );
}

export function correctDraglineDelayReportInTransaction(
  transaction: Prisma.TransactionClient,
  input: DraglineDelayReportSubmissionInput,
  reportId: string,
  correctionReason: string,
) {
  return persistDraglineDelayReportInTransaction(
    transaction,
    input,
    reportId,
    "correct",
    correctionReason,
  );
}

export async function persistDraglineDelayReport(
  input: DraglineDelayReportSubmissionInput,
  reportId?: string,
  client: PrismaClient = prisma,
) {
  return client.$transaction((transaction) =>
    persistDraglineDelayReportInTransaction(transaction, input, reportId),
  );
}

export function completeDraglineDelayReport(
  input: DraglineDelayReportSubmissionInput,
  reportId: string,
  client: PrismaClient = prisma,
) {
  return client.$transaction((transaction) =>
    completeDraglineDelayReportInTransaction(transaction, input, reportId),
  );
}

export function correctDraglineDelayReport(
  input: DraglineDelayReportSubmissionInput,
  reportId: string,
  correctionReason: string,
  client: PrismaClient = prisma,
) {
  return client.$transaction((transaction) =>
    correctDraglineDelayReportInTransaction(
      transaction,
      input,
      reportId,
      correctionReason,
    ),
  );
}
