import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { addDateKeyDays, dateKeyInTimeZone } from "@/lib/zoned-date-time";

import { deriveMaintenanceTracker } from "./derive";
import {
  maintenanceStatusRank,
  selectFleetAttention,
  selectMaintenanceEquipmentId,
  type MaintenanceRuleDefinition,
} from "./domain";

function numberValue(value: { toString(): string } | number) {
  return Number(value.toString());
}

export async function getMaintenanceComponents() {
  return prisma.trackedMaintenanceComponent.findMany({
    include: { rules: { orderBy: [{ sortOrder: "asc" }, { priority: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getMaintenanceComponent(id: string) {
  return prisma.trackedMaintenanceComponent.findUnique({
    where: { id },
    include: { rules: { orderBy: [{ sortOrder: "asc" }, { priority: "asc" }] } },
  });
}

export async function getMaintenanceRule(id: string) {
  return prisma.maintenanceRule.findUnique({ where: { id }, include: { component: true } });
}

export async function getMaintenanceTrackerOptions() {
  const [equipment, components] = await Promise.all([
    prisma.equipment.findMany({
      where: { status: "ACTIVE", category: "DRAGLINE" },
      include: { mine: true },
      orderBy: [{ equipmentNumber: "asc" }, { displayName: "asc" }],
    }),
    prisma.trackedMaintenanceComponent.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return {
    equipment: equipment.map((item) => ({
      id: item.id,
      label: `${item.displayName}${item.equipmentNumber ? ` #${item.equipmentNumber}` : ""} · ${item.mine.name}`,
    })),
    components: components.map((item) => ({ id: item.id, label: `${item.name} · ${item.trackingUnit}` })),
  };
}

export const trackerInclude = Prisma.validator<Prisma.EquipmentMaintenanceTrackerInclude>()({
  equipment: { include: { mine: true } },
  component: { include: { rules: { orderBy: [{ sortOrder: "asc" }, { priority: "asc" }] } } },
  counterEntries: { orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }] },
  serviceEvents: { orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }] },
});

export type TrackerRecord = Prisma.EquipmentMaintenanceTrackerGetPayload<{ include: typeof trackerInclude }>;

export function maintenanceRuleDefinition(
  rule: TrackerRecord["component"]["rules"][number],
): MaintenanceRuleDefinition {
  return {
    id: rule.id,
    actionName: rule.actionName,
    counterScope: rule.counterScope,
    thresholdValue: numberValue(rule.thresholdValue),
    upperThresholdValue: rule.upperThresholdValue == null ? undefined : numberValue(rule.upperThresholdValue),
    repeatable: rule.repeatable,
    repeatIntervalValue: rule.repeatIntervalValue == null ? undefined : numberValue(rule.repeatIntervalValue),
    maximumRepeatCount: rule.maximumRepeatCount,
    warningLeadValue: rule.warningLeadValue == null ? undefined : numberValue(rule.warningLeadValue),
    startsNewLifecycle: rule.startsNewLifecycle,
    active: rule.active,
    priority: rule.priority,
    sortOrder: rule.sortOrder,
  };
}

function derivableTracker(record: TrackerRecord) {
  return {
    trackerId: record.id,
    equipmentId: record.equipmentId,
    equipmentLabel: `${record.equipment.displayName}${record.equipment.equipmentNumber ? ` #${record.equipment.equipmentNumber}` : ""}`,
    componentId: record.componentId,
    componentName: record.component.name,
    trackingUnit: record.component.trackingUnit,
    trackingStartedAt: record.trackingStartedAt,
    rules: record.component.rules.map(maintenanceRuleDefinition),
    serviceEvents: record.serviceEvents,
    adjustments: record.counterEntries.map((entry) => ({
      effectiveAt: entry.effectiveAt,
      adjustmentValue: numberValue(entry.adjustmentValue),
    })),
  };
}

async function loadRuntimeReports(records: TrackerRecord[], asOf: Date) {
  if (records.length === 0) return [];
  const equipmentIds = [...new Set(records.map((record) => record.equipmentId))];
  const earliest = records.reduce(
    (result, record) => record.trackingStartedAt < result ? record.trackingStartedAt : result,
    records[0].trackingStartedAt,
  );
  const earliestDate = addDateKeyDays(dateKeyInTimeZone(earliest), -1);
  const latestDate = addDateKeyDays(dateKeyInTimeZone(asOf), 1);
  return prisma.draglineDelayReport.findMany({
    where: {
      status: "COMPLETED",
      equipmentId: { in: equipmentIds },
      operationalWorkDate: {
        gte: new Date(`${earliestDate}T00:00:00.000Z`),
        lte: new Date(`${latestDate}T00:00:00.000Z`),
      },
    },
    select: {
      id: true,
      equipmentId: true,
      operationalWorkDate: true,
      shift: true,
      status: true,
      timelineEntries: { select: { startMinuteOffset: true, durationMinutes: true, causesDowntime: true, delayCode: true } },
      groundChecks: { select: { startMinuteOffset: true } },
      downtimeBlocks: { select: { startMinuteOffset: true, durationMinutes: true } },
    },
    orderBy: [{ operationalWorkDate: "asc" }, { shift: "asc" }, { id: "asc" }],
  });
}

async function getTrackerRecords(where: Prisma.EquipmentMaintenanceTrackerWhereInput = {}) {
  return prisma.equipmentMaintenanceTracker.findMany({
    where: { active: true, ...where },
    include: trackerInclude,
    orderBy: [
      { equipment: { equipmentNumber: "asc" } },
      { equipment: { displayName: "asc" } },
      { component: { sortOrder: "asc" } },
      { component: { name: "asc" } },
    ],
  });
}

export async function getMaintenanceTrackers(asOf = new Date()) {
  const records = await getTrackerRecords();
  const reports = await loadRuntimeReports(records, asOf);
  return records.map((record) => deriveMaintenanceTracker(derivableTracker(record), reports, asOf));
}

export async function getHomeMaintenanceSummary(input: {
  requestedEquipmentId?: string;
  scheduledEquipmentId?: string;
  asOf?: Date;
  componentLimit?: number;
  attentionLimit?: number;
}) {
  const trackers = await getMaintenanceTrackers(input.asOf);
  const equipment = [...new Map(trackers.map((tracker) => [tracker.equipmentId, {
    id: tracker.equipmentId,
    label: tracker.equipmentLabel,
  }])).values()];
  const selectedEquipmentId = selectMaintenanceEquipmentId(
    equipment.map((item) => item.id),
    input.requestedEquipmentId,
    input.scheduledEquipmentId,
  );
  const healthItems = trackers
    .filter((tracker) => tracker.equipmentId === selectedEquipmentId)
    .sort((left, right) =>
      maintenanceStatusRank[right.status] - maintenanceStatusRank[left.status] ||
      (left.nextRule?.remainingValue ?? Number.POSITIVE_INFINITY) -
        (right.nextRule?.remainingValue ?? Number.POSITIVE_INFINITY) ||
      left.componentName.localeCompare(right.componentName),
    );
  const componentLimit = input.componentLimit ?? 6;
  return {
    equipment,
    selectedEquipmentId,
    selectedEquipmentLabel: equipment.find((item) => item.id === selectedEquipmentId)?.label,
    healthItems: healthItems.slice(0, componentLimit),
    hiddenHealthItemCount: Math.max(0, healthItems.length - componentLimit),
    fleetAttention: selectFleetAttention(trackers, selectedEquipmentId, input.attentionLimit ?? 5),
  };
}

export async function getMaintenanceTracker(id: string, asOf = new Date()) {
  const tracker = await prisma.equipmentMaintenanceTracker.findUnique({
    where: { id },
    include: trackerInclude,
  });
  if (!tracker) return undefined;
  const reports = await loadRuntimeReports([tracker], asOf);
  return { tracker, summary: deriveMaintenanceTracker(derivableTracker(tracker), reports, asOf) };
}

export function displayMaintenanceDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(value);
}
