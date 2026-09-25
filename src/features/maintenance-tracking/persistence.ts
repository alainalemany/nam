import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { addDateKeyDays, dateKeyInTimeZone } from "@/lib/zoned-date-time";

import { maintenanceDateKey, maintenanceDateOnlyCalculationBoundary, maintenanceEventBoundaryAt } from "./boundaries";
import { maintenanceRuleDefinition, trackerInclude } from "./data";
import { deriveMaintenanceTracker } from "./derive";
import { snapshotMaintenanceService } from "./domain";
import { normalizeMaintenanceName, normalizeTrackingUnit } from "./normalization";

type ComponentInput = { name: string; description?: string; trackingUnit: string; active: boolean; sortOrder: number };
type RuleInput = {
  actionName: string;
  counterScope: "SERVICE_INTERVAL" | "COMPONENT_LIFECYCLE";
  thresholdValue: number;
  upperThresholdValue?: number;
  repeatable: boolean;
  repeatIntervalValue?: number;
  maximumRepeatCount?: number;
  warningLeadValue?: number;
  startsNewLifecycle: boolean;
  active: boolean;
  priority: number;
  sortOrder: number;
};

export function saveMaintenanceComponent(id: string | null, input: ComponentInput) {
  const data = {
    name: input.name.trim().replace(/\s+/g, " "),
    normalizedName: normalizeMaintenanceName(input.name),
    description: input.description,
    trackingUnit: normalizeTrackingUnit(input.trackingUnit),
    active: input.active,
    sortOrder: input.sortOrder,
  };
  return id
    ? prisma.trackedMaintenanceComponent.update({ where: { id }, data })
    : prisma.trackedMaintenanceComponent.create({ data });
}

export function saveMaintenanceRule(componentId: string, id: string | null, input: RuleInput) {
  const data = {
    componentId,
    actionName: input.actionName.trim().replace(/\s+/g, " "),
    counterScope: input.counterScope,
    thresholdValue: new Prisma.Decimal(input.thresholdValue),
    upperThresholdValue: input.upperThresholdValue == null ? null : new Prisma.Decimal(input.upperThresholdValue),
    repeatable: input.repeatable,
    repeatIntervalValue: input.repeatable && input.repeatIntervalValue != null ? new Prisma.Decimal(input.repeatIntervalValue) : null,
    maximumRepeatCount: input.repeatable ? input.maximumRepeatCount ?? null : null,
    warningLeadValue: input.warningLeadValue == null ? null : new Prisma.Decimal(input.warningLeadValue),
    startsNewLifecycle: input.startsNewLifecycle,
    active: input.active,
    priority: input.priority,
    sortOrder: input.sortOrder,
  };
  return id
    ? prisma.maintenanceRule.update({ where: { id }, data })
    : prisma.maintenanceRule.create({ data });
}

export async function createMaintenanceTracker(input: {
  equipmentId: string;
  componentId: string;
  trackingStartedAt: Date;
  installedComponentIdentity?: string;
  notes?: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const [equipment, component] = await Promise.all([
      transaction.equipment.findUnique({ where: { id: input.equipmentId } }),
      transaction.trackedMaintenanceComponent.findUnique({ where: { id: input.componentId } }),
    ]);
    if (!equipment || equipment.status !== "ACTIVE" || equipment.category !== "DRAGLINE") throw new Error("Select active Dragline Equipment.");
    if (!component || !component.active) throw new Error("Select an active tracked component.");
    if (input.trackingStartedAt > new Date()) throw new Error("Tracking start cannot be in the future.");
    return transaction.equipmentMaintenanceTracker.create({
      data: {
        equipmentId: equipment.id,
        componentId: component.id,
        trackingStartedAt: input.trackingStartedAt,
        installedComponentIdentity: input.installedComponentIdentity,
        notes: input.notes,
      },
    });
  });
}

