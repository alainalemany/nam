import {
  Prisma,
  type DraglineDelayCodeCategory,
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
} satisfies Prisma.DraglineDelayReportInclude;

type ExistingReport = Prisma.DraglineDelayReportGetPayload<{
  include: typeof reportInclude;
}>;

export class DraglineDelayReportPersistenceError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly kind: "validation" | "stale" | "not-found" = "validation",
  ) {
    super(message);
  }
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

export async function persistDraglineDelayReportInTransaction(
  transaction: Prisma.TransactionClient,
  input: DraglineDelayReportSubmissionInput,
  reportId?: string,
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
  if (existing?.status !== undefined && existing.status !== "DRAFT") {
    throw new DraglineDelayReportPersistenceError(
      "Only Draft reports can be edited in DDR-1.",
    );
  }
  if (existing && input.recordVersion !== existing.recordVersion) {
    throw new DraglineDelayReportPersistenceError(
      "This Draft was updated elsewhere. Reload it before saving again.",
      "recordVersion",
      "stale",
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
  const totals = calculateDraglineShiftTotals(input.shift, normalized.timelineEntries);
  const people = await resolveEmployees(transaction, input, existing);
  const snapshot =
    existing && !equipmentChanged
      ? preservedEquipmentSnapshot(existing)
      : equipmentSnapshot(equipment);
  const parentData = {
    status: "DRAFT" as const,
    operationalWorkDate: workDateToUtc(input.operationalWorkDate),
    shift: input.shift,
    equipmentId: equipment.id,
    ...snapshot,
    startingHourMeter: input.startingHourMeter,
    endingHourMeter: input.endingHourMeter ?? null,
    ...people.supervisor,
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
      },
      select: { id: true, recordVersion: true },
    });
  }

  const updated = await transaction.draglineDelayReport.updateMany({
    where: {
      id: existing.id,
      status: "DRAFT",
      recordVersion: input.recordVersion,
    },
    data: { ...parentData, recordVersion: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new DraglineDelayReportPersistenceError(
      "This Draft was updated elsewhere. Reload it before saving again.",
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

  return { id: existing.id, recordVersion: existing.recordVersion + 1 };
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
