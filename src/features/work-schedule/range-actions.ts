"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  buildDailyAssignmentWriteData,
  type EmployeeSnapshotSource,
  type EquipmentSnapshotSource,
  type ExistingAssignmentSnapshot,
} from "./persistence";
import {
  scheduleRangeFormSchema,
  scheduleWeekStarts,
  type ScheduleRangeFormInput,
} from "./range-validation";
import {
  emptyScheduleRangeFormState,
  type ScheduleRangeFormState,
  type ScheduleRangeSubmittedValues,
} from "./range-state";
import { endOfOperationalWeek, normalizePrimaryEmployeeKey, parseDateOnly } from "./validation";

class ScheduleRangeConflictError extends Error {
  constructor(readonly dates: string[]) {
    super("Schedule range contains existing planned assignments.");
  }
}

class ScheduleRangeInputError extends Error {}

function formValues(formData: FormData, field: string) {
  return formData.getAll(field).map((value) => typeof value === "string" ? value : "");
}

function submittedValues(formData: FormData): ScheduleRangeSubmittedValues {
  const stringValue = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  const dates = formValues(formData, "assignmentDate");
  const values = (field: string) => formValues(formData, field);

  return {
    startDate: stringValue("startDate"),
    endDate: stringValue("endDate"),
    status: stringValue("status"),
    primaryEmployeeId: stringValue("primaryEmployeeId"),
    assignedByEmployeeId: stringValue("assignedByEmployeeId"),
    receivedAt: stringValue("receivedAt"),
    sourceNote: stringValue("sourceNote"),
    scheduleNotes: stringValue("scheduleNotes"),
    overwriteConflicts: stringValue("overwriteConflicts") === "true",
    assignments: dates.map((assignmentDate, index) => ({
      assignmentDate,
      dayOfWeek: values("dayOfWeek")[index] ?? "",
      plannedStatus: values("plannedStatus")[index] ?? "",
      plannedShift: values("plannedShift")[index] ?? "",
      plannedEquipmentId: values("plannedEquipmentId")[index] ?? "",
      actualStatus: values("actualStatus")[index] ?? "",
      actualShift: values("actualShift")[index] ?? "",
      actualEquipmentId: values("actualEquipmentId")[index] ?? "",
      plannedPrimaryEmployeeId: values("plannedPrimaryEmployeeId")[index] ?? "",
      plannedPartnerEmployeeId: values("plannedPartnerEmployeeId")[index] ?? "",
      plannedPartnerUnknown: formData.get(`plannedPartnerUnknown-${index}`) === "on",
      actualPrimaryEmployeeId: values("actualPrimaryEmployeeId")[index] ?? "",
      actualPartnerEmployeeId: values("actualPartnerEmployeeId")[index] ?? "",
      actualPartnerUnknown: formData.get(`actualPartnerUnknown-${index}`) === "on",
      changeReason: values("changeReason")[index] ?? "",
      plannedNotes: values("plannedNotes")[index] ?? "",
      actualNotes: values("actualNotes")[index] ?? "",
    })),
  };
}

function validationState(
  values: ScheduleRangeSubmittedValues,
  issues: { path: PropertyKey[]; message: string }[],
): ScheduleRangeFormState {
  const state: ScheduleRangeFormState = {
    ...emptyScheduleRangeFormState,
    status: "error",
    message: "Check the highlighted fields and try again.",
    submittedValues: values,
  };
  for (const issue of issues) {
    const [scope, index, field] = issue.path;
    if (scope === "assignments" && typeof index === "number" && typeof field === "string") {
      state.assignmentErrors[index] ??= {};
      state.assignmentErrors[index][field] ??= [];
      state.assignmentErrors[index][field].push(issue.message);
    } else if (typeof scope === "string") {
      state.fieldErrors[scope] ??= [];
      state.fieldErrors[scope].push(issue.message);
    }
  }
  return state;
}

function errorState(message: string, values: ScheduleRangeSubmittedValues): ScheduleRangeFormState {
  return {
    ...emptyScheduleRangeFormState,
    status: "error",
    message,
    submittedValues: values,
  };
}

