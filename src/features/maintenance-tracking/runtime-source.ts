import {
  calculateDraglineRuntimeInRange,
  calculateDraglineShiftTotals,
  type GroundCheckDowntimeInput,
  type SharedDowntimeBlockInput,
  type TimelineDowntimeInput,
} from "@/features/dragline-delay-reports/calculations";
import { getDraglineShiftWindow, type DraglineDelayReportShift } from "@/features/dragline-delay-reports/time";
import { addDateKeyDays, dateKeyInTimeZone, zonedDateTime } from "@/lib/zoned-date-time";

export type MaintenanceRuntimeReport = {
  id: string;
  equipmentId: string | null;
  operationalWorkDate: Date;
  shift: string;
  status: string;
  timelineEntries: TimelineDowntimeInput[];
  groundChecks: GroundCheckDowntimeInput[];
  downtimeBlocks: SharedDowntimeBlockInput[];
};

export type MaintenanceAdjustment = {
  effectiveAt: Date;
  adjustmentValue: number;
};

export type MaintenanceRuntimeResult = {
  minutes: number;
  reportIds: string[];
  firstOperationalDate?: string;
  lastOperationalDate?: string;
};

export class MaintenanceRuntimeSplitError extends Error {
  constructor(public readonly reportId: string, message: string) {
    super(message);
  }
}

function shiftWindow(report: MaintenanceRuntimeReport) {
  if (report.shift !== "DAY" && report.shift !== "NIGHT") {
    throw new Error("Maintenance runtime requires a Day or Night DDR.");
  }
  const dateKey = report.operationalWorkDate.toISOString().slice(0, 10);
  return report.shift === "DAY"
    ? { start: zonedDateTime(dateKey, 5), end: zonedDateTime(dateKey, 17), shift: report.shift as DraglineDelayReportShift, dateKey }
    : { start: zonedDateTime(dateKey, 17), end: zonedDateTime(addDateKeyDays(dateKey, 1), 5), shift: report.shift as DraglineDelayReportShift, dateKey };
}

function localMinuteOffset(value: Date, operationalDateKey: string) {
  const localDateKey = dateKeyInTimeZone(value);
  const dayDifference = Math.round(
    (new Date(`${localDateKey}T00:00:00.000Z`).getTime() - new Date(`${operationalDateKey}T00:00:00.000Z`).getTime()) / 86_400_000,
  );
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: "hour" | "minute") => Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);
  return dayDifference * 1440 + part("hour") * 60 + part("minute");
}

export function calculateEquipmentOperatingRuntime(
  equipmentId: string,
  from: Date,
  to: Date,
  reports: readonly MaintenanceRuntimeReport[],
  adjustments: readonly MaintenanceAdjustment[] = [],
): MaintenanceRuntimeResult {
  if (to < from) throw new Error("Maintenance runtime end cannot precede its start.");
  const uniqueReports = new Map(reports.map((report) => [report.id, report]));
  const contributingReports = new Map<string, string>();
  let total = 0;

  for (const report of uniqueReports.values()) {
    if (report.status !== "COMPLETED" || report.equipmentId !== equipmentId) continue;
    const window = shiftWindow(report);
    const overlapStart = new Date(Math.max(from.getTime(), window.start.getTime()));
    const overlapEnd = new Date(Math.min(to.getTime(), window.end.getTime()));
    if (overlapEnd <= overlapStart) continue;
    contributingReports.set(report.id, window.dateKey);

    const totals = calculateDraglineShiftTotals(window.shift, report.timelineEntries, report.groundChecks, report.downtimeBlocks);
    if (overlapStart <= window.start && overlapEnd >= window.end) {
      total += totals.runTimeMinutes;
      continue;
    }

    const configuredWindow = getDraglineShiftWindow(window.shift);
    const startOffset = Math.max(configuredWindow.startMinuteOffset, localMinuteOffset(overlapStart, window.dateKey));
    const endOffset = Math.min(configuredWindow.endMinuteOffset, localMinuteOffset(overlapEnd, window.dateKey));
    try {
      total += calculateDraglineRuntimeInRange(
        window.shift,
        startOffset,
        endOffset,
        report.timelineEntries,
        report.groundChecks,
        report.downtimeBlocks,
      );
    } catch (error) {
      throw new MaintenanceRuntimeSplitError(
        report.id,
        error instanceof Error ? error.message : "DDR runtime could not be split.",
      );
    }
  }

  total += adjustments
    .filter((entry) => entry.effectiveAt >= from && entry.effectiveAt < to)
    .reduce((sum, entry) => sum + Math.round(entry.adjustmentValue * 60), 0);
  if (total < 0) throw new Error("Maintenance operating time cannot be negative.");
  const dateKeys = [...contributingReports.values()].sort();
  return {
    minutes: total,
    reportIds: [...contributingReports.keys()].sort(),
    firstOperationalDate: dateKeys[0],
    lastOperationalDate: dateKeys.at(-1),
  };
}

export function calculateEquipmentOperatingMinutes(
  equipmentId: string,
  from: Date,
  to: Date,
  reports: readonly MaintenanceRuntimeReport[],
  adjustments: readonly MaintenanceAdjustment[] = [],
) {
  return calculateEquipmentOperatingRuntime(equipmentId, from, to, reports, adjustments).minutes;
}

export function maintenanceHoursFromMinutes(minutes: number) {
  return Number((minutes / 60).toFixed(2));
}