export async function addManualMaintenanceAdjustment(
  trackerId: string,
  input: { adjustmentValue: number; effectiveAt: Date; reason: string; recordedBy?: string; recordVersion: number },
) {
  return prisma.$transaction(async (transaction) => {
    const tracker = await transaction.equipmentMaintenanceTracker.findUnique({ where: { id: trackerId } });
    if (!tracker || !tracker.active) throw new Error("Maintenance tracker not found.");
    if (tracker.recordVersion !== input.recordVersion) throw new Error("This tracker changed. Refresh before recording an adjustment.");
    if (input.effectiveAt < tracker.trackingStartedAt) throw new Error("Adjustment time cannot precede the tracker start.");
    if (input.effectiveAt > new Date()) throw new Error("Adjustment time cannot be in the future.");
    const updated = await transaction.equipmentMaintenanceTracker.updateMany({
      where: { id: tracker.id, recordVersion: input.recordVersion },
      data: { recordVersion: { increment: 1 } },
    });
    if (updated.count !== 1) throw new Error("This tracker changed. Refresh before recording an adjustment.");
    await transaction.maintenanceCounterEntry.create({
      data: {
        trackerId: tracker.id,
        adjustmentValue: new Prisma.Decimal(input.adjustmentValue),
        effectiveAt: input.effectiveAt,
        reason: input.reason,
        recordedBy: input.recordedBy,
      },
    });
  });
}

