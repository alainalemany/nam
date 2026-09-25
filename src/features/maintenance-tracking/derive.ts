import {
  evaluateMaintenanceRule,
  evaluateMaintenanceTracker,
  type EvaluatedMaintenanceTracker,
  type MaintenanceRuleDefinition,
} from "./domain";
import {
  calculateEquipmentOperatingRuntime,
  maintenanceHoursFromMinutes,
  type MaintenanceAdjustment,
  type MaintenanceRuntimeReport,
} from "./runtime-source";
import { maintenanceEventBoundaryAt } from "./boundaries";

export type DerivableMaintenanceEvent = {
  id: string;
  ruleId: string | null;
  eventKind?: "SERVICE" | "LIFECYCLE_INITIALIZATION";
  effectiveAt?: Date | null;
  effectiveDate?: Date | null;
  startsNewLifecycleSnapshot: boolean;
};

export type DerivableMaintenanceTracker = {
  trackerId: string;
  equipmentId: string;
  equipmentLabel: string;
  componentId: string;
  componentName: string;
  trackingUnit: string;
  trackingStartedAt: Date;
  rules: MaintenanceRuleDefinition[];
  serviceEvents: DerivableMaintenanceEvent[];
  adjustments: MaintenanceAdjustment[];
};

export function deriveMaintenanceTracker(
  tracker: DerivableMaintenanceTracker,
  reports: readonly MaintenanceRuntimeReport[],
  asOf = new Date(),
): EvaluatedMaintenanceTracker {
  const events = tracker.serviceEvents
    .map((event) => ({ ...event, boundaryAt: maintenanceEventBoundaryAt(event) }))
    .filter((event) => event.boundaryAt <= asOf)
    .sort((left, right) => left.boundaryAt.getTime() - right.boundaryAt.getTime() || left.id.localeCompare(right.id));
  const replacementEvents = events.filter((event) => event.startsNewLifecycleSnapshot);
  const latestReplacement = replacementEvents.at(-1);
  const lifecycleStartedAt = latestReplacement?.boundaryAt ?? tracker.trackingStartedAt;
  const lifecycleEvents = events.filter((event) => event.boundaryAt > lifecycleStartedAt);
  const runtimeBetween = (from: Date) => calculateEquipmentOperatingRuntime(
      tracker.equipmentId,
      from,
      asOf,
      reports,
      tracker.adjustments,
    );
  const lifecycleRuntime = runtimeBetween(lifecycleStartedAt);
  const lifecycleValue = maintenanceHoursFromMinutes(lifecycleRuntime.minutes);
  const rules = tracker.rules.flatMap((rule) => {
    const matchingEvents = lifecycleEvents.filter((event) => event.ruleId === rule.id);
    const counterStartedAt =
      rule.counterScope === "SERVICE_INTERVAL"
        ? matchingEvents.at(-1)?.boundaryAt ?? lifecycleStartedAt
        : lifecycleStartedAt;
    const currentValue =
      rule.counterScope === "COMPONENT_LIFECYCLE"
        ? lifecycleValue
        : maintenanceHoursFromMinutes(runtimeBetween(counterStartedAt).minutes);
    const evaluated = evaluateMaintenanceRule(
      currentValue,
      rule,
      matchingEvents.length,
      counterStartedAt,
    );
    return evaluated ? [evaluated] : [];
  });

  return evaluateMaintenanceTracker({
    trackerId: tracker.trackerId,
    equipmentId: tracker.equipmentId,
    equipmentLabel: tracker.equipmentLabel,
    componentId: tracker.componentId,
    componentName: tracker.componentName,
    trackingUnit: tracker.trackingUnit,
    lifecycleValue,
    lifecycleNumber: replacementEvents.filter((event) => event.eventKind !== "LIFECYCLE_INITIALIZATION").length + 1,
    lifecycleStartedAt,
    runtimeCoverage: {
      reportCount: lifecycleRuntime.reportIds.length,
      firstOperationalDate: lifecycleRuntime.firstOperationalDate,
      lastOperationalDate: lifecycleRuntime.lastOperationalDate,
    },
    rules,
  });
}
