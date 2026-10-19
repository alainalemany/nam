"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { acquirePayrollEvidenceLock } from "@/features/payroll/evidence-review-locks";

import {
  allocateWeeklyOvertime,
  calculateWorkedMinutes,
  endOfPayrollWeek,
  normalizeIdentityKey,
  normalizeReferenceKey,
  normalizeSupportPersonKey,
  parseDateOnly,
} from "./calculations";
import {
  allocationSnapshots,
  buildDailyEntryData,
  supportPersonSnapshot,
  type EquipmentSnapshotSource,
  type ExistingAllocationSnapshot,
  type ExistingEquipmentSnapshot,
  type SupportPersonSource,
  type WorkCodeSource,
  type WorkOrderSource,
} from "./persistence";
import type { TimesheetFormState, TimesheetMutationState, WeeklyTimesheetInput } from "./types";
import {
  supportPersonSchema,
  validateCompletion,
  weeklyTimesheetInputSchema,
  workCodeSchema,
  workOrderSchema,
} from "./validation";
import { getWorkScheduleAssignmentOptions } from "./data";

const identityReviewRequiredMessage =
  "Historical ownership must be reviewed before this Timesheet can be changed.";

function hasTrustedIdentity(status: string | undefined) {
  return status === "EXPLICIT_SELECTION" || status === "OWNER_VERIFIED";
}

function errorState(
  message: string,
  fieldErrors: Record<string, string[]> = {},
  code?: TimesheetFormState["code"],
): TimesheetFormState {
  return { status: "error", message, fieldErrors, ...(code ? { code } : {}) };
}

function validationState(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    fieldErrors[key] ??= [];
    fieldErrors[key].push(issue.message);
  }
  return errorState("Check the highlighted Timesheet fields and try again.", fieldErrors);
}

function parsePayload(formData: FormData):
  | { ok: true; data: WeeklyTimesheetInput }
  | { ok: false; state: TimesheetFormState } {
  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > 250_000) {
    return { ok: false, state: errorState("Timesheet form data is missing or too large.") };
  }
  try {
    const parsed = weeklyTimesheetInputSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? { ok: true, data: parsed.data }
      : { ok: false, state: validationState(parsed.error) };
  } catch {
    return { ok: false, state: errorState("Timesheet form data could not be read.") };
  }
}

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

class TimesheetInputError extends Error {
  constructor(message: string, readonly fieldPath: string) {
    super(message);
  }
}

export async function getWorkScheduleAssignmentsForEmployeeAction(
  primaryEmployeeId: string,
  payrollWeekStartDate: string,
  timesheetId: string | null,
) {
  if (!primaryEmployeeId || !/^\d{4}-\d{2}-\d{2}$/.test(payrollWeekStartDate)) return [];
  const existing = timesheetId
    ? await prisma.weeklyTimesheet.findUnique({
        where: { id: timesheetId },
        select: {
          primaryEmployeeId: true,
          primaryEmployeeIdentityStatus: true,
          entries: { select: { workScheduleDailyAssignmentId: true } },
          leaveEntries: { select: { workScheduleDailyAssignmentId: true } },
          noWorkEntries: { select: { workScheduleDailyAssignmentId: true } },
        },
      })
    : null;
  if (
    existing &&
    (!hasTrustedIdentity(existing.primaryEmployeeIdentityStatus) ||
      existing.primaryEmployeeId !== primaryEmployeeId)
  ) return [];
  const existingAssignmentIds = existing?.entries
    .map((entry) => entry.workScheduleDailyAssignmentId)
    .filter((id): id is string => Boolean(id)) ?? [];
  existingAssignmentIds.push(
    ...(existing?.leaveEntries
      .map((entry) => entry.workScheduleDailyAssignmentId)
      .filter((id): id is string => Boolean(id)) ?? []),
  );
  existingAssignmentIds.push(
    ...(existing?.noWorkEntries
      .map((entry) => entry.workScheduleDailyAssignmentId)
      .filter((id): id is string => Boolean(id)) ?? []),
  );
  return getWorkScheduleAssignmentOptions(
    primaryEmployeeId,
    payrollWeekStartDate,
    existingAssignmentIds,
  );
}

const existingInclude = {
  entries: {
    include: {
      allocations: { include: { supportPersonnel: true } },
    },
  },
  leaveEntries: true,
  noWorkEntries: true,
} satisfies Prisma.WeeklyTimesheetInclude;

type ExistingTimesheet = Prisma.WeeklyTimesheetGetPayload<{ include: typeof existingInclude }>;

