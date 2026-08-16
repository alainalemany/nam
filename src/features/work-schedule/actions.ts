"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  buildDailyAssignmentWriteData,
  buildWeeklyScheduleWriteData,
  type EmployeeSnapshotSource,
  type EquipmentSnapshotSource,
  type ExistingAssignmentSnapshot,
} from "./persistence";
import {
  emptyWeeklyScheduleFormState,
  type AssignmentFormField,
  type WeeklyScheduleFormInput,
  weeklyScheduleFormSchema,
  type WeeklyScheduleFormState,
} from "./validation";

function errorState(message: string): WeeklyScheduleFormState {
  return { ...emptyWeeklyScheduleFormState, status: "error", message };
}

function requiredEmployeeState(field: "primaryEmployeeId" | "assignedByEmployeeId") {
  return {
    ...errorState("Select the required employees and try again."),
    fieldErrors: {
      [field]: [field === "primaryEmployeeId" ? "Primary employee is required." : "Assigned By is required."],
    },
  };
}

function validationErrorState(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): WeeklyScheduleFormState {
  const state: WeeklyScheduleFormState = {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors: {},
    assignmentErrors: {},
  };

  for (const issue of error.issues) {
    const [scope, index, field] = issue.path;

    if (scope === "assignments" && typeof index === "number" && typeof field === "string") {
      state.assignmentErrors[index] ??= {};
      const assignmentErrors = state.assignmentErrors[index];
      const fieldName = field as AssignmentFormField;
      assignmentErrors[fieldName] ??= [];
      assignmentErrors[fieldName]?.push(issue.message);
      continue;
    }

    if (scope === "assignments") {
      state.fieldErrors.assignments ??= [];
      state.fieldErrors.assignments.push(issue.message);
      continue;
    }

    if (typeof scope === "string") {
      const fieldName = scope as keyof WeeklyScheduleFormInput;
      if (fieldName !== "assignments") {
        state.fieldErrors[fieldName] ??= [];
        state.fieldErrors[fieldName]?.push(issue.message);
      }
    }
  }

  return state;
}

function formValues(formData: FormData, field: string) {
  return formData.getAll(field).map((value) => (typeof value === "string" ? value : ""));
}

function parseAssignments(formData: FormData) {
  const assignmentDates = formValues(formData, "assignmentDate");

  return assignmentDates.map((_, index) => ({
    assignmentDate: assignmentDates[index],
    dayOfWeek: formValues(formData, "dayOfWeek")[index],
    plannedStatus: formValues(formData, "plannedStatus")[index],
    plannedShift: formValues(formData, "plannedShift")[index],
    plannedEquipmentId: formValues(formData, "plannedEquipmentId")[index],
    actualStatus: formValues(formData, "actualStatus")[index],
    actualShift: formValues(formData, "actualShift")[index],
    actualEquipmentId: formValues(formData, "actualEquipmentId")[index],
    plannedPrimaryEmployeeId: formValues(formData, "plannedPrimaryEmployeeId")[index],
    plannedPartnerEmployeeId: formValues(formData, "plannedPartnerEmployeeId")[index],
    plannedPartnerUnknown:
      formData.get(`plannedPartnerUnknown-${index}`) === "on" ? "on" : "",
    actualPrimaryEmployeeId: formValues(formData, "actualPrimaryEmployeeId")[index],
    actualPartnerEmployeeId: formValues(formData, "actualPartnerEmployeeId")[index],
    actualPartnerUnknown: formData.get(`actualPartnerUnknown-${index}`) === "on" ? "on" : "",
    changeReason: formValues(formData, "changeReason")[index],
    plannedNotes: formValues(formData, "plannedNotes")[index],
    actualNotes: formValues(formData, "actualNotes")[index],
  }));
}

function parseFormData(formData: FormData):
  | { ok: true; data: WeeklyScheduleFormInput }
  | { ok: false; state: WeeklyScheduleFormState } {
  const parsed = weeklyScheduleFormSchema.safeParse({
    weekStartDate: formData.get("weekStartDate"),
    status: formData.get("status"),
    primaryEmployeeId: formData.get("primaryEmployeeId"),
    assignedByEmployeeId: formData.get("assignedByEmployeeId"),
    receivedAt: formData.get("receivedAt"),
    sourceNote: formData.get("sourceNote"),
    scheduleNotes: formData.get("scheduleNotes"),
    assignments: parseAssignments(formData),
  });

  if (!parsed.success) {
    return {
      ok: false,
      state: validationErrorState(parsed.error),
    };
  }

  return { ok: true, data: parsed.data };
}

