"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  buildDailyAssignmentWriteData,
  buildWeeklyScheduleWriteData,
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
    plannedPrimaryDisplayName: formValues(formData, "plannedPrimaryDisplayName")[index],
    plannedPartnerDisplayName: formValues(formData, "plannedPartnerDisplayName")[index],
    plannedPartnerUnknown:
      formData.get(`plannedPartnerUnknown-${index}`) === "on" ? "on" : "",
    actualPrimaryDisplayName: formValues(formData, "actualPrimaryDisplayName")[index],
    actualPartnerDisplayName: formValues(formData, "actualPartnerDisplayName")[index],
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
    primaryEmployeeDisplayName: formData.get("primaryEmployeeDisplayName"),
    assignedByDisplayName: formData.get("assignedByDisplayName"),
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

  const equipmentById = await equipmentMapFor(input.data);
  if (missingEquipmentIds(input.data, equipmentById).length > 0) {
    return errorState("One or more selected equipment records could not be found.");
  }

  let scheduleId: string;

  try {
    const schedule = await prisma.$transaction((tx) =>
      tx.weeklySchedule.create({
        data: buildWeeklyScheduleWriteData(input.data, equipmentById),
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

  const equipmentById = await equipmentMapFor(input.data);
  if (missingEquipmentIds(input.data, equipmentById).length > 0) {
    return errorState("One or more selected equipment records could not be found.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existingSchedule = await tx.weeklySchedule.findUnique({
        where: { id: scheduleId },
        include: { assignments: true },
      });

      if (!existingSchedule) {
        throw new Error("Work Schedule not found.");
      }

      const { assignments: _assignments, ...scheduleData } = buildWeeklyScheduleWriteData(
        input.data,
        equipmentById,
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
          input.data.primaryEmployeeDisplayName,
          equipmentById,
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