async function referenceMaps(
  tx: Prisma.TransactionClient,
  input: WeeklyTimesheetInput,
  primaryEmployeeId: string | null,
  existing?: ExistingTimesheet | null,
) {
  const equipmentIds = [
    ...new Set(input.entries.map((entry) => entry.primaryEquipmentId).filter(Boolean)),
  ];
  const workCodeIds = [...new Set(input.entries.flatMap((entry) => entry.allocations.map((item) => item.workCodeId)))];
  const workOrderIds = [...new Set(input.entries.flatMap((entry) => entry.allocations.map((item) => item.workOrderId).filter(Boolean)))] as string[];
  const supportPersonIds = [...new Set(input.entries.flatMap((entry) => entry.allocations.flatMap((item) => item.supportPersonIds)))];
  const assignmentIds = [...new Set([
    ...input.entries.map((entry) => entry.workScheduleDailyAssignmentId),
    ...input.leaveEntries.map((entry) => entry.workScheduleDailyAssignmentId),
    ...(input.noWorkEntries ?? []).map((entry) => entry.workScheduleDailyAssignmentId),
  ].filter(Boolean))] as string[];

  const [equipment, workCodes, workOrders, supportPersonnel, assignments] = await Promise.all([
    tx.equipment.findMany({ where: { id: { in: equipmentIds } }, include: { mine: { include: { city: true } } } }),
    tx.timesheetWorkCode.findMany({ where: { id: { in: workCodeIds } } }),
    tx.timesheetWorkOrder.findMany({ where: { id: { in: workOrderIds } } }),
    tx.timesheetSupportPerson.findMany({ where: { id: { in: supportPersonIds } } }),
    tx.dailyAssignment.findMany({
      where: { id: { in: assignmentIds } },
      include: {
        weeklySchedule: {
          select: { primaryEmployeeId: true, status: true },
        },
      },
    }),
  ]);

  const foundEquipmentIds = new Set(equipment.map((item) => item.id));
  const foundWorkCodeIds = new Set(workCodes.map((item) => item.id));
  const foundWorkOrderIds = new Set(workOrders.map((item) => item.id));
  const foundSupportPersonIds = new Set(supportPersonnel.map((item) => item.id));
  const foundAssignmentIds = new Set(assignments.map((item) => item.id));

  for (const [entryIndex, entry] of input.entries.entries()) {
    if (entry.primaryEquipmentId && !foundEquipmentIds.has(entry.primaryEquipmentId)) {
      throw new TimesheetInputError("INVALID_EQUIPMENT", `entries.${entryIndex}.primaryEquipmentId`);
    }
    if (
      entry.workScheduleDailyAssignmentId &&
      !foundAssignmentIds.has(entry.workScheduleDailyAssignmentId)
    ) {
      throw new TimesheetInputError(
        "INVALID_ASSIGNMENT",
        `entries.${entryIndex}.workScheduleDailyAssignmentId`,
      );
    }
    for (const [allocationIndex, allocation] of entry.allocations.entries()) {
      if (!foundWorkCodeIds.has(allocation.workCodeId)) {
        throw new TimesheetInputError(
          "INVALID_WORK_CODE",
          `entries.${entryIndex}.allocations.${allocationIndex}.workCodeId`,
        );
      }
      if (allocation.workOrderId && !foundWorkOrderIds.has(allocation.workOrderId)) {
        throw new TimesheetInputError(
          "INVALID_WORK_ORDER",
          `entries.${entryIndex}.allocations.${allocationIndex}.workOrderId`,
        );
      }
      const missingSupportPerson = allocation.supportPersonIds.find(
        (id) => !foundSupportPersonIds.has(id),
      );
      if (missingSupportPerson) {
        throw new TimesheetInputError(
          "INVALID_SUPPORT_PERSON",
          `entries.${entryIndex}.allocations.${allocationIndex}.supportPersonIds`,
        );
      }
    }
  }

  for (const [leaveIndex, leave] of input.leaveEntries.entries()) {
    if (
      leave.workScheduleDailyAssignmentId &&
      !foundAssignmentIds.has(leave.workScheduleDailyAssignmentId)
    ) {
      throw new TimesheetInputError(
        "INVALID_ASSIGNMENT",
        `leaveEntries.${leaveIndex}.workScheduleDailyAssignmentId`,
      );
    }
  }

  for (const [noWorkIndex, noWork] of (input.noWorkEntries ?? []).entries()) {
    if (!foundAssignmentIds.has(noWork.workScheduleDailyAssignmentId ?? "")) {
      throw new TimesheetInputError(
        "INVALID_ASSIGNMENT",
        `noWorkEntries.${noWorkIndex}.workScheduleDailyAssignmentId`,
      );
    }
    const assignment = assignments.find(
      (item) => item.id === noWork.workScheduleDailyAssignmentId,
    );
    const existingNoWork = (existing?.noWorkEntries ?? []).find(
      (item) => item.workDate.getTime() === parseDateOnly(noWork.workDate).getTime(),
    );
    const unchangedHistoricalLink = Boolean(
      assignment && existingNoWork?.workScheduleDailyAssignmentId === assignment.id,
    );
    if (assignment && !unchangedHistoricalLink && assignment.weeklySchedule.primaryEmployeeId !== primaryEmployeeId) {
      throw new TimesheetInputError("ASSIGNMENT_OWNER_MISMATCH", `noWorkEntries.${noWorkIndex}.workScheduleDailyAssignmentId`);
    }
    if (assignment && !unchangedHistoricalLink && assignment.assignmentDate.getTime() !== parseDateOnly(noWork.workDate).getTime()) {
      throw new TimesheetInputError("ASSIGNMENT_DATE_MISMATCH", `noWorkEntries.${noWorkIndex}.workScheduleDailyAssignmentId`);
    }
    if (assignment && !unchangedHistoricalLink && (assignment.weeklySchedule.status === "DRAFT" || assignment.plannedStatus !== "SCHEDULED")) {
      throw new TimesheetInputError("NO_WORK_ASSIGNMENT_INELIGIBLE", `noWorkEntries.${noWorkIndex}.workScheduleDailyAssignmentId`);
    }
  }

  const existingByDate = new Map(
    existing?.entries.map((entry) => [entry.workDate.toISOString().slice(0, 10), entry]) ?? [],
  );
  for (const [entryIndex, entry] of input.entries.entries()) {
    if (!entry.primaryEquipmentId) {
      const existingEntry = existingByDate.get(entry.workDate);
      if (!existingEntry || existingEntry.primaryEquipmentId !== null) {
        throw new TimesheetInputError("EQUIPMENT_REQUIRED", `entries.${entryIndex}.primaryEquipmentId`);
      }
    }
  }


  for (const [leaveIndex, leave] of input.leaveEntries.entries()) {
    const assignment = assignments.find(
      (item) => item.id === leave.workScheduleDailyAssignmentId,
    );
    const existingLeave = (existing?.leaveEntries ?? []).find(
      (item) => item.workDate.getTime() === parseDateOnly(leave.workDate).getTime(),
    );
    const unchangedHistoricalLink = Boolean(
      assignment && existingLeave?.workScheduleDailyAssignmentId === assignment.id,
    );
    if (assignment && !unchangedHistoricalLink && assignment.weeklySchedule.primaryEmployeeId !== primaryEmployeeId) {
      throw new TimesheetInputError(
        "ASSIGNMENT_OWNER_MISMATCH",
        `leaveEntries.${leaveIndex}.workScheduleDailyAssignmentId`,
      );
    }
    if (assignment && !unchangedHistoricalLink && assignment.assignmentDate.getTime() !== parseDateOnly(leave.workDate).getTime()) {
      throw new TimesheetInputError(
        "ASSIGNMENT_DATE_MISMATCH",
        `leaveEntries.${leaveIndex}.workScheduleDailyAssignmentId`,
      );
    }
    if (
      assignment &&
      !unchangedHistoricalLink &&
      (assignment.weeklySchedule.status === "DRAFT" || assignment.plannedStatus !== "SCHEDULED")
    ) {
      throw new TimesheetInputError(
        "FTO_ASSIGNMENT_INELIGIBLE",
        `leaveEntries.${leaveIndex}.workScheduleDailyAssignmentId`,
      );
    }
  }

  for (const [entryIndex, entry] of input.entries.entries()) {
    const assignment = assignments.find((item) => item.id === entry.workScheduleDailyAssignmentId);
    const existingEntry = existingByDate.get(entry.workDate);
    const unchangedHistoricalLink = Boolean(
      assignment && existingEntry?.workScheduleDailyAssignmentId === assignment.id,
    );
    if (assignment && !unchangedHistoricalLink && assignment.weeklySchedule.primaryEmployeeId !== primaryEmployeeId) {
      throw new TimesheetInputError(
        "ASSIGNMENT_OWNER_MISMATCH",
        `entries.${entryIndex}.workScheduleDailyAssignmentId`,
      );
    }
    if (assignment && !unchangedHistoricalLink && assignment.assignmentDate.getTime() !== parseDateOnly(entry.workDate).getTime()) {
      throw new TimesheetInputError(
        "ASSIGNMENT_DATE_MISMATCH",
        `entries.${entryIndex}.workScheduleDailyAssignmentId`,
      );
    }
    const effectiveStatus = assignment?.actualStatus !== "UNKNOWN"
      ? assignment?.actualStatus
      : assignment?.plannedStatus;
    if (
      assignment &&
      !unchangedHistoricalLink &&
      (assignment.weeklySchedule.status !== "ACTIVE" || effectiveStatus !== "SCHEDULED")
    ) {
      throw new TimesheetInputError(
        "ASSIGNMENT_INELIGIBLE",
        `entries.${entryIndex}.workScheduleDailyAssignmentId`,
      );
    }
  }

  return {
    equipmentById: new Map(equipment.map((item) => [item.id, item as EquipmentSnapshotSource])),
    workCodeById: new Map(workCodes.map((item) => [item.id, item as WorkCodeSource])),
    workOrderById: new Map(workOrders.map((item) => [item.id, item as WorkOrderSource])),
    supportPersonById: new Map(supportPersonnel.map((item) => [item.id, item as SupportPersonSource])),
  };
}

