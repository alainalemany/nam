import type { AssignmentCrewPhase, AssignmentCrewRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { optionLabel, shiftOptions } from "./constants";
import {
  buildWeekDates,
  dateInputValue,
  nextMonday,
  normalizePrimaryEmployeeKey,
  parseDateOnly,
} from "./validation";
import type {
  WorkScheduleAssignmentInitialValues,
  WorkScheduleFormInitialValues,
} from "./types";

export async function getWeeklySchedules() {
  return prisma.weeklySchedule.findMany({
    include: {
      _count: { select: { assignments: true } },
    },
    orderBy: [{ weekStartDate: "desc" }, { primaryEmployeeDisplayName: "asc" }],
  });
}

export async function getWeeklySchedule(id: string) {
  return prisma.weeklySchedule.findUnique({
    where: { id },
    include: {
      assignments: {
        include: {
          plannedEquipment: true,
          actualEquipment: true,
          crewMembers: true,
        },
        orderBy: { assignmentDate: "asc" },
      },
    },
  });
}

export async function getWeeklyScheduleForWeek(
  weekStartDate: string,
  primaryEmployeeDisplayName: string,
) {
  return prisma.weeklySchedule.findUnique({
    where: {
      weekStartDate_primaryEmployeeKey: {
        weekStartDate: parseDateOnly(weekStartDate),
        primaryEmployeeKey: normalizePrimaryEmployeeKey(primaryEmployeeDisplayName),
      },
    },
    include: {
      assignments: {
        include: {
          plannedEquipment: true,
          actualEquipment: true,
          crewMembers: true,
        },
        orderBy: { assignmentDate: "asc" },
      },
    },
  });
}

export async function getAdjacentWeeklySchedules(
  weekStartDate: Date,
  primaryEmployeeKey: string,
) {
  const [previousSchedule, nextSchedule] = await Promise.all([
    prisma.weeklySchedule.findFirst({
      where: {
        primaryEmployeeKey,
        weekStartDate: { lt: weekStartDate },
      },
      orderBy: { weekStartDate: "desc" },
    }),
    prisma.weeklySchedule.findFirst({
      where: {
        primaryEmployeeKey,
        weekStartDate: { gt: weekStartDate },
      },
      orderBy: { weekStartDate: "asc" },
    }),
  ]);

  return { previousSchedule, nextSchedule };
}

export async function getDailyAssignmentsForDate(date: string) {
  return prisma.dailyAssignment.findMany({
    where: { assignmentDate: parseDateOnly(date) },
    include: {
      weeklySchedule: true,
      plannedEquipment: true,
      actualEquipment: true,
      crewMembers: true,
    },
    orderBy: [{ weeklySchedule: { primaryEmployeeDisplayName: "asc" } }],
  });
}

export async function getWorkScheduleFormOptions() {
  const equipment = await prisma.equipment.findMany({
    include: { mine: { include: { city: true } } },
    orderBy: [{ mine: { name: "asc" } }, { displayName: "asc" }],
  });

  return {
    equipmentOptions: equipment.map((item) => ({
      id: item.id,
      label: `${item.displayName}${item.equipmentNumber ? ` #${item.equipmentNumber}` : ""} (${item.mine.name})`,
    })),
  };
}

export function displayDateOnly(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

export function displayDateTime(value: Date | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function displayWeekRange(weekStartDate: Date, weekEndDate: Date) {
  return `${displayDateOnly(weekStartDate)} - ${displayDateOnly(weekEndDate)}`;
}

export function displayShift(value: string) {
  return optionLabel(shiftOptions, value as (typeof shiftOptions)[number]["value"]);
}

function crewDisplayName(
  crewMembers: {
    phase: AssignmentCrewPhase;
    role: AssignmentCrewRole;
    displayName: string | null;
    isUnknown: boolean;
  }[],
  phase: AssignmentCrewPhase,
  role: AssignmentCrewRole,
) {
  const member = crewMembers.find((item) => item.phase === phase && item.role === role);

  if (!member) {
    return undefined;
  }

  return member.displayName ?? undefined;
}

function crewUnknown(
  crewMembers: {
    phase: AssignmentCrewPhase;
    role: AssignmentCrewRole;
    isUnknown: boolean;
  }[],
  phase: AssignmentCrewPhase,
  role: AssignmentCrewRole,
) {
  return crewMembers.some(
    (item) => item.phase === phase && item.role === role && item.isUnknown,
  );
}

export function defaultWorkScheduleInitialValues(
  weekStartDate = dateInputValue(nextMonday()),
): WorkScheduleFormInitialValues {
  return {
    weekStartDate,
    status: "ACTIVE",
    primaryEmployeeDisplayName: "",
    assignedByDisplayName: "",
    receivedAt: "",
    sourceNote: "",
    scheduleNotes: "",
    assignments: buildWeekDates(parseDateOnly(weekStartDate)).map((day) => ({
      ...day,
      plannedStatus: "UNKNOWN",
      plannedShift: "UNKNOWN",
      plannedEquipmentId: "",
      actualStatus: "UNKNOWN",
      actualShift: "UNKNOWN",
      actualEquipmentId: "",
      plannedPrimaryDisplayName: "",
      plannedPartnerDisplayName: "",
      plannedPartnerUnknown: false,
      actualPrimaryDisplayName: "",
      actualPartnerDisplayName: "",
      actualPartnerUnknown: false,
      changeReason: "",
      plannedNotes: "",
      actualNotes: "",
    })),
  };
}

export function workScheduleInitialValuesFromRecord(
  schedule: NonNullable<Awaited<ReturnType<typeof getWeeklySchedule>>>,
): WorkScheduleFormInitialValues {
  const assignmentsByDate = new Map(
    schedule.assignments.map((assignment) => [
      dateInputValue(assignment.assignmentDate),
      assignment,
    ]),
  );

  const weekStartDate = dateInputValue(schedule.weekStartDate);
  const defaultValues = defaultWorkScheduleInitialValues(weekStartDate);

  return {
    weekStartDate,
    status: schedule.status,
    primaryEmployeeDisplayName: schedule.primaryEmployeeDisplayName,
    assignedByDisplayName: schedule.assignedByDisplayName,
    receivedAt: schedule.receivedAt
      ? new Date(schedule.receivedAt.getTime() - schedule.receivedAt.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "",
    sourceNote: schedule.sourceNote ?? "",
    scheduleNotes: schedule.scheduleNotes ?? "",
    assignments: defaultValues.assignments.map((defaultAssignment) => {
      const assignment = assignmentsByDate.get(defaultAssignment.assignmentDate);

      if (!assignment) {
        return defaultAssignment;
      }

      return {
        assignmentDate: defaultAssignment.assignmentDate,
        dayOfWeek: assignment.dayOfWeek,
        plannedStatus: assignment.plannedStatus,
        plannedShift: assignment.plannedShift,
        plannedEquipmentId: assignment.plannedEquipmentId ?? "",
        actualStatus: assignment.actualStatus,
        actualShift: assignment.actualShift,
        actualEquipmentId: assignment.actualEquipmentId ?? "",
        plannedPrimaryDisplayName:
          crewDisplayName(assignment.crewMembers, "PLANNED", "PRIMARY_EMPLOYEE") ?? "",
        plannedPartnerDisplayName:
          crewDisplayName(assignment.crewMembers, "PLANNED", "PARTNER") ?? "",
        plannedPartnerUnknown: crewUnknown(assignment.crewMembers, "PLANNED", "PARTNER"),
        actualPrimaryDisplayName:
          crewDisplayName(assignment.crewMembers, "ACTUAL", "PRIMARY_EMPLOYEE") ?? "",
        actualPartnerDisplayName:
          crewDisplayName(assignment.crewMembers, "ACTUAL", "PARTNER") ?? "",
        actualPartnerUnknown: crewUnknown(assignment.crewMembers, "ACTUAL", "PARTNER"),
        changeReason: assignment.changeReason ?? "",
        plannedNotes: assignment.plannedNotes ?? "",
        actualNotes: assignment.actualNotes ?? "",
      };
    }),
  };
}