function selectedEmployeeIds(input: ScheduleRangeFormInput) {
  return [...new Set([
    input.primaryEmployeeId,
    input.assignedByEmployeeId,
    ...input.assignments.flatMap((assignment) => [
      assignment.plannedPrimaryEmployeeId,
      assignment.plannedPartnerEmployeeId,
      assignment.actualPrimaryEmployeeId,
      assignment.actualPartnerEmployeeId,
    ]),
  ].filter((id): id is string => Boolean(id)))];
}

function selectedEquipmentIds(input: ScheduleRangeFormInput) {
  return [...new Set(input.assignments.flatMap((assignment) => [
    assignment.plannedEquipmentId,
    assignment.actualEquipmentId,
  ]).filter((id): id is string => Boolean(id)))];
}

function existingEmployeeIds(schedules: ExistingSchedule[]) {
  return new Set(schedules.flatMap((schedule) => [
    schedule.primaryEmployeeId,
    schedule.assignedByEmployeeId,
    ...schedule.assignments.flatMap((assignment) =>
      assignment.crewMembers.map((member) => member.employeeId),
    ),
  ].filter((id): id is string => Boolean(id))));
}

function hasPlannedData(assignment: ExistingSchedule["assignments"][number]) {
  return assignment.plannedStatus !== "UNKNOWN" ||
    assignment.plannedShift !== "UNKNOWN" ||
    Boolean(assignment.plannedEquipmentId) ||
    Boolean(assignment.plannedNotes?.trim()) ||
    assignment.crewMembers.some((member) => member.phase === "PLANNED");
}

