"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

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
import type { TimesheetFormState, WeeklyTimesheetInput } from "./types";
import {
  supportPersonSchema,
  validateCompletion,
  weeklyTimesheetInputSchema,
  workCodeSchema,
  workOrderSchema,
} from "./validation";
import { getWorkScheduleAssignmentOptions } from "./data";

function errorState(message: string, fieldErrors: Record<string, string[]> = {}): TimesheetFormState {
  return { status: "error", message, fieldErrors };
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

export async function getWorkScheduleAssignmentsForOwnerAction(
  primaryEmployeeDisplayName: string,
) {
  const primaryEmployeeKey = normalizeIdentityKey(primaryEmployeeDisplayName);
  if (!primaryEmployeeKey) return [];
  return getWorkScheduleAssignmentOptions(primaryEmployeeKey);
}

const existingInclude = {
  entries: {
    include: {
      allocations: { include: { supportPersonnel: true } },
    },
  },
} satisfies Prisma.WeeklyTimesheetInclude;

type ExistingTimesheet = Prisma.WeeklyTimesheetGetPayload<{ include: typeof existingInclude }>;

async function referenceMaps(
  tx: Prisma.TransactionClient,
  input: WeeklyTimesheetInput,
  existing?: ExistingTimesheet | null,
) {
  const equipmentIds = [
    ...new Set(input.entries.map((entry) => entry.primaryEquipmentId).filter(Boolean)),
  ];
  const workCodeIds = [...new Set(input.entries.flatMap((entry) => entry.allocations.map((item) => item.workCodeId)))];
  const workOrderIds = [...new Set(input.entries.flatMap((entry) => entry.allocations.map((item) => item.workOrderId).filter(Boolean)))] as string[];
  const supportPersonIds = [...new Set(input.entries.flatMap((entry) => entry.allocations.flatMap((item) => item.supportPersonIds)))];
  const assignmentIds = [...new Set(input.entries.map((entry) => entry.workScheduleDailyAssignmentId).filter(Boolean))] as string[];

  const [equipment, workCodes, workOrders, supportPersonnel, assignments] = await Promise.all([
    tx.equipment.findMany({ where: { id: { in: equipmentIds } }, include: { mine: { include: { city: true } } } }),
    tx.timesheetWorkCode.findMany({ where: { id: { in: workCodeIds } } }),
    tx.timesheetWorkOrder.findMany({ where: { id: { in: workOrderIds } } }),
    tx.timesheetSupportPerson.findMany({ where: { id: { in: supportPersonIds } } }),
    tx.dailyAssignment.findMany({
      where: { id: { in: assignmentIds } },
      include: { weeklySchedule: { select: { primaryEmployeeKey: true } } },
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

  for (const [entryIndex, entry] of input.entries.entries()) {
    const assignment = assignments.find((item) => item.id === entry.workScheduleDailyAssignmentId);
    if (
      assignment &&
      assignment.weeklySchedule.primaryEmployeeKey !==
        normalizeIdentityKey(input.primaryEmployeeDisplayName)
    ) {
      throw new TimesheetInputError(
        "ASSIGNMENT_OWNER_MISMATCH",
        `entries.${entryIndex}.workScheduleDailyAssignmentId`,
      );
    }
    if (assignment && assignment.assignmentDate.getTime() !== parseDateOnly(entry.workDate).getTime()) {
      throw new TimesheetInputError(
        "ASSIGNMENT_DATE_MISMATCH",
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
      const existing = timesheetId
        ? await tx.weeklyTimesheet.findUnique({ where: { id: timesheetId }, include: existingInclude })
        : null;
      if (timesheetId && !existing) throw new Error("NOT_FOUND");
      if (existing?.status === "COMPLETED") throw new Error("COMPLETED_READ_ONLY");

      const primaryEmployeeKey = normalizeIdentityKey(parsed.data.primaryEmployeeDisplayName);
      const weekStart = parseDateOnly(parsed.data.payrollWeekStartDate);
      const weekEnd = endOfPayrollWeek(weekStart);
      const maps = await referenceMaps(tx, parsed.data, existing);
      const parent = existing
        ? await tx.weeklyTimesheet.update({
            where: { id: existing.id },
            data: {
              payrollWeekStartDate: weekStart,
              payrollWeekEndDate: weekEnd,
              primaryEmployeeDisplayName: parsed.data.primaryEmployeeDisplayName,
              primaryEmployeeKey,
            },
          })
        : await tx.weeklyTimesheet.create({
            data: {
              payrollWeekStartDate: weekStart,
              payrollWeekEndDate: weekEnd,
              primaryEmployeeDisplayName: parsed.data.primaryEmployeeDisplayName,
              primaryEmployeeKey,
            },
          });
      const calculated = await persistEntries(tx, parent.id, parsed.data, existing, maps);
      await tx.weeklyTimesheet.update({
        where: { id: parent.id },
        data: {
          workedMinutesTotal: calculated.reduce((sum, entry) => sum + entry.workedMinutes, 0),
          regularMinutesTotal: calculated.reduce((sum, entry) => sum + entry.regularMinutes, 0),
          overtimeMinutesTotal: calculated.reduce((sum, entry) => sum + entry.overtimeMinutes, 0),
        },
      });
      return parent.id;
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return errorState("A Timesheet already exists for this employee and payroll week.");
    const message = error instanceof Error ? error.message : "";
    const known: Record<string, string> = {
      NOT_FOUND: "Timesheet could not be found.",
      COMPLETED_READ_ONLY: "Reopen this Completed Timesheet before editing it.",
      INVALID_EQUIPMENT: "One or more selected Equipment records could not be found.",
      EQUIPMENT_REQUIRED: "Each Daily Time Entry requires primary Equipment.",
      INVALID_WORK_CODE: "One or more selected Work Codes could not be found.",
      INVALID_WORK_ORDER: "One or more selected Work Orders could not be found.",
      INVALID_SUPPORT_PERSON: "One or more selected Support Personnel records could not be found.",
      INVALID_ASSIGNMENT: "The selected Work Schedule assignment could not be found.",
      ASSIGNMENT_DATE_MISMATCH: "Work Schedule context must match the Daily Time Entry work date.",
      ASSIGNMENT_OWNER_MISMATCH: "Work Schedule context must belong to the same Timesheet employee.",
      INACTIVE_WORK_CODE: "Inactive Work Codes cannot be selected for new allocations.",
      INACTIVE_WORK_ORDER: "Inactive Work Orders cannot be selected for new allocations.",
      INACTIVE_SUPPORT_PERSON: "Inactive Support Personnel cannot be selected for new allocations.",
    };
    const userMessage = known[message] ?? "Timesheet could not be saved. Review the entries and try again.";
    return error instanceof TimesheetInputError
      ? errorState(userMessage, { [error.fieldPath]: [userMessage] })
      : errorState(userMessage);
  }

  revalidatePath("/");
  revalidatePath("/timesheets");
  redirect(`/timesheets/${savedId}`);
}

export async function completeWeeklyTimesheetAction(
  id: string,
  _previousState: { ok: boolean; message: string },
  _formData: FormData,
) {
  const result = await prisma.$transaction(async (tx) => {
    const timesheet = await tx.weeklyTimesheet.findUnique({
      where: { id },
      include: { entries: { orderBy: { workDate: "asc" }, include: { allocations: true } } },
    });
    if (!timesheet) return { ok: false, message: "Timesheet could not be found." };
    if (timesheet.status === "COMPLETED") return { ok: true, message: "" };
    const issues = validateCompletion(timesheet.entries);
    if (issues.length > 0) return { ok: false, message: issues.join(" ") };
    await tx.weeklyTimesheet.update({ where: { id }, data: { status: "COMPLETED" } });
    return { ok: true, message: "" };
  });
  if (!result.ok) return result;
  revalidatePath("/timesheets");
  revalidatePath(`/timesheets/${id}`);
  redirect(`/timesheets/${id}`);
}

export async function reopenWeeklyTimesheetAction(id: string) {
  await prisma.weeklyTimesheet.updateMany({ where: { id, status: "COMPLETED" }, data: { status: "DRAFT" } });
  revalidatePath("/timesheets");
  revalidatePath(`/timesheets/${id}`);
  redirect(`/timesheets/${id}/edit`);
}

export async function deleteWeeklyTimesheetAction(id: string) {
  await prisma.weeklyTimesheet.deleteMany({ where: { id, status: "DRAFT" } });
  revalidatePath("/timesheets");
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
