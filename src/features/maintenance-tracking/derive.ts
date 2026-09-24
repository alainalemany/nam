import {
  evaluateMaintenanceRule,
  evaluateMaintenanceTracker,
  type EvaluatedMaintenanceTracker,
  type MaintenanceRuleDefinition,
} from "./domain";
import {
  calculateEquipmentOperatingMinutes,
  maintenanceHoursFromMinutes,
  type MaintenanceAdjustment,
  type MaintenanceRuntimeReport,
} from "./runtime-source";

export type DerivableMaintenanceEvent = {
  id: string;
  ruleId: string | null;
  effectiveAt: Date;
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
    .filter((event) => event.effectiveAt <= asOf)
    .sort((left, right) => left.effectiveAt.getTime() - right.effectiveAt.getTime() || left.id.localeCompare(right.id));
  const replacementEvents = events.filter((event) => event.startsNewLifecycleSnapshot);
  const latestReplacement = replacementEvents.at(-1);
  const lifecycleStartedAt = latestReplacement?.effectiveAt ?? tracker.trackingStartedAt;
  const lifecycleEvents = events.filter((event) => event.effectiveAt > lifecycleStartedAt);
  const hoursBetween = (from: Date) => maintenanceHoursFromMinutes(
    calculateEquipmentOperatingMinutes(
      tracker.equipmentId,
      from,
      asOf,
      reports,
      tracker.adjustments,
    ),
  );
  const lifecycleValue = hoursBetween(lifecycleStartedAt);
  const rules = tracker.rules.flatMap((rule) => {
    const matchingEvents = lifecycleEvents.filter((event) => event.ruleId === rule.id);
    const counterStartedAt =
      rule.counterScope === "SERVICE_INTERVAL"
        ? matchingEvents.at(-1)?.effectiveAt ?? lifecycleStartedAt
        : lifecycleStartedAt;
    const currentValue =
      rule.counterScope === "COMPONENT_LIFECYCLE"
        ? lifecycleValue
        : hoursBetween(counterStartedAt);
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
    lifecycleNumber: replacementEvents.length + 1,
    lifecycleStartedAt,
    rules,
  });
}