async function equipmentMapFor(input: WeeklyScheduleFormInput) {
  const ids = Array.from(
    new Set(
      input.assignments
        .flatMap((assignment) => [
          assignment.plannedEquipmentId,
          assignment.actualEquipmentId,
        ])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (ids.length === 0) {
    return new Map<string, EquipmentSnapshotSource>();
  }

  const equipment = await prisma.equipment.findMany({
    where: { id: { in: ids } },
    include: { mine: { include: { city: true } } },
  });

  return new Map(equipment.map((item) => [item.id, item]));
}

function selectedEmployeeIds(input: WeeklyScheduleFormInput) {
  return Array.from(
    new Set(
      [
        input.primaryEmployeeId,
        input.assignedByEmployeeId,
        ...input.assignments.flatMap((assignment) => [
          assignment.plannedPrimaryEmployeeId,
          assignment.actualPrimaryEmployeeId,
          assignment.plannedPartnerEmployeeId,
          assignment.actualPartnerEmployeeId,
        ]),
      ].filter((id): id is string => Boolean(id)),
    ),
  );
}

async function employeeMapFor(input: WeeklyScheduleFormInput) {
  const ids = selectedEmployeeIds(input);
  if (ids.length === 0) return new Map<string, EmployeeSnapshotSource>();

  const employees = await prisma.employee.findMany({ where: { id: { in: ids } } });
  return new Map(employees.map((employee) => [employee.id, employee]));
}

function employeeSelectionError(
  input: WeeklyScheduleFormInput,
  employeeById: Map<string, EmployeeSnapshotSource>,
  existingEmployeeIds = new Set<string>(),
) {
  const missing = selectedEmployeeIds(input).some((id) => !employeeById.has(id));
  if (missing) return "One or more selected employee records could not be found.";

  const newlySelectedInactive = selectedEmployeeIds(input).some(
    (id) => !employeeById.get(id)?.isActive && !existingEmployeeIds.has(id),
  );
  if (newlySelectedInactive) return "Inactive employees cannot be selected for new assignments.";

  if (
    input.assignedByEmployeeId &&
    !employeeById.get(input.assignedByEmployeeId)?.isSupervisor &&
    !existingEmployeeIds.has(input.assignedByEmployeeId)
  ) {
    return "Assigned By must be an eligible supervisor.";
  }

  return null;
}

function unchangedEmployeeIds(
  input: WeeklyScheduleFormInput,
  existingSchedule: {
    primaryEmployeeId: string | null;
    assignedByEmployeeId: string | null;
    assignments: {
      assignmentDate: Date;
      crewMembers: {
        phase: "PLANNED" | "ACTUAL";
        role: "PRIMARY_EMPLOYEE" | "PARTNER";
        employeeId: string | null;
      }[];
    }[];
  },
) {
  const unchanged = new Set<string>();
  if (input.primaryEmployeeId === existingSchedule.primaryEmployeeId && input.primaryEmployeeId) {
    unchanged.add(input.primaryEmployeeId);
  }
  if (input.assignedByEmployeeId === existingSchedule.assignedByEmployeeId && input.assignedByEmployeeId) {
    unchanged.add(input.assignedByEmployeeId);
  }

  const existingByDate = new Map(
    existingSchedule.assignments.map((assignment) => [
      assignment.assignmentDate.toISOString().slice(0, 10),
      assignment,
    ]),
  );
  const fields = [
    ["plannedPrimaryEmployeeId", "PLANNED", "PRIMARY_EMPLOYEE"],
    ["plannedPartnerEmployeeId", "PLANNED", "PARTNER"],
    ["actualPrimaryEmployeeId", "ACTUAL", "PRIMARY_EMPLOYEE"],
    ["actualPartnerEmployeeId", "ACTUAL", "PARTNER"],
  ] as const;

  for (const assignment of input.assignments) {
    const existing = existingByDate.get(assignment.assignmentDate);
    if (!existing) continue;
    for (const [field, phase, role] of fields) {
      const selectedId = assignment[field];
      const existingId = existing.crewMembers.find(
        (member) => member.phase === phase && member.role === role,
      )?.employeeId;
      if (selectedId && selectedId === existingId) unchanged.add(selectedId);
    }
  }

  return unchanged;
}

function missingEquipmentIds(
  input: WeeklyScheduleFormInput,
  equipmentById: Map<string, EquipmentSnapshotSource>,
) {
  return Array.from(
    new Set(
      input.assignments
        .flatMap((assignment) => [
          assignment.plannedEquipmentId,
          assignment.actualEquipmentId,
        ])
        .filter((id): id is string => Boolean(id))
        .filter((id) => !equipmentById.has(id)),
    ),
  );
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createWeeklyScheduleAction(
  _previousState: WeeklyScheduleFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  if (!input.data.primaryEmployeeId) return requiredEmployeeState("primaryEmployeeId");
  if (!input.data.assignedByEmployeeId) return requiredEmployeeState("assignedByEmployeeId");

  const [equipmentById, employeeById] = await Promise.all([
    equipmentMapFor(input.data),
    employeeMapFor(input.data),
  ]);
  if (missingEquipmentIds(input.data, equipmentById).length > 0) {
    return errorState("One or more selected equipment records could not be found.");
  }
  const employeeError = employeeSelectionError(input.data, employeeById);
  if (employeeError) return errorState(employeeError);

  let scheduleId: string;

  try {
    const schedule = await prisma.$transaction((tx) =>
      tx.weeklySchedule.create({
        data: buildWeeklyScheduleWriteData(input.data, equipmentById, employeeById),
      }),
    );
    scheduleId = schedule.id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return errorState("A Work Schedule already exists for this employee and week.");
    }

    return errorState("Work Schedule could not be created. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/work-schedule");
  redirect(`/work-schedule/${scheduleId}`);
}

export async function updateWeeklyScheduleAction(
  scheduleId: string,
  _previousState: WeeklyScheduleFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  const existingSchedule = await prisma.weeklySchedule.findUnique({
    where: { id: scheduleId },
    include: { assignments: { include: { crewMembers: true } } },
  });
  if (!existingSchedule) return errorState("Work Schedule could not be found.");
  if (!input.data.primaryEmployeeId && existingSchedule.primaryEmployeeId) {
    return requiredEmployeeState("primaryEmployeeId");
  }
  if (!input.data.assignedByEmployeeId && existingSchedule.assignedByEmployeeId) {
    return requiredEmployeeState("assignedByEmployeeId");
  }

  const [equipmentById, employeeById] = await Promise.all([
    equipmentMapFor(input.data),
    employeeMapFor(input.data),
  ]);
  if (missingEquipmentIds(input.data, equipmentById).length > 0) {
    return errorState("One or more selected equipment records could not be found.");
  }
  const existingEmployeeIds = unchangedEmployeeIds(input.data, existingSchedule);
  const employeeError = employeeSelectionError(
    input.data,
    employeeById,
    existingEmployeeIds,
  );
  if (employeeError) return errorState(employeeError);

  try {
    await prisma.$transaction(async (tx) => {
      const { assignments: _assignments, ...scheduleData } = buildWeeklyScheduleWriteData(
        input.data,
        equipmentById,
        employeeById,
        existingSchedule,
      );
      await tx.weeklySchedule.update({
        where: { id: scheduleId },
        data: scheduleData,
      });

      const existingAssignmentsByDate = new Map(
        existingSchedule.assignments.map((assignment) => [
          assignment.assignmentDate.toISOString().slice(0, 10),
          assignment,
        ]),
      );
      const submittedDates = input.data.assignments.map(
        (assignment) => new Date(`${assignment.assignmentDate}T00:00:00.000Z`),
      );

      for (const assignment of input.data.assignments) {
        const existingAssignment = existingAssignmentsByDate.get(assignment.assignmentDate);
        const writeData = buildDailyAssignmentWriteData(
          assignment,
          {
            employeeId: scheduleData.primaryEmployeeId,
            displayName: scheduleData.primaryEmployeeDisplayName,
          },
          equipmentById,
          employeeById,
          existingAssignment as ExistingAssignmentSnapshot | undefined,
        );
        const { crewMembers, ...assignmentData } = writeData;
        const assignmentDate = new Date(`${assignment.assignmentDate}T00:00:00.000Z`);

        await tx.dailyAssignment.upsert({
          where: {
            weeklyScheduleId_assignmentDate: {
              weeklyScheduleId: scheduleId,
              assignmentDate,
            },
          },
          create: {
            ...assignmentData,
            weeklyScheduleId: scheduleId,
            crewMembers,
          },
          update: {
            ...assignmentData,
            crewMembers: {
              deleteMany: {},
              create: crewMembers.create,
            },
          },
        });
      }

      await tx.dailyAssignment.deleteMany({
        where: {
          weeklyScheduleId: scheduleId,
          assignmentDate: { notIn: submittedDates },
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return errorState("A Work Schedule already exists for this employee and week.");
    }

    return errorState("Work Schedule could not be updated. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/work-schedule");
  revalidatePath(`/work-schedule/${scheduleId}`);
  redirect(`/work-schedule/${scheduleId}`);
}
