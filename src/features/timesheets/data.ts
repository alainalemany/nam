import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { dateInputValue } from "./calculations";
import type { TimesheetFormOptions, TimesheetListItem, WeeklyTimesheetInput } from "./types";

export const weeklyTimesheetInclude = {
  entries: {
    orderBy: { workDate: "asc" },
    include: {
      allocations: {
        orderBy: { sequence: "asc" },
        include: { supportPersonnel: { orderBy: { supportPersonDisplayNameSnapshot: "asc" } } },
      },
      workScheduleDailyAssignment: {
        include: { weeklySchedule: true },
      },
    },
  },
} satisfies Prisma.WeeklyTimesheetInclude;

export type WeeklyTimesheetDetail = Prisma.WeeklyTimesheetGetPayload<{
  include: typeof weeklyTimesheetInclude;
}>;

export async function getWeeklyTimesheets(): Promise<TimesheetListItem[]> {
  const records = await prisma.weeklyTimesheet.findMany({
    orderBy: [{ payrollWeekStartDate: "desc" }, { primaryEmployeeDisplayName: "asc" }],
    include: { _count: { select: { entries: true } } },
  });
  return records.map((record) => ({
    id: record.id,
    payrollWeekStartDate: record.payrollWeekStartDate,
    payrollWeekEndDate: record.payrollWeekEndDate,
    status: record.status,
    primaryEmployeeDisplayName: record.primaryEmployeeDisplayName,
    workedMinutesTotal: record.workedMinutesTotal,
    regularMinutesTotal: record.regularMinutesTotal,
    overtimeMinutesTotal: record.overtimeMinutesTotal,
    entryCount: record._count.entries,
  }));
}

export function getWeeklyTimesheetById(id: string) {
  return prisma.weeklyTimesheet.findUnique({ where: { id }, include: weeklyTimesheetInclude });
}

export function getWeeklyTimesheetByWeek(payrollWeekStartDate: Date, primaryEmployeeKey: string) {
  return prisma.weeklyTimesheet.findUnique({
    where: { payrollWeekStartDate_primaryEmployeeKey: { payrollWeekStartDate, primaryEmployeeKey } },
    include: weeklyTimesheetInclude,
  });
}

export function getDailyTimeEntryByDate(weeklyTimesheetId: string, workDate: Date) {
  return prisma.dailyTimeEntry.findUnique({
    where: { weeklyTimesheetId_workDate: { weeklyTimesheetId, workDate } },
    include: { allocations: { include: { supportPersonnel: true }, orderBy: { sequence: "asc" } } },
  });
}

export async function getWorkScheduleAssignmentOptions(primaryEmployeeKey: string) {
  const assignments = await prisma.dailyAssignment.findMany({
    where: { weeklySchedule: { primaryEmployeeKey } },
    orderBy: { assignmentDate: "desc" },
    include: { weeklySchedule: true },
  });
  return assignments.map((item) => ({
    id: item.id,
    workDate: dateInputValue(item.assignmentDate),
    label: `${dateInputValue(item.assignmentDate)} - ${item.weeklySchedule.primaryEmployeeDisplayName}`,
    primaryEmployeeKey: item.weeklySchedule.primaryEmployeeKey,
  }));
}

export async function getTimesheetFormOptions(primaryEmployeeKey?: string): Promise<TimesheetFormOptions> {
  const [equipment, workCodes, workOrders, supportPersonnel, scheduleAssignments] = await Promise.all([
    prisma.equipment.findMany({ include: { mine: true }, orderBy: { displayName: "asc" } }),
    prisma.timesheetWorkCode.findMany({ orderBy: [{ active: "desc" }, { code: "asc" }] }),
    prisma.timesheetWorkOrder.findMany({ orderBy: [{ active: "desc" }, { workOrderNumber: "asc" }] }),
    prisma.timesheetSupportPerson.findMany({ orderBy: [{ active: "desc" }, { displayName: "asc" }] }),
    primaryEmployeeKey ? getWorkScheduleAssignmentOptions(primaryEmployeeKey) : Promise.resolve([]),
  ]);
  return {
    equipment: equipment.map((item) => ({
      id: item.id,
      label: `${item.displayName}${item.equipmentNumber ? ` (#${item.equipmentNumber})` : ""} - ${item.mine.name}`,
      active: item.status === "ACTIVE",
    })),
    workCodes: workCodes.map((item) => ({ id: item.id, label: `${item.code} - ${item.description}`, active: item.active })),
    workOrders: workOrders.map((item) => ({ id: item.id, label: `${item.workOrderNumber} - ${item.description}`, active: item.active })),
    supportPersonnel: supportPersonnel.map((item) => ({ id: item.id, label: `${item.displayName} - ${item.tradeOrRole}`, active: item.active })),
    scheduleAssignments,
  };
}

export function timesheetToFormInput(timesheet: WeeklyTimesheetDetail): WeeklyTimesheetInput {
  return {
    payrollWeekStartDate: dateInputValue(timesheet.payrollWeekStartDate),
    primaryEmployeeDisplayName: timesheet.primaryEmployeeDisplayName,
    entries: timesheet.entries.map((entry) => ({
      workDate: dateInputValue(entry.workDate),
      clockIn: entry.clockIn,
      clockOut: entry.clockOut,
      unpaidBreakMinutes: entry.unpaidBreakMinutes,
      primaryEquipmentId: entry.primaryEquipmentId ?? "",
      workScheduleDailyAssignmentId: entry.workScheduleDailyAssignmentId ?? "",
      notes: entry.notes ?? "",
      allocations: entry.allocations.map((allocation) => ({
        sequence: allocation.sequence,
        workCodeId: allocation.workCodeId,
        workOrderId: allocation.workOrderId ?? "",
        allocatedMinutes: allocation.allocatedMinutes,
        supportPersonIds: allocation.supportPersonnel.map((person) => person.supportPersonId),
        notes: allocation.notes ?? "",
      })),
    })),
  };
}

export function getTimesheetWorkCodes() {
  return prisma.timesheetWorkCode.findMany({
    include: { equipment: true, _count: { select: { allocations: true } } },
    orderBy: [{ active: "desc" }, { code: "asc" }],
  });
}

export function getTimesheetWorkOrders() {
  return prisma.timesheetWorkOrder.findMany({
    include: { equipment: true, _count: { select: { allocations: true } } },
    orderBy: [{ active: "desc" }, { workOrderNumber: "asc" }],
  });
}

export function getTimesheetSupportPersonnel() {
  return prisma.timesheetSupportPerson.findMany({
    include: { _count: { select: { allocationLinks: true } } },
    orderBy: [{ active: "desc" }, { displayName: "asc" }],
  });
}

export async function getTimesheetReferenceEquipment() {
  const equipment = await prisma.equipment.findMany({
    include: { mine: true },
    orderBy: { displayName: "asc" },
  });
  return equipment.map((item) => ({
    id: item.id,
    label: `${item.displayName}${item.equipmentNumber ? ` (#${item.equipmentNumber})` : ""} - ${item.mine.name}`,
    active: item.status === "ACTIVE",
  }));
}