async function persistLeaveEntries(
  tx: Prisma.TransactionClient,
  weeklyTimesheetId: string,
  input: WeeklyTimesheetInput,
) {
  const submittedDates = input.leaveEntries.map((entry) => parseDateOnly(entry.workDate));
  for (const leave of input.leaveEntries) {
    const workDate = parseDateOnly(leave.workDate);
    await tx.timesheetLeaveEntry.upsert({
      where: {
        weeklyTimesheetId_workDate_leaveType: {
          weeklyTimesheetId,
          workDate,
          leaveType: "FTO",
        },
      },
      create: {
        weeklyTimesheetId,
        workDate,
        leaveType: "FTO",
        requestedMinutes: leave.requestedMinutes,
        approvalStatus: "REQUESTED",
        paymentStatus: "UNVERIFIED",
        workScheduleDailyAssignmentId: leave.workScheduleDailyAssignmentId || null,
        notes: leave.notes || null,
      },
      update: {
        requestedMinutes: leave.requestedMinutes,
        workScheduleDailyAssignmentId: leave.workScheduleDailyAssignmentId || null,
        notes: leave.notes || null,
      },
    });
  }
  await tx.timesheetLeaveEntry.deleteMany({
    where: {
      weeklyTimesheetId,
      leaveType: "FTO",
      workDate: { notIn: submittedDates },
    },
  });
}