async function runtimeReports(transaction: Prisma.TransactionClient, equipmentId: string, from: Date, to: Date) {
  const earliest = addDateKeyDays(dateKeyInTimeZone(from), -1);
  const latest = addDateKeyDays(dateKeyInTimeZone(to), 1);
  return transaction.draglineDelayReport.findMany({
    where: {
      status: "COMPLETED",
      equipmentId,
      operationalWorkDate: {
        gte: new Date(`${earliest}T00:00:00.000Z`),
        lte: new Date(`${latest}T00:00:00.000Z`),
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
  });
}

export async function recordMaintenanceService(
  trackerId: string,
  input: { ruleId: string; effectiveAt: Date; notes?: string; recordedBy?: string; recordVersion: number },
) {
  return prisma.$transaction(async (transaction) => {
    const tracker = await transaction.equipmentMaintenanceTracker.findUnique({ where: { id: trackerId }, include: trackerInclude });
    if (!tracker || !tracker.active) throw new Error("Maintenance tracker not found.");
    if (tracker.recordVersion !== input.recordVersion) throw new Error("This tracker changed. Refresh before recording service.");
    if (input.effectiveAt < tracker.trackingStartedAt) throw new Error("Service time cannot precede the tracker start.");
    if (input.effectiveAt > new Date()) throw new Error("Service time cannot be in the future.");
    const latestEvent = [...tracker.serviceEvents]
      .sort((left, right) => maintenanceEventBoundaryAt(left).getTime() - maintenanceEventBoundaryAt(right).getTime())
      .at(-1);
    if (latestEvent && input.effectiveAt <= maintenanceEventBoundaryAt(latestEvent)) {
      throw new Error("Service time must be later than the most recent recorded service. Correcting existing history requires an audited correction workflow.");
    }

    const rule = tracker.component.rules.find((candidate) => candidate.id === input.ruleId);
    if (!rule || !rule.active) throw new Error("Select an active service rule for this component.");
    const reports = await runtimeReports(transaction, tracker.equipmentId, tracker.trackingStartedAt, input.effectiveAt);
    const summary = deriveMaintenanceTracker({
      trackerId: tracker.id,
      equipmentId: tracker.equipmentId,
      equipmentLabel: `${tracker.equipment.displayName}${tracker.equipment.equipmentNumber ? ` #${tracker.equipment.equipmentNumber}` : ""}`,
      componentId: tracker.componentId,
      componentName: tracker.component.name,
      trackingUnit: tracker.component.trackingUnit,
      trackingStartedAt: tracker.trackingStartedAt,
      rules: tracker.component.rules.map(maintenanceRuleDefinition),
      serviceEvents: tracker.serviceEvents,
      adjustments: tracker.counterEntries.map((entry) => ({ effectiveAt: entry.effectiveAt, adjustmentValue: Number(entry.adjustmentValue) })),
    }, reports, input.effectiveAt);
    const evaluated = summary.rules.find((candidate) => candidate.rule.id === rule.id);
    if (!evaluated) throw new Error("This service action reached its configured lifecycle maximum or is no longer available.");
    const serviceSequence = tracker.serviceEvents.filter((event) =>
      event.eventKind === "SERVICE" && maintenanceEventBoundaryAt(event) > summary.lifecycleStartedAt,
    ).length + 1;
    const snapshot = snapshotMaintenanceService(
      evaluated,
      summary.lifecycleValue,
      summary.lifecycleNumber,
      serviceSequence,
      input.effectiveAt,
    );

    const updated = await transaction.equipmentMaintenanceTracker.updateMany({
      where: { id: tracker.id, recordVersion: input.recordVersion },
      data: { recordVersion: { increment: 1 } },
    });
    if (updated.count !== 1) throw new Error("This tracker changed. Refresh before recording service.");
    await transaction.maintenanceServiceEvent.create({
      data: {
        trackerId: tracker.id,
        ruleId: rule.id,
        componentNameSnapshot: tracker.component.name,
        trackingUnitSnapshot: tracker.component.trackingUnit,
        actionNameSnapshot: snapshot.actionName,
        counterScopeSnapshot: snapshot.counterScope,
        thresholdSnapshot: new Prisma.Decimal(snapshot.thresholdValue),
        upperThresholdSnapshot: snapshot.upperThresholdValue == null ? null : new Prisma.Decimal(snapshot.upperThresholdValue),
        warningLeadSnapshot: snapshot.warningLeadValue == null ? null : new Prisma.Decimal(snapshot.warningLeadValue),
        repeatIntervalSnapshot: snapshot.repeatIntervalValue == null ? null : new Prisma.Decimal(snapshot.repeatIntervalValue),
        maximumRepeatSnapshot: snapshot.maximumRepeatCount,
        startsNewLifecycleSnapshot: snapshot.startsNewLifecycle,
        targetValueSnapshot: new Prisma.Decimal(snapshot.targetValue),
        intervalValueAtService: new Prisma.Decimal(snapshot.intervalValue),
        lifecycleValueAtService: new Prisma.Decimal(snapshot.lifecycleValue),
        varianceValueSnapshot: new Prisma.Decimal(snapshot.varianceValue),
        lifecycleNumber: snapshot.lifecycleNumber,
        serviceSequence: snapshot.serviceSequence,
        eventKind: "SERVICE",
        effectiveAt: snapshot.effectiveAt,
        effectiveDate: null,
        machineMeterSnapshot: null,
        notes: input.notes,
        recordedBy: input.recordedBy,
      },
    });
  });
}

export type HistoricalLifecycleInitializationInput = {
  equipmentId: string;
  componentId: string;
  ruleId: string;
  effectiveDate: string;
  machineMeterSnapshot: number;
  actionName: string;
  notes: string;
};

function decimalMatches(value: Prisma.Decimal | null, expected: number) {
  return value != null && Number(value) === expected;
}

export async function initializeHistoricalMaintenanceLifecycle(
  input: HistoricalLifecycleInitializationInput,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    throw new Error("Historical lifecycle date must use YYYY-MM-DD.");
  }
  const effectiveDate = new Date(`${input.effectiveDate}T00:00:00.000Z`);
  if (Number.isNaN(effectiveDate.getTime()) || maintenanceDateKey(effectiveDate) !== input.effectiveDate) {
    throw new Error("Historical lifecycle date must be a valid calendar date.");
  }
  if (input.effectiveDate > dateKeyInTimeZone(new Date())) {
    throw new Error("Historical lifecycle date cannot be in the future.");
  }
  if (!Number.isFinite(input.machineMeterSnapshot) || input.machineMeterSnapshot < 0) {
    throw new Error("Machine meter snapshot must be zero or greater.");
  }
  const actionName = input.actionName.trim().replace(/\s+/g, " ");
  const notes = input.notes.trim();
  if (!actionName) throw new Error("Historical action name is required.");
  if (!notes) throw new Error("Historical source notes are required.");

  const trackingStartedAt = maintenanceDateOnlyCalculationBoundary(effectiveDate);

  return prisma.$transaction(async (transaction) => {
    const [equipment, component, rule] = await Promise.all([
      transaction.equipment.findUnique({ where: { id: input.equipmentId } }),
      transaction.trackedMaintenanceComponent.findUnique({ where: { id: input.componentId } }),
      transaction.maintenanceRule.findUnique({ where: { id: input.ruleId } }),
    ]);
    if (!equipment || equipment.status !== "ACTIVE" || equipment.category !== "DRAGLINE") {
      throw new Error("Select active Dragline Equipment.");
    }
    if (!component || !component.active) throw new Error("Select an active tracked component.");
    if (!rule || !rule.active || rule.componentId !== component.id || !rule.startsNewLifecycle) {
      throw new Error("Select an active lifecycle-starting rule for this component.");
    }

    let tracker = await transaction.equipmentMaintenanceTracker.findUnique({
      where: { equipmentId_componentId: { equipmentId: equipment.id, componentId: component.id } },
      include: trackerInclude,
    });
    const trackerExisted = tracker != null;

    if (tracker) {
      const matchingInitialization = tracker.serviceEvents.find((event) =>
        event.eventKind === "LIFECYCLE_INITIALIZATION" &&
        event.ruleId === rule.id &&
        event.effectiveAt === null &&
        event.effectiveDate != null &&
        maintenanceDateKey(event.effectiveDate) === input.effectiveDate &&
        event.actionNameSnapshot === actionName &&
        decimalMatches(event.machineMeterSnapshot, input.machineMeterSnapshot) &&
        event.notes === notes,
      );
      if (matchingInitialization) {
        if (!tracker.active || tracker.trackingStartedAt.getTime() !== trackingStartedAt.getTime()) {
          throw new Error("The existing tracker conflicts with this historical lifecycle boundary.");
        }
        return { trackerId: tracker.id, eventId: matchingInitialization.id, created: false };
      }
      if (
        tracker.serviceEvents.length > 0 ||
        tracker.counterEntries.length > 0 ||
        !tracker.active ||
        tracker.trackingStartedAt.getTime() !== trackingStartedAt.getTime()
      ) {
        throw new Error("Conflicting maintenance tracking history already exists for this Equipment/component.");
      }
    } else {
      tracker = await transaction.equipmentMaintenanceTracker.create({
        data: {
          equipmentId: equipment.id,
          componentId: component.id,
          trackingStartedAt,
          notes,
        },
        include: trackerInclude,
      });
    }

    const event = await transaction.maintenanceServiceEvent.create({
      data: {
        trackerId: tracker.id,
        ruleId: rule.id,
        componentNameSnapshot: component.name,
        trackingUnitSnapshot: component.trackingUnit,
        actionNameSnapshot: actionName,
        counterScopeSnapshot: rule.counterScope,
        thresholdSnapshot: rule.thresholdValue,
        upperThresholdSnapshot: rule.upperThresholdValue,
        warningLeadSnapshot: rule.warningLeadValue,
        repeatIntervalSnapshot: rule.repeatIntervalValue,
        maximumRepeatSnapshot: rule.maximumRepeatCount,
        startsNewLifecycleSnapshot: true,
        targetValueSnapshot: rule.thresholdValue,
        intervalValueAtService: null,
        lifecycleValueAtService: null,
        varianceValueSnapshot: null,
        lifecycleNumber: 1,
        serviceSequence: 0,
        eventKind: "LIFECYCLE_INITIALIZATION",
        effectiveAt: null,
        effectiveDate,
        machineMeterSnapshot: new Prisma.Decimal(input.machineMeterSnapshot),
        notes,
      },
    });
    if (trackerExisted) {
      await transaction.equipmentMaintenanceTracker.update({
        where: { id: tracker.id },
        data: { recordVersion: { increment: 1 } },
      });
    }
    return { trackerId: tracker.id, eventId: event.id, created: true };
  });
}
