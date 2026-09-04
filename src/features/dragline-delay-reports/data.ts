import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { calculateDraglineShiftTotals } from "./calculations";
import { getDraglineDelayCode } from "./catalog";
import { formatStationNotation } from "./station";
import { orderDraglineDelayReportTimelineItems } from "./timeline-order";
import {
  splitEventStartMinute,
  type DraglineDelayReportShift,
} from "./time";
import type {
  DraglineDelayReportFormInitialValues,
  DraglineEmployeeOption,
  DraglineEquipmentOption,
  DraglineLakeOption,
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
  downtimeBlocks: {
    orderBy: [
      { startMinuteOffset: "asc" as const },
      { sequence: "asc" as const },
      { id: "asc" as const },
    ],
    include: {
      activities: {
        orderBy: [{ sequence: "asc" as const }, { id: "asc" as const }],
      },
    },
  },
  groundChecks: {
    orderBy: [
      { startMinuteOffset: "asc" as const },
      { sequence: "asc" as const },
      { id: "asc" as const },
    ],
  },
  corrections: { orderBy: [{ sequence: "asc" as const }, { id: "asc" as const }] },
} satisfies Prisma.DraglineDelayReportInclude;

const totalsInclude = {
  timelineEntries: {
    select: {
      startMinuteOffset: true,
      durationMinutes: true,
      causesDowntime: true,
      delayCode: true,
    },
  },
  groundChecks: { select: { startMinuteOffset: true } },
  downtimeBlocks: {
    select: { startMinuteOffset: true, durationMinutes: true },
  },
} satisfies Prisma.DraglineDelayReportInclude;

function calculatePersistedTotals(report: {
  shift: string;
  timelineEntries: Array<{
    startMinuteOffset: number;
    durationMinutes: number | null;
    causesDowntime: boolean;
    delayCode: string;
  }>;
  groundChecks: Array<{ startMinuteOffset: number }>;
  downtimeBlocks?: Array<{
    startMinuteOffset: number;
    durationMinutes: number;
  }>;
}) {
  if (report.shift !== "DAY" && report.shift !== "NIGHT") {
    throw new Error("Dragline Delay Report shift must be Day or Night.");
  }

  return calculateDraglineShiftTotals(
    report.shift as DraglineDelayReportShift,
    report.timelineEntries,
    report.groundChecks,
    report.downtimeBlocks ?? [],
  );
}

export async function getDraglineDelayReports() {
  const reports = await prisma.draglineDelayReport.findMany({
    orderBy: [
      { operationalWorkDate: "desc" },
      { shift: "asc" },
      { updatedAt: "desc" },
      { id: "desc" },
    ],
    include: totalsInclude,
    take: 250,
  });

  return reports.map(({ timelineEntries, groundChecks, downtimeBlocks, ...report }) => ({
    ...report,
    ...calculatePersistedTotals({
      ...report,
      timelineEntries,
      groundChecks,
      downtimeBlocks,
    }),
  }));
}

export async function getDraglineDelayReportById(id: string) {
  const report = await prisma.draglineDelayReport.findUnique({
    where: { id },
    include: detailInclude,
  });

  return report
    ? { ...report, ...calculatePersistedTotals(report) }
    : null;
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
      mineId: item.mineId,
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

export async function getDraglineLakeOptions(selectedLakeId?: string | null) {
  const lakes = await prisma.lake.findMany({
    where: {
      OR: [
        { status: "ACTIVE" },
        ...(selectedLakeId ? [{ id: selectedLakeId }] : []),
      ],
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return lakes.map(
    (lake): DraglineLakeOption => ({
      id: lake.id,
      mineId: lake.mineId,
      name: lake.name,
      status: lake.status,
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
  const [equipment, employees, lakes] = await Promise.all([
    getDraglineEquipmentOptions(report?.equipmentId),
    getDraglineEmployeeOptions(selectedEmployeeIds),
    getDraglineLakeOptions(report?.lakeId),
  ]);

  return {
    report,
    equipment,
    employees,
    lakes,
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
  const combinedTimelineOrder = orderDraglineDelayReportTimelineItems(
    report.timelineEntries,
    report.downtimeBlocks,
  );
  const combinedSequenceById = new Map(
    combinedTimelineOrder.map((item, index) => [item.value.id, index + 1]),
  );

  return {
    operationalWorkDate: report.operationalWorkDate.toISOString().slice(0, 10),
    shift: report.shift as "DAY" | "NIGHT",
    equipmentId: report.equipmentId ?? "",
    startingHourMeter: String(report.startingHourMeter),
    endingHourMeter:
      report.endingHourMeter == null ? "" : String(report.endingHourMeter),
    supervisorId: report.supervisorId ?? "",
    lakeId: report.lakeId ?? "",
    normalDiggingBuckets:
      report.normalDiggingBuckets == null
        ? ""
        : String(report.normalDiggingBuckets),
    benchfillBuckets:
      report.benchfillBuckets == null ? "" : String(report.benchfillBuckets),
    stationStart:
      report.stationStartFeet == null
        ? ""
        : formatStationNotation(report.stationStartFeet),
    stationEnd:
      report.stationEndFeet == null
        ? ""
        : formatStationNotation(report.stationEndFeet),
    depthFeet: report.depthFeet == null ? "" : String(report.depthFeet),
    fuelGallons:
      report.fuelGallons == null ? "" : String(report.fuelGallons),
    cableDragFeet:
      report.cableDragFeet == null ? "" : String(report.cableDragFeet),
    hoistFeet: report.hoistFeet == null ? "" : String(report.hoistFeet),
    comments: report.comments ?? "",
    safetyItemsFound: report.safetyItemsFound ?? "",
    actionTaken: report.actionTaken ?? "",
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
        sequence: combinedSequenceById.get(entry.id),
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
    downtimeBlocks: report.downtimeBlocks.map((block) => {
      const { clockTime, dayOffset } = splitEventStartMinute(
        block.startMinuteOffset,
      );
      return {
        clientId: block.id,
        id: block.id,
        sequence: combinedSequenceById.get(block.id),
        startTime: clockTime,
        dayOffset,
        durationMinutes: String(block.durationMinutes),
        description: block.description ?? "",
        activities: block.activities.map((activity) => ({
          clientId: activity.id,
          id: activity.id,
          delayCode: activity.delayCode,
          description: activity.description ?? "",
          category: getDraglineDelayCode(activity.delayCode)?.category,
        })),
      };
    }),
    groundChecks: report.groundChecks.map((groundCheck) => {
      const { clockTime, dayOffset } = splitEventStartMinute(
        groundCheck.startMinuteOffset,
      );
      return {
        clientId: groundCheck.id,
        id: groundCheck.id,
        startTime: clockTime,
        dayOffset,
      };
    }),
  };
}