async function persistNoWorkEntries(
  tx: Prisma.TransactionClient,
  weeklyTimesheetId: string,
  input: WeeklyTimesheetInput,
) {
  const noWorkEntries = input.noWorkEntries ?? [];
  const submittedDates = noWorkEntries.map((entry) => parseDateOnly(entry.workDate));
  for (const entry of noWorkEntries) {
    const workDate = parseDateOnly(entry.workDate);
    await tx.timesheetNoWorkEntry.upsert({
      where: { weeklyTimesheetId_workDate: { weeklyTimesheetId, workDate } },
      create: {
        weeklyTimesheetId,
        workDate,
        reason: entry.reason,
        workScheduleDailyAssignmentId: entry.workScheduleDailyAssignmentId || null,
        notes: entry.notes || null,
      },
      update: {
        reason: entry.reason,
        workScheduleDailyAssignmentId: entry.workScheduleDailyAssignmentId || null,
        notes: entry.notes || null,
      },
    });
  }
  await tx.timesheetNoWorkEntry.deleteMany({
    where: { weeklyTimesheetId, workDate: { notIn: submittedDates } },
  });
}

async function persistEntries(
  tx: Prisma.TransactionClient,
  weeklyTimesheetId: string,
  input: WeeklyTimesheetInput,
  existing: ExistingTimesheet | null,
  maps: Awaited<ReturnType<typeof referenceMaps>>,
) {
  const calculated = allocateWeeklyOvertime(
    input.entries.map((entry) => ({
      ...entry,
      workedMinutes: calculateWorkedMinutes(entry.clockIn, entry.clockOut, entry.unpaidBreakMinutes),
    })),
  );
  const existingByDate = new Map(
    existing?.entries.map((entry) => [entry.workDate.toISOString().slice(0, 10), entry]) ?? [],
  );
  const submittedDates = calculated.map((entry) => parseDateOnly(entry.workDate));
  const usedWorkCodeIds = new Set<string>();
  const usedWorkOrderIds = new Set<string>();
  const usedSupportPersonIds = new Set<string>();

  for (const [entryIndex, entry] of calculated.entries()) {
    const existingEntry = existingByDate.get(entry.workDate);
    const entryData = buildDailyEntryData(
      entry,
      entry.regularMinutes,
      entry.overtimeMinutes,
      maps.equipmentById,
      existingEntry as ExistingEquipmentSnapshot | undefined,
    );
    const savedEntry = await tx.dailyTimeEntry.upsert({
      where: { weeklyTimesheetId_workDate: { weeklyTimesheetId, workDate: entryData.workDate } },
      create: { weeklyTimesheetId, ...entryData },
      update: entryData,
    });
    const existingAllocationBySequence = new Map(
      existingEntry?.allocations.map((allocation) => [allocation.sequence, allocation]) ?? [],
    );
    const submittedSequences = entry.allocations.map((allocation) => allocation.sequence);

    for (const [allocationIndex, allocation] of entry.allocations.entries()) {
      const existingAllocation = existingAllocationBySequence.get(allocation.sequence) as ExistingAllocationSnapshot | undefined;
      if (!maps.workCodeById.get(allocation.workCodeId)?.active && existingAllocation?.workCodeId !== allocation.workCodeId) {
        throw new TimesheetInputError(
          "INACTIVE_WORK_CODE",
          `entries.${entryIndex}.allocations.${allocationIndex}.workCodeId`,
        );
      }
      if (
        allocation.workOrderId &&
        !maps.workOrderById.get(allocation.workOrderId)?.active &&
        existingAllocation?.workOrderId !== allocation.workOrderId
      ) {
        throw new TimesheetInputError(
          "INACTIVE_WORK_ORDER",
          `entries.${entryIndex}.allocations.${allocationIndex}.workOrderId`,
        );
      }
      for (const supportPersonId of allocation.supportPersonIds) {
        const previouslyLinked = existingAllocation?.supportPersonnel.some(
          (person) => person.supportPersonId === supportPersonId,
        );
        if (!maps.supportPersonById.get(supportPersonId)?.active && !previouslyLinked) {
          throw new TimesheetInputError(
            "INACTIVE_SUPPORT_PERSON",
            `entries.${entryIndex}.allocations.${allocationIndex}.supportPersonIds`,
          );
        }
      }
      const snapshots = allocationSnapshots(
        allocation.workCodeId,
        allocation.workOrderId,
        maps.workCodeById,
        maps.workOrderById,
        existingAllocation,
      );
      const savedAllocation = await tx.workAllocation.upsert({
        where: { dailyTimeEntryId_sequence: { dailyTimeEntryId: savedEntry.id, sequence: allocation.sequence } },
        create: {
          dailyTimeEntryId: savedEntry.id,
          sequence: allocation.sequence,
          workCodeId: allocation.workCodeId,
          ...snapshots,
          allocatedMinutes: allocation.allocatedMinutes,
          notes: allocation.notes || null,
        },
        update: {
          workCodeId: allocation.workCodeId,
          ...snapshots,
          allocatedMinutes: allocation.allocatedMinutes,
          notes: allocation.notes || null,
        },
      });
      usedWorkCodeIds.add(allocation.workCodeId);
      if (allocation.workOrderId) usedWorkOrderIds.add(allocation.workOrderId);

      await tx.workAllocationSupportPerson.deleteMany({
        where: { workAllocationId: savedAllocation.id, supportPersonId: { notIn: allocation.supportPersonIds } },
      });
      for (const supportPersonId of allocation.supportPersonIds) {
        const snapshot = supportPersonSnapshot(supportPersonId, maps.supportPersonById, existingAllocation);
        await tx.workAllocationSupportPerson.upsert({
          where: { workAllocationId_supportPersonId: { workAllocationId: savedAllocation.id, supportPersonId } },
          create: { workAllocationId: savedAllocation.id, ...snapshot },
          update: snapshot,
        });
        usedSupportPersonIds.add(supportPersonId);
      }
    }

    await tx.workAllocation.deleteMany({
      where: { dailyTimeEntryId: savedEntry.id, sequence: { notIn: submittedSequences } },
    });
  }

  await tx.dailyTimeEntry.deleteMany({
    where: { weeklyTimesheetId, workDate: { notIn: submittedDates } },
  });
  const now = new Date();
  await Promise.all([
    tx.timesheetWorkCode.updateMany({ where: { id: { in: [...usedWorkCodeIds] } }, data: { lastUsedAt: now } }),
    tx.timesheetWorkOrder.updateMany({ where: { id: { in: [...usedWorkOrderIds] } }, data: { lastUsedAt: now } }),
    tx.timesheetSupportPerson.updateMany({ where: { id: { in: [...usedSupportPersonIds] } }, data: { lastUsedAt: now } }),
  ]);
  return calculated;
}

