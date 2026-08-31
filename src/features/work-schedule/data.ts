import type { AssignmentCrewPhase, AssignmentCrewRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  dailyAssignmentStatusOptions,
  optionLabel,
  shiftOptions,
  weeklyScheduleStatusOptions,
} from "./constants";
import {
  buildDateRange,
  buildWeekDates,
  dateInputValue,
  endOfOperationalWeek,
  nextMonday,
  normalizePrimaryEmployeeKey,
  parseDateOnly,
} from "./validation";
import type {
  WorkScheduleDayViewContext,
  WorkScheduleDayViewCrewParticipant,
  WorkScheduleAssignmentInitialValues,
  WorkScheduleFormInitialValues,
  ScheduleRangeFormInitialValues,
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
      primaryEmployee: true,
      assignedByEmployee: true,
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
  return prisma.weeklySchedule.findFirst({
    where: {
      weekStartDate: parseDateOnly(weekStartDate),
      primaryEmployeeKey: normalizePrimaryEmployeeKey(primaryEmployeeDisplayName),
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

export async function getAssignmentsForDateRange(
  primaryEmployeeId: string,
  startDate: string,
  endDate: string,
) {
  return prisma.dailyAssignment.findMany({
    where: {
      assignmentDate: {
        gte: parseDateOnly(startDate),
        lte: parseDateOnly(endDate),
      },
      weeklySchedule: { primaryEmployeeId },
    },
    include: {
      plannedEquipment: true,
      actualEquipment: true,
      crewMembers: true,
    },
    orderBy: { assignmentDate: "asc" },
  });
}

type WorkScheduleContextAssignment = Awaited<
  ReturnType<typeof getDailyAssignmentsForDate>
>[number];

function textOrUndefined(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : undefined;
}

function equipmentDisplay(assignment: WorkScheduleContextAssignment, phase: "planned" | "actual") {
  const displayName =
    phase === "planned"
      ? assignment.plannedEquipmentDisplayName
      : assignment.actualEquipmentDisplayName;
  const equipmentNumber =
    phase === "planned"
      ? assignment.plannedEquipmentNumber
      : assignment.actualEquipmentNumber;
  const mineName =
    phase === "planned" ? assignment.plannedMineName : assignment.actualMineName;
  const cityName =
    phase === "planned" ? assignment.plannedCityName : assignment.actualCityName;
  const cityState =
    phase === "planned" ? assignment.plannedCityState : assignment.actualCityState;

  if (!displayName) {
    return "Not selected";
  }

  const identity = `${displayName}${equipmentNumber ? ` #${equipmentNumber}` : ""}`;
  const location = [mineName, [cityName, cityState].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" - ");

  return location ? `${identity} (${location})` : identity;
}

function crewMember(
  assignment: WorkScheduleContextAssignment,
  phase: "PLANNED" | "ACTUAL",
  role: "PRIMARY_EMPLOYEE" | "PARTNER",
) {
  return assignment.crewMembers.find(
    (member) => member.phase === phase && member.role === role,
  );
}

function crewParticipant(
  assignment: WorkScheduleContextAssignment,
  phase: "PLANNED" | "ACTUAL",
  role: "PRIMARY_EMPLOYEE" | "PARTNER",
): WorkScheduleDayViewCrewParticipant {
  const member = crewMember(assignment, phase, role);

  if (!member) {
    return {
      label: "Not recorded",
      state: "not_recorded",
    };
  }

  if (member.isUnknown) {
    return {
      label: role === "PARTNER" ? "Unknown partner" : "Unknown",
      state: "unknown",
    };
  }

  return {
    label: member.displayName ?? "Not recorded",
    state: member.displayName ? "known" : "not_recorded",
  };
}

function participantChanged(
  planned: WorkScheduleDayViewCrewParticipant,
  actual: WorkScheduleDayViewCrewParticipant,
) {
  if (actual.state === "not_recorded") {
    return false;
  }

  return planned.state !== actual.state || planned.label !== actual.label;
}

function actualRecorded(assignment: WorkScheduleContextAssignment) {
  return (
    assignment.actualStatus !== "UNKNOWN" ||
    assignment.actualShift !== "UNKNOWN" ||
    Boolean(assignment.actualEquipmentId) ||
    crewMember(assignment, "ACTUAL", "PRIMARY_EMPLOYEE") !== undefined ||
    crewMember(assignment, "ACTUAL", "PARTNER") !== undefined ||
    Boolean(assignment.actualNotes)
  );
}

function assignmentChanged(
  assignment: WorkScheduleContextAssignment,
  actualPartner: WorkScheduleDayViewCrewParticipant,
  plannedPartner: WorkScheduleDayViewCrewParticipant,
) {
  if (!actualRecorded(assignment)) {
    return false;
  }

  return (
    assignment.actualStatus !== assignment.plannedStatus ||
    assignment.actualShift !== assignment.plannedShift ||
    (assignment.actualEquipmentId ?? "") !== (assignment.plannedEquipmentId ?? "") ||
    participantChanged(plannedPartner, actualPartner)
  );
}

function outcomeFor(
  assignment: WorkScheduleContextAssignment,
  changed: boolean,
): WorkScheduleDayViewContext["outcome"] {
  if (assignment.actualStatus === "CANCELLED" || assignment.plannedStatus === "CANCELLED") {
    return "Cancelled";
  }

  if (
    assignment.actualStatus === "NON_WORKING" ||
    (assignment.actualStatus === "UNKNOWN" && assignment.plannedStatus === "NON_WORKING")
  ) {
    return "Non-Working";
  }

  if (!actualRecorded(assignment)) {
    return assignment.plannedStatus === "UNKNOWN" ? "Unknown" : "Actual Not Recorded";
  }

  if (changed) {
    return "Changed";
  }

  return assignment.plannedStatus === "SCHEDULED" ? "Matches Plan" : "Scheduled";
}

export function workScheduleContextFromAssignment(
  assignment: WorkScheduleContextAssignment,
): WorkScheduleDayViewContext {
  const plannedPartner = crewParticipant(assignment, "PLANNED", "PARTNER");
  const actualPartner = crewParticipant(assignment, "ACTUAL", "PARTNER");
  const hasActual = actualRecorded(assignment);
  const changed = assignmentChanged(assignment, actualPartner, plannedPartner);
  const explanation =
    textOrUndefined(assignment.changeReason) ?? textOrUndefined(assignment.actualNotes);

  return {
    actual: {
      equipment: hasActual ? equipmentDisplay(assignment, "actual") : "Not recorded",
      notes: textOrUndefined(assignment.actualNotes),
      partner: actualPartner,
      recorded: hasActual,
      shift: hasActual ? displayShift(assignment.actualShift) : "Not recorded",
      status: hasActual
        ? optionLabel(dailyAssignmentStatusOptions, assignment.actualStatus)
        : "Not recorded",
    },
    assignedByDisplayName: assignment.weeklySchedule.assignedByDisplayName,
    assignmentDate: dateInputValue(assignment.assignmentDate),
    assignmentStatus: optionLabel(dailyAssignmentStatusOptions, assignment.plannedStatus),
    changed,
    detailHref: `/work-schedule/${assignment.weeklyScheduleId}`,
    explanation,
    outcome: outcomeFor(assignment, changed),
    planned: {
      equipment: equipmentDisplay(assignment, "planned"),
      notes: textOrUndefined(assignment.plannedNotes),
      partner: plannedPartner,
      shift: displayShift(assignment.plannedShift),
      status: optionLabel(dailyAssignmentStatusOptions, assignment.plannedStatus),
    },
    primaryEmployeeDisplayName: assignment.weeklySchedule.primaryEmployeeDisplayName,
    scheduleId: assignment.weeklyScheduleId,
    weeklyStatus: optionLabel(weeklyScheduleStatusOptions, assignment.weeklySchedule.status),
  };
}

export function workScheduleContextsFromAssignments(
  assignments: WorkScheduleContextAssignment[],
) {
  return assignments.map(workScheduleContextFromAssignment);
}

export async function getWorkScheduleContextsForDate(date: string) {
  const assignments = await getDailyAssignmentsForDate(date);
  return workScheduleContextsFromAssignments(assignments);
}

export async function getWorkScheduleFormOptions(
  existingEmployeeIds: string[] = [],
  existingAssignedByEmployeeId?: string,
) {
  const [equipment, employees] = await Promise.all([
    prisma.equipment.findMany({
      include: { mine: { include: { city: true } } },
      orderBy: [{ mine: { name: "asc" } }, { displayName: "asc" }],
    }),
    prisma.employee.findMany({
      where: {
        OR: [
          { isActive: true },
          ...(existingEmployeeIds.length > 0 ? [{ id: { in: existingEmployeeIds } }] : []),
        ],
      },
      orderBy: [{ displayName: "asc" }, { employeeCode: "asc" }],
    }),
  ]);

  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    label: `${employee.displayName}${employee.employeeCode ? ` (${employee.employeeCode})` : ""}${employee.isActive ? "" : " — Inactive"}`,
    employeeCode: employee.employeeCode ?? undefined,
    isActive: employee.isActive,
    isSupervisor: employee.isSupervisor,
  }));

  return {
    equipmentOptions: equipment.map((item) => ({
      id: item.id,
      label: `${item.displayName}${item.equipmentNumber ? ` #${item.equipmentNumber}` : ""} (${item.mine.name})`,
    })),
    employeeOptions,
    supervisorOptions: employeeOptions.filter(
      (employee) =>
        employee.isSupervisor || employee.id === existingAssignedByEmployeeId,
    ),
    defaultPrimaryEmployeeId:
      employees.find((employee) => employee.employeeCode === "911601" && employee.isActive)?.id ?? "",
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

type EditableAssignmentRecord = Awaited<
  ReturnType<typeof getAssignmentsForDateRange>
>[number];

export function workScheduleAssignmentInitialValuesFromRecord(
  assignment: EditableAssignmentRecord,
): WorkScheduleAssignmentInitialValues {
  const values: WorkScheduleAssignmentInitialValues = {
    assignmentDate: dateInputValue(assignment.assignmentDate),
    dayOfWeek: assignment.dayOfWeek,
    plannedStatus: assignment.plannedStatus,
    plannedShift: assignment.plannedShift,
    plannedEquipmentId: assignment.plannedEquipmentId ?? "",
    actualStatus: assignment.actualStatus,
    actualShift: assignment.actualShift,
    actualEquipmentId: assignment.actualEquipmentId ?? "",
    plannedPrimaryEmployeeId:
      assignment.crewMembers.find(
        (member) => member.phase === "PLANNED" && member.role === "PRIMARY_EMPLOYEE",
      )?.employeeId ?? "",
    plannedPrimaryDisplayName:
      crewDisplayName(assignment.crewMembers, "PLANNED", "PRIMARY_EMPLOYEE") ?? "",
    plannedPartnerEmployeeId:
      assignment.crewMembers.find(
        (member) => member.phase === "PLANNED" && member.role === "PARTNER",
      )?.employeeId ?? "",
    plannedPartnerDisplayName:
      crewDisplayName(assignment.crewMembers, "PLANNED", "PARTNER") ?? "",
    plannedPartnerUnknown: crewUnknown(assignment.crewMembers, "PLANNED", "PARTNER"),
    actualPrimaryEmployeeId:
      assignment.crewMembers.find(
        (member) => member.phase === "ACTUAL" && member.role === "PRIMARY_EMPLOYEE",
      )?.employeeId ?? "",
    actualPrimaryDisplayName:
      crewDisplayName(assignment.crewMembers, "ACTUAL", "PRIMARY_EMPLOYEE") ?? "",
    actualPartnerEmployeeId:
      assignment.crewMembers.find(
        (member) => member.phase === "ACTUAL" && member.role === "PARTNER",
      )?.employeeId ?? "",
    actualPartnerDisplayName:
      crewDisplayName(assignment.crewMembers, "ACTUAL", "PARTNER") ?? "",
    actualPartnerUnknown: crewUnknown(assignment.crewMembers, "ACTUAL", "PARTNER"),
    changeReason: assignment.changeReason ?? "",
    plannedNotes: assignment.plannedNotes ?? "",
    actualNotes: assignment.actualNotes ?? "",
  };

  if (values.plannedStatus !== "NON_WORKING") return values;

  return {
    ...values,
    plannedShift: "UNKNOWN",
    plannedEquipmentId: "",
    plannedPrimaryEmployeeId: "",
    plannedPrimaryDisplayName: "",
    plannedPartnerEmployeeId: "",
    plannedPartnerDisplayName: "",
    plannedPartnerUnknown: false,
    actualStatus: "NON_WORKING",
    actualShift: "UNKNOWN",
    actualEquipmentId: "",
    actualPrimaryEmployeeId: "",
    actualPrimaryDisplayName: "",
    actualPartnerEmployeeId: "",
    actualPartnerDisplayName: "",
    actualPartnerUnknown: false,
    changeReason: "",
    plannedNotes: "",
    actualNotes: "",
  };
}

export function defaultWorkScheduleInitialValues(
  weekStartDate = dateInputValue(nextMonday()),
  primaryEmployeeId = "",
): WorkScheduleFormInitialValues {
  return {
    isNew: true,
    weekStartDate,
    status: "DRAFT",
    primaryEmployeeId,
    primaryEmployeeDisplayName: "Alain Alemany Arana",
    assignedByEmployeeId: "",
    assignedByDisplayName: "",
    receivedAt: "",
    sourceNote: "",
    scheduleNotes: "",
    assignments: buildWeekDates(parseDateOnly(weekStartDate)).map((day) => ({
      ...day,
      plannedStatus: "SCHEDULED",
      plannedShift: "UNKNOWN",
      plannedEquipmentId: "",
      actualStatus: "SCHEDULED",
      actualShift: "UNKNOWN",
      actualEquipmentId: "",
      plannedPrimaryEmployeeId: primaryEmployeeId,
      plannedPrimaryDisplayName: "",
      plannedPartnerEmployeeId: "",
      plannedPartnerDisplayName: "",
      plannedPartnerUnknown: false,
      actualPrimaryEmployeeId: primaryEmployeeId,
      actualPrimaryDisplayName: "",
      actualPartnerEmployeeId: "",
      actualPartnerDisplayName: "",
      actualPartnerUnknown: false,
      changeReason: "",
      plannedNotes: "",
      actualNotes: "",
    })),
  };
}

export function defaultScheduleRangeInitialValues(
  startDate = dateInputValue(nextMonday()),
  endDate = dateInputValue(endOfOperationalWeek(parseDateOnly(startDate))),
  primaryEmployeeId = "",
): ScheduleRangeFormInitialValues {
  const weekly = defaultWorkScheduleInitialValues(startDate, primaryEmployeeId);
  return {
    ...weekly,
    startDate,
    endDate,
    assignments: buildDateRange(parseDateOnly(startDate), parseDateOnly(endDate)).map((day) => ({
      ...weekly.assignments[0],
      ...day,
      plannedPrimaryEmployeeId: primaryEmployeeId,
      actualStatus: "UNKNOWN",
      actualShift: "UNKNOWN",
      actualEquipmentId: "",
      actualPrimaryEmployeeId: "",
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
    isNew: false,
    weekStartDate,
    status: schedule.status,
    primaryEmployeeId: schedule.primaryEmployeeId ?? "",
    primaryEmployeeDisplayName: schedule.primaryEmployeeDisplayName,
    assignedByEmployeeId: schedule.assignedByEmployeeId ?? "",
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

      return workScheduleAssignmentInitialValuesFromRecord(assignment);
    }),
  };
}

export async function scheduleRangeInitialValuesFromRecord(
  schedule: NonNullable<Awaited<ReturnType<typeof getWeeklySchedule>>>,
  selectedRange?: { startDate: string; endDate: string },
): Promise<ScheduleRangeFormInitialValues> {
  const weekly = workScheduleInitialValuesFromRecord(schedule);
  const startDate = selectedRange?.startDate ??
    (schedule.assignments[0]
      ? dateInputValue(schedule.assignments[0].assignmentDate)
      : weekly.weekStartDate);
  const endDate = selectedRange?.endDate ??
    (schedule.assignments.at(-1)
      ? dateInputValue(schedule.assignments.at(-1)!.assignmentDate)
      : dateInputValue(endOfOperationalWeek(schedule.weekStartDate)));
  const defaultRange = defaultScheduleRangeInitialValues(
    startDate,
    endDate,
    schedule.primaryEmployeeId ?? "",
  );
  const persistedAssignments = schedule.primaryEmployeeId
    ? await getAssignmentsForDateRange(schedule.primaryEmployeeId, startDate, endDate)
    : schedule.assignments;
  const persistedByDate = new Map(persistedAssignments.map((assignment) => [
    dateInputValue(assignment.assignmentDate),
    workScheduleAssignmentInitialValuesFromRecord(assignment),
  ]));

  return {
    ...weekly,
    startDate,
    endDate,
    assignments: defaultRange.assignments.map((assignment) =>
      persistedByDate.get(assignment.assignmentDate) ?? assignment,
    ),
  };
}