type ExistingSchedule = Prisma.WeeklyScheduleGetPayload<{
  include: { assignments: { include: { crewMembers: true } } };
}>;

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function saveScheduleRangeAction(
  _previousState: ScheduleRangeFormState,
  formData: FormData,
) {
  const values = submittedValues(formData);
  const parsed = scheduleRangeFormSchema.safeParse(values);
  if (!parsed.success) return validationState(values, parsed.error.issues);
  const input = parsed.data;

  if (!input.primaryEmployeeId) {
    return {
      ...errorState("Select the required employees and try again.", values),
      fieldErrors: { primaryEmployeeId: ["Primary employee is required."] },
    };
  }
  if (!input.assignedByEmployeeId) {
    return {
      ...errorState("Select the required employees and try again.", values),
      fieldErrors: { assignedByEmployeeId: ["Assigned By is required."] },
    };
  }

  const weekStartKeys = scheduleWeekStarts(input);
  const weekStartDates = weekStartKeys.map(parseDateOnly);
  const submittedDateSet = new Set(input.assignments.map((assignment) => assignment.assignmentDate));

  try {
    await prisma.$transaction(async (tx) => {
      const schedules = await tx.weeklySchedule.findMany({
        where: {
          weekStartDate: { in: weekStartDates },
          primaryEmployeeId: input.primaryEmployeeId,
        },
        include: { assignments: { include: { crewMembers: true } } },
      });
      const [employees, equipment] = await Promise.all([
        tx.employee.findMany({ where: { id: { in: selectedEmployeeIds(input) } } }),
        tx.equipment.findMany({
          where: { id: { in: selectedEquipmentIds(input) } },
          include: { mine: { include: { city: true } } },
        }),
      ]);
      const employeeById = new Map(employees.map((employee) => [employee.id, employee])) as Map<string, EmployeeSnapshotSource>;
      const equipmentById = new Map(equipment.map((item) => [item.id, item])) as Map<string, EquipmentSnapshotSource>;
      const unchangedIds = existingEmployeeIds(schedules);

      if (selectedEmployeeIds(input).some((id) => !employeeById.has(id))) {
        throw new ScheduleRangeInputError("One or more selected employee records could not be found.");
      }
      if (selectedEquipmentIds(input).some((id) => !equipmentById.has(id))) {
        throw new ScheduleRangeInputError("One or more selected equipment records could not be found.");
      }
      if (selectedEmployeeIds(input).some((id) => !employeeById.get(id)?.isActive && !unchangedIds.has(id))) {
        throw new ScheduleRangeInputError("Inactive employees cannot be selected for new assignments.");
      }
      if (!employeeById.get(input.assignedByEmployeeId!)?.isSupervisor &&
        !unchangedIds.has(input.assignedByEmployeeId!)) {
        throw new ScheduleRangeInputError("Assigned By must be an eligible supervisor.");
      }

      const conflicts = schedules.flatMap((schedule) => schedule.assignments)
        .filter((assignment) => {
          const date = assignment.assignmentDate.toISOString().slice(0, 10);
          return submittedDateSet.has(date) && hasPlannedData(assignment);
        })
        .map((assignment) => assignment.assignmentDate.toISOString().slice(0, 10))
        .sort();
      if (conflicts.length > 0 && !input.overwriteConflicts) {
        throw new ScheduleRangeConflictError(conflicts);
      }

      const primaryEmployee = employeeById.get(input.primaryEmployeeId!);
      const assignedBy = employeeById.get(input.assignedByEmployeeId!);
      if (!primaryEmployee || !assignedBy) {
        throw new ScheduleRangeInputError("Select the required employees and try again.");
      }

      const schedulesByStart = new Map(
        schedules.map((schedule) => [schedule.weekStartDate.toISOString().slice(0, 10), schedule]),
      );
      for (const weekStartKey of weekStartKeys) {
        const weekStartDate = parseDateOnly(weekStartKey);
        const headerData = {
          weekStartDate,
          weekEndDate: endOfOperationalWeek(weekStartDate),
          status: input.status,
          primaryEmployeeId: primaryEmployee.id,
          primaryEmployeeDisplayName: primaryEmployee.displayName,
          primaryEmployeeKey: normalizePrimaryEmployeeKey(primaryEmployee.displayName),
          assignedByEmployeeId: assignedBy.id,
          assignedByDisplayName: assignedBy.displayName,
          receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
          sourceNote: input.sourceNote ?? null,
          scheduleNotes: input.scheduleNotes ?? null,
        };
        const existing = schedulesByStart.get(weekStartKey);
        const schedule = existing
          ? await tx.weeklySchedule.update({ where: { id: existing.id }, data: headerData })
          : await tx.weeklySchedule.create({ data: headerData });
        const existingByDate = new Map(existing?.assignments.map((assignment) => [
          assignment.assignmentDate.toISOString().slice(0, 10),
          assignment,
        ]) ?? []);
        const weekEnd = endOfOperationalWeek(weekStartDate);
        const weekAssignments = input.assignments.filter((assignment) => {
          const date = parseDateOnly(assignment.assignmentDate);
          return date >= weekStartDate && date <= weekEnd;
        });

        for (const assignment of weekAssignments) {
          const writeData = buildDailyAssignmentWriteData(
            assignment,
            { employeeId: primaryEmployee.id, displayName: primaryEmployee.displayName },
            equipmentById,
            employeeById,
            existingByDate.get(assignment.assignmentDate) as ExistingAssignmentSnapshot | undefined,
          );
          const { crewMembers, ...assignmentData } = writeData;
          const assignmentDate = parseDateOnly(assignment.assignmentDate);
          await tx.dailyAssignment.upsert({
            where: {
              weeklyScheduleId_assignmentDate: {
                weeklyScheduleId: schedule.id,
                assignmentDate,
              },
            },
            create: { ...assignmentData, weeklyScheduleId: schedule.id, crewMembers },
            update: {
              ...assignmentData,
              crewMembers: { deleteMany: {}, create: crewMembers.create },
            },
          });
        }
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof ScheduleRangeConflictError) {
      return {
        ...emptyScheduleRangeFormState,
        status: "conflict" as const,
        message: "Existing planned assignments were found in this date range. Review the dates and confirm before replacing them.",
        conflictDates: error.dates,
        submittedValues: values,
      };
    }
    if (error instanceof ScheduleRangeInputError) return errorState(error.message, values);
    if (isPrismaError(error, "P2002") || isPrismaError(error, "P2034")) {
      return errorState("The schedule changed while you were saving. Reload and try again.", values);
    }
    return errorState("The schedule range could not be saved. No changes were made. Review the fields and try again.", values);
  }

  revalidatePath("/");
  revalidatePath("/work-schedule");
  const query = new URLSearchParams({
    saved: "range",
    startDate: input.startDate,
    endDate: input.endDate,
    weeks: String(weekStartKeys.length),
  });
  redirect(`/work-schedule?${query.toString()}`);
}