export async function saveWeeklyTimesheetAction(
  timesheetId: string | null,
  _previousState: TimesheetFormState,
  formData: FormData,
) {
  const parsed = parsePayload(formData);
  if (!parsed.ok) return parsed.state;

  let savedId = timesheetId;
  try {
    savedId = await prisma.$transaction(async (tx) => {
      if (timesheetId) await acquirePayrollEvidenceLock(tx, "timesheet", timesheetId);
      const existing = timesheetId
        ? await tx.weeklyTimesheet.findUnique({ where: { id: timesheetId }, include: existingInclude })
        : null;
      if (timesheetId && !existing) throw new Error("NOT_FOUND");
      if (existing && !hasTrustedIdentity(existing.primaryEmployeeIdentityStatus)) {
        throw new Error("IDENTITY_REVIEW_REQUIRED");
      }
      if (existing?.status === "COMPLETED") throw new Error("COMPLETED_READ_ONLY");

      const submittedEmployeeId = parsed.data.primaryEmployeeId || null;
      let primaryEmployeeId: string | null;
      let primaryEmployeeDisplayName: string;
      let primaryEmployeeKey: string;
      if (existing) {
        if (submittedEmployeeId !== existing.primaryEmployeeId) {
          throw new TimesheetInputError("EMPLOYEE_CHANGE_NOT_ALLOWED", "primaryEmployeeId");
        }
        primaryEmployeeId = existing.primaryEmployeeId;
        primaryEmployeeDisplayName = existing.primaryEmployeeDisplayName;
        primaryEmployeeKey = existing.primaryEmployeeKey;
      } else {
        if (!submittedEmployeeId) {
          throw new TimesheetInputError("EMPLOYEE_REQUIRED", "primaryEmployeeId");
        }
        const employee = await tx.employee.findUnique({ where: { id: submittedEmployeeId } });
        if (!employee) throw new TimesheetInputError("INVALID_EMPLOYEE", "primaryEmployeeId");
        if (!employee.isActive) throw new TimesheetInputError("INACTIVE_EMPLOYEE", "primaryEmployeeId");
        primaryEmployeeId = employee.id;
        primaryEmployeeDisplayName = employee.displayName;
        primaryEmployeeKey = normalizeIdentityKey(employee.displayName);
      }
      const weekStart = parseDateOnly(parsed.data.payrollWeekStartDate);
      const weekEnd = endOfPayrollWeek(weekStart);
      const maps = await referenceMaps(tx, parsed.data, primaryEmployeeId, existing);
      let parentId: string;
      if (existing) {
        const updated = await tx.weeklyTimesheet.updateMany({
          where: {
            id: existing.id,
            primaryEmployeeId: existing.primaryEmployeeId,
            primaryEmployeeIdentityStatus: { in: ["EXPLICIT_SELECTION", "OWNER_VERIFIED"] },
            identityVersion: existing.identityVersion,
          },
          data: {
            payrollWeekStartDate: weekStart,
            payrollWeekEndDate: weekEnd,
            primaryEmployeeDisplayName,
            primaryEmployeeKey,
            primaryEmployeeId,
          },
        });
        if (updated.count !== 1) throw new Error("IDENTITY_REVIEW_REQUIRED");
        parentId = existing.id;
      } else {
        parentId = (await tx.weeklyTimesheet.create({
          data: {
            payrollWeekStartDate: weekStart,
            payrollWeekEndDate: weekEnd,
            primaryEmployeeDisplayName,
            primaryEmployeeKey,
            primaryEmployeeId,
            primaryEmployeeIdentityStatus: "EXPLICIT_SELECTION",
            identityCandidateEmployeeId: null,
            identityVersion: 1,
          },
        })).id;
      }
      const calculated = await persistEntries(tx, parentId, parsed.data, existing, maps);
      await persistLeaveEntries(tx, parentId, parsed.data);
      if ((parsed.data.noWorkEntries?.length ?? 0) > 0 || (existing?.noWorkEntries?.length ?? 0) > 0) {
        await persistNoWorkEntries(tx, parentId, parsed.data);
      }
      await tx.weeklyTimesheet.update({
        where: { id: parentId },
        data: {
          workedMinutesTotal: calculated.reduce((sum, entry) => sum + entry.workedMinutes, 0),
          regularMinutesTotal: calculated.reduce((sum, entry) => sum + entry.regularMinutes, 0),
          overtimeMinutesTotal: calculated.reduce((sum, entry) => sum + entry.overtimeMinutes, 0),
        },
      });
      return parentId;
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return errorState("A Timesheet already exists for this employee and payroll week.");
    const message = error instanceof Error ? error.message : "";
    const known: Record<string, string> = {
      NOT_FOUND: "Timesheet could not be found.",
      COMPLETED_READ_ONLY: "Reopen this Completed Timesheet before editing it.",
      EMPLOYEE_REQUIRED: "Select a primary employee.",
      INVALID_EMPLOYEE: "The selected Employee could not be found.",
      INACTIVE_EMPLOYEE: "Inactive Employees cannot own new Timesheets.",
      EMPLOYEE_CHANGE_NOT_ALLOWED: "Timesheet ownership cannot be changed during ordinary editing.",
      IDENTITY_REVIEW_REQUIRED: identityReviewRequiredMessage,
      INVALID_EQUIPMENT: "One or more selected Equipment records could not be found.",
      EQUIPMENT_REQUIRED: "Each Daily Time Entry requires primary Equipment.",
      INVALID_WORK_CODE: "One or more selected Work Codes could not be found.",
      INVALID_WORK_ORDER: "One or more selected Work Orders could not be found.",
      INVALID_SUPPORT_PERSON: "One or more selected Support Personnel records could not be found.",
      INVALID_ASSIGNMENT: "The selected Work Schedule assignment could not be found.",
      ASSIGNMENT_DATE_MISMATCH: "Work Schedule context must match the Daily Time Entry work date.",
      ASSIGNMENT_OWNER_MISMATCH: "Work Schedule context must belong to the same Timesheet employee.",
      ASSIGNMENT_INELIGIBLE: "Only Active scheduled Work Schedule assignments may be selected.",
      FTO_ASSIGNMENT_INELIGIBLE: "FTO context must link to a non-Draft assignment that was originally scheduled.",
      NO_WORK_ASSIGNMENT_INELIGIBLE: "A no-work explanation must link to a non-Draft assignment that was originally scheduled.",
      INACTIVE_WORK_CODE: "Inactive Work Codes cannot be selected for new allocations.",
      INACTIVE_WORK_ORDER: "Inactive Work Orders cannot be selected for new allocations.",
      INACTIVE_SUPPORT_PERSON: "Inactive Support Personnel cannot be selected for new allocations.",
    };
    const userMessage = known[message] ?? "Timesheet could not be saved. Review the entries and try again.";
    if (message === "IDENTITY_REVIEW_REQUIRED") {
      return errorState(userMessage, {}, "IDENTITY_REVIEW_REQUIRED");
    }
    return error instanceof TimesheetInputError
      ? errorState(userMessage, { [error.fieldPath]: [userMessage] })
      : errorState(userMessage);
  }

  revalidatePath("/");
  revalidatePath("/timesheets");
  revalidatePath("/payroll");
  const confirmationDate = formData.get("confirmationDate");
  const savedQuery = typeof confirmationDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(confirmationDate)
    ? `?savedDate=${encodeURIComponent(confirmationDate)}`
    : "?saved=week";
  redirect(`/timesheets/${savedId}${savedQuery}`);
}

export async function completeWeeklyTimesheetAction(
  id: string,
  _previousState: TimesheetMutationState,
  _formData: FormData,
): Promise<TimesheetMutationState> {
  const result = await prisma.$transaction(async (tx) => {
    await acquirePayrollEvidenceLock(tx, "timesheet", id);
    const timesheet = await tx.weeklyTimesheet.findUnique({
      where: { id },
      include: {
        entries: { orderBy: { workDate: "asc" }, include: { allocations: true } },
        leaveEntries: { select: { id: true, workDate: true } },
        noWorkEntries: { select: { workDate: true } },
      },
    });
    if (!timesheet) return { ok: false, message: "Timesheet could not be found." };
    if (!hasTrustedIdentity(timesheet.primaryEmployeeIdentityStatus)) {
      return {
        ok: false,
        code: "IDENTITY_REVIEW_REQUIRED" as const,
        message: identityReviewRequiredMessage,
      };
    }
    if (timesheet.status === "COMPLETED") return { ok: true, message: "" };
    const issues = validateCompletion(
      timesheet.entries,
      timesheet.leaveEntries?.length ?? 0,
      timesheet.noWorkEntries?.length ?? 0,
    );
    const scheduledAssignments = timesheet.primaryEmployeeId
      ? await tx.dailyAssignment.findMany({
          where: {
            assignmentDate: { gte: timesheet.payrollWeekStartDate, lte: timesheet.payrollWeekEndDate },
            plannedStatus: "SCHEDULED",
            weeklySchedule: {
              primaryEmployeeId: timesheet.primaryEmployeeId,
              status: { in: ["ACTIVE", "ARCHIVED"] },
            },
          },
          select: { assignmentDate: true },
        })
      : [];
    const accountedDates = new Set([
      ...timesheet.entries.map((entry) => entry.workDate?.toISOString().slice(0, 10)),
      ...(timesheet.leaveEntries ?? []).map((entry) => entry.workDate?.toISOString().slice(0, 10)),
      ...(timesheet.noWorkEntries ?? []).map((entry) => entry.workDate?.toISOString().slice(0, 10)),
    ].filter((date): date is string => Boolean(date)));
    for (const assignment of scheduledAssignments) {
      const date = assignment.assignmentDate.toISOString().slice(0, 10);
      if (!accountedDates.has(date)) issues.push(`${date} is scheduled but has no worked time or no-work explanation.`);
    }
    if (issues.length > 0) return { ok: false, message: issues.join(" ") };
    const completed = await tx.weeklyTimesheet.updateMany({
      where: {
        id,
        status: "DRAFT",
        primaryEmployeeIdentityStatus: { in: ["EXPLICIT_SELECTION", "OWNER_VERIFIED"] },
      },
      data: { status: "COMPLETED" },
    });
    if (completed.count !== 1) {
      return {
        ok: false,
        code: "IDENTITY_REVIEW_REQUIRED" as const,
        message: identityReviewRequiredMessage,
      };
    }
    return { ok: true, message: "Timesheet completed successfully." };
  });
  if (!result.ok) return result;
  revalidatePath("/timesheets");
  revalidatePath(`/timesheets/${id}`);
  revalidatePath("/payroll");
  redirect(`/timesheets/${id}?completed=1`);
}

export async function reopenWeeklyTimesheetAction(
  id: string,
  _previousState: TimesheetMutationState,
  _formData: FormData,
): Promise<TimesheetMutationState> {
  const result = await prisma.$transaction(async (tx) => {
    await acquirePayrollEvidenceLock(tx, "timesheet", id);
    const timesheet = await tx.weeklyTimesheet.findUnique({
      where: { id },
      select: { primaryEmployeeIdentityStatus: true },
    });
    if (timesheet && !hasTrustedIdentity(timesheet.primaryEmployeeIdentityStatus)) {
      return { blocked: true };
    }
    await tx.weeklyTimesheet.updateMany({
      where: {
        id,
        status: "COMPLETED",
        primaryEmployeeIdentityStatus: { in: ["EXPLICIT_SELECTION", "OWNER_VERIFIED"] },
      },
      data: { status: "DRAFT" },
    });
    return { blocked: false };
  });
  if (result.blocked) {
    return { ok: false, code: "IDENTITY_REVIEW_REQUIRED" as const, message: identityReviewRequiredMessage };
  }
  revalidatePath("/timesheets");
  revalidatePath(`/timesheets/${id}`);
  revalidatePath("/payroll");
  redirect(`/timesheets/${id}/edit`);
}

export async function deleteWeeklyTimesheetAction(
  id: string,
  _previousState: TimesheetMutationState,
  _formData: FormData,
): Promise<TimesheetMutationState> {
  const result = await prisma.$transaction(async (tx) => {
    await acquirePayrollEvidenceLock(tx, "timesheet", id);
    const timesheet = await tx.weeklyTimesheet.findUnique({
      where: { id },
      select: { primaryEmployeeIdentityStatus: true },
    });
    if (timesheet && !hasTrustedIdentity(timesheet.primaryEmployeeIdentityStatus)) {
      return { blocked: true };
    }
    await tx.weeklyTimesheet.deleteMany({
      where: {
        id,
        status: "DRAFT",
        primaryEmployeeIdentityStatus: { in: ["EXPLICIT_SELECTION", "OWNER_VERIFIED"] },
      },
    });
    return { blocked: false };
  });
  if (result.blocked) {
    return { ok: false, code: "IDENTITY_REVIEW_REQUIRED" as const, message: identityReviewRequiredMessage };
  }
  revalidatePath("/timesheets");
  revalidatePath("/payroll");
  redirect("/timesheets");
}

function checked(formData: FormData) {
  return formData.get("active") === "on";
}

function referenceError(message: string) {
  return { ok: false, message };
}

export async function saveWorkCodeAction(
  id: string | null,
  _previousState: { ok: boolean; message: string },
  formData: FormData,
) {
  const parsed = workCodeSchema.safeParse({
    code: formData.get("code"), description: formData.get("description"), category: formData.get("category"),
    equipmentId: formData.get("equipmentId"), active: checked(formData),
  });
  if (!parsed.success) return referenceError(parsed.error.issues[0]?.message ?? "Invalid Work Code.");
  try {
    const data = { ...parsed.data, category: parsed.data.category || null, equipmentId: parsed.data.equipmentId || null, normalizedCode: normalizeReferenceKey(parsed.data.code) };
    if (id) await prisma.timesheetWorkCode.update({ where: { id }, data });
    else await prisma.timesheetWorkCode.create({ data });
  } catch (error) {
    return referenceError(isPrismaError(error, "P2002") ? "That Work Code already exists." : "Work Code could not be saved.");
  }
  revalidatePath("/timesheets/work-codes");
  revalidatePath("/timesheets/new");
  return { ok: true, message: "Work Code saved." };
}

export async function saveWorkOrderAction(
  id: string | null,
  _previousState: { ok: boolean; message: string },
  formData: FormData,
) {
  const parsed = workOrderSchema.safeParse({
    workOrderNumber: formData.get("workOrderNumber"), description: formData.get("description"),
    equipmentId: formData.get("equipmentId"), active: checked(formData),
  });
  if (!parsed.success) return referenceError(parsed.error.issues[0]?.message ?? "Invalid Work Order.");
  try {
    const data = { ...parsed.data, equipmentId: parsed.data.equipmentId || null, normalizedWorkOrderNumber: normalizeReferenceKey(parsed.data.workOrderNumber) };
    if (id) await prisma.timesheetWorkOrder.update({ where: { id }, data });
    else await prisma.timesheetWorkOrder.create({ data });
  } catch (error) {
    return referenceError(isPrismaError(error, "P2002") ? "That Work Order already exists." : "Work Order could not be saved.");
  }
  revalidatePath("/timesheets/work-orders");
  revalidatePath("/timesheets/new");
  return { ok: true, message: "Work Order saved." };
}

export async function saveSupportPersonAction(
  id: string | null,
  _previousState: { ok: boolean; message: string },
  formData: FormData,
) {
  const parsed = supportPersonSchema.safeParse({
    displayName: formData.get("displayName"), tradeOrRole: formData.get("tradeOrRole"), company: formData.get("company"),
    active: checked(formData), notes: formData.get("notes"),
  });
  if (!parsed.success) return referenceError(parsed.error.issues[0]?.message ?? "Invalid Support Person.");
  try {
    const data = {
      ...parsed.data,
      company: parsed.data.company || null,
      notes: parsed.data.notes || null,
      normalizedIdentity: normalizeSupportPersonKey(parsed.data.displayName, parsed.data.tradeOrRole, parsed.data.company),
    };
    if (id) await prisma.timesheetSupportPerson.update({ where: { id }, data });
    else await prisma.timesheetSupportPerson.create({ data });
  } catch (error) {
    return referenceError(isPrismaError(error, "P2002") ? "That Support Person already exists." : "Support Person could not be saved.");
  }
  revalidatePath("/timesheets/support-personnel");
  revalidatePath("/timesheets/new");
  return { ok: true, message: "Support Person saved." };
}
