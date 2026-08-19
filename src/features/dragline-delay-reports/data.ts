import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { getDraglineDelayCode } from "./catalog";
import { splitEventStartMinute } from "./time";
import type {
  DraglineDelayReportFormInitialValues,
  DraglineEmployeeOption,
  DraglineEquipmentOption,
} from "./types";

const detailInclude = {
  operators: { orderBy: [{ sequence: "asc" as const }, { id: "asc" as const }] },
  timelineEntries: {
    orderBy: [
      { startMinuteOffset: "asc" as const },
      { sequence: "asc" as const },
      { id: "asc" as const },
    ],
  },
} satisfies Prisma.DraglineDelayReportInclude;

export async function getDraglineDelayReports() {
  return prisma.draglineDelayReport.findMany({
    orderBy: [
      { operationalWorkDate: "desc" },
      { shift: "asc" },
      { updatedAt: "desc" },
      { id: "desc" },
    ],
    take: 250,
  });
}

export async function getDraglineDelayReportById(id: string) {
  return prisma.draglineDelayReport.findUnique({
    where: { id },
    include: detailInclude,
  });
}

export async function getDraglineEquipmentOptions(selectedEquipmentId?: string | null) {
  const equipment = await prisma.equipment.findMany({
    where: {
      category: "DRAGLINE",
      OR: [
        { status: "ACTIVE" },
        ...(selectedEquipmentId ? [{ id: selectedEquipmentId }] : []),
      ],
    },
    include: { mine: { include: { city: true } } },
    orderBy: [{ displayName: "asc" }, { equipmentNumber: "asc" }],
  });

  return equipment.map(
    (item): DraglineEquipmentOption => ({
      id: item.id,
      label: `${item.displayName}${item.equipmentNumber ? ` #${item.equipmentNumber}` : ""} · ${item.mine.name}`,
      displayName: item.displayName,
      equipmentNumber: item.equipmentNumber,
      status: item.status,
      mineName: item.mine.name,
      cityName: item.mine.city.name,
      cityState: item.mine.city.state,
    }),
  );
}

export async function getDraglineEmployeeOptions(selectedEmployeeIds: string[] = []) {
  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { isActive: true },
        ...(selectedEmployeeIds.length ? [{ id: { in: selectedEmployeeIds } }] : []),
      ],
    },
    orderBy: [{ displayName: "asc" }, { employeeCode: "asc" }],
  });

  return employees.map(
    (employee): DraglineEmployeeOption => ({
      id: employee.id,
      label: `${employee.displayName}${employee.employeeCode ? ` (${employee.employeeCode})` : ""}${employee.isActive ? "" : " · inactive"}`,
      displayName: employee.displayName,
      employeeCode: employee.employeeCode,
      isActive: employee.isActive,
      isSupervisor: employee.isSupervisor,
    }),
  );
}

export async function getDraglineDelayReportFormOptions(reportId?: string) {
  const report = reportId ? await getDraglineDelayReportById(reportId) : null;
  const selectedEmployeeIds = report
    ? [
        ...report.operators.flatMap((operator) =>
          operator.employeeId ? [operator.employeeId] : [],
        ),
        ...(report.supervisorId ? [report.supervisorId] : []),
      ]
    : [];
  const [equipment, employees] = await Promise.all([
    getDraglineEquipmentOptions(report?.equipmentId),
    getDraglineEmployeeOptions(selectedEmployeeIds),
  ]);

  return {
    report,
    equipment,
    employees,
    supervisors: employees.filter(
      (employee) =>
        employee.isSupervisor || employee.id === report?.supervisorId,
    ),
  };
}

type ReportDetail = NonNullable<Awaited<ReturnType<typeof getDraglineDelayReportById>>>;

export function draglineDelayReportToFormInitial(
  report: ReportDetail,
): DraglineDelayReportFormInitialValues {
  return {
    operationalWorkDate: report.operationalWorkDate.toISOString().slice(0, 10),
    shift: report.shift as "DAY" | "NIGHT",
    equipmentId: report.equipmentId ?? "",
    startingHourMeter: String(report.startingHourMeter),
    endingHourMeter:
      report.endingHourMeter == null ? "" : String(report.endingHourMeter),
    supervisorId: report.supervisorId ?? "",
    recordVersion: report.recordVersion,
    operators: report.operators.map((operator) => ({
      clientId: operator.id,
      id: operator.id,
      employeeId: operator.employeeId ?? "",
    })),
    timelineEntries: report.timelineEntries.map((entry) => {
      const { clockTime, dayOffset } = splitEventStartMinute(entry.startMinuteOffset);
      return {
        clientId: entry.id,
        id: entry.id,
        startTime: clockTime,
        dayOffset,
        delayCode: entry.delayCode,
        description: entry.description ?? "",
        durationMinutes:
          entry.durationMinutes == null ? "" : String(entry.durationMinutes),
        causesDowntime: entry.causesDowntime,
        category: getDraglineDelayCode(entry.delayCode)?.category,
      };
    }),
  };
}
