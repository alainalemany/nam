export const maintenanceStatusValues = [
  "HEALTHY",
  "DUE_SOON",
  "DUE_WINDOW",
  "DUE",
  "OVERDUE",
] as const;

export type MaintenanceStatus = (typeof maintenanceStatusValues)[number];
export type MaintenanceCounterScope = "SERVICE_INTERVAL" | "COMPONENT_LIFECYCLE";

export type MaintenanceRuleDefinition = {
  id: string;
  actionName: string;
  counterScope: MaintenanceCounterScope;
  thresholdValue: number;
  upperThresholdValue?: number | null;
  repeatable: boolean;
  repeatIntervalValue?: number | null;
  maximumRepeatCount?: number | null;
  warningLeadValue?: number | null;
  startsNewLifecycle: boolean;
  active: boolean;
  priority: number;
  sortOrder: number;
};

export type EvaluatedMaintenanceRule = {
  rule: MaintenanceRuleDefinition;
  status: MaintenanceStatus;
  currentValue: number;
  dueValue: number;
  upperDueValue?: number;
  remainingValue: number;
  overdueValue: number;
  completedCount: number;
  counterStartedAt: Date;
};

export type MaintenanceTrackerSummary = {
  trackerId: string;
  equipmentId: string;
  equipmentLabel: string;
  componentId: string;
  componentName: string;
  trackingUnit: string;
  lifecycleValue: number;
  lifecycleNumber: number;
  lifecycleStartedAt: Date;
  runtimeCoverage: {
    reportCount: number;
    firstOperationalDate?: string;
    lastOperationalDate?: string;
  };
  rules: EvaluatedMaintenanceRule[];
};

export type EvaluatedMaintenanceTracker = MaintenanceTrackerSummary & {
  nextRule?: EvaluatedMaintenanceRule;
  status: MaintenanceStatus;
};

export const maintenanceStatusRank: Record<MaintenanceStatus, number> = {
  HEALTHY: 0,
  DUE_SOON: 1,
  DUE_WINDOW: 2,
  DUE: 3,
  OVERDUE: 4,
};

export function maintenanceStatusLabel(status: MaintenanceStatus) {
  return {
    HEALTHY: "Healthy",
    DUE_SOON: "Due Soon",
    DUE_WINDOW: "Due Window",
    DUE: "Due",
    OVERDUE: "Overdue",
  }[status];
}

export function evaluateMaintenanceRule(
  currentValue: number,
  rule: MaintenanceRuleDefinition,
  completedCount = 0,
  counterStartedAt = new Date(0),
): EvaluatedMaintenanceRule | undefined {
  if (!rule.active || currentValue < 0 || completedCount < 0) return undefined;
  if (!rule.repeatable && completedCount > 0) return undefined;
  if (
    rule.repeatable &&
    rule.maximumRepeatCount != null &&
    completedCount >= rule.maximumRepeatCount
  ) return undefined;

  const dueValue =
    rule.repeatable && completedCount > 0
      ? rule.repeatIntervalValue ?? rule.thresholdValue
      : rule.thresholdValue;
  const upperDueValue = rule.upperThresholdValue ?? undefined;
  let status: MaintenanceStatus = "HEALTHY";

  if (upperDueValue != null) {
    if (currentValue > upperDueValue) status = "OVERDUE";
    else if (currentValue >= dueValue) status = "DUE_WINDOW";
  } else if (currentValue > dueValue) {
    status = "OVERDUE";
  } else if (currentValue === dueValue) {
    status = "DUE";
  }

  if (
    status === "HEALTHY" &&
    rule.warningLeadValue != null &&
    currentValue >= dueValue - rule.warningLeadValue
  ) status = "DUE_SOON";

  return {
    rule,
    status,
    currentValue,
    dueValue,
    upperDueValue,
    remainingValue: Math.max(0, dueValue - currentValue),
    overdueValue:
      upperDueValue == null
        ? Math.max(0, currentValue - dueValue)
        : Math.max(0, currentValue - upperDueValue),
    completedCount,
    counterStartedAt,
  };
}

export function compareEvaluatedRules(
  left: EvaluatedMaintenanceRule,
  right: EvaluatedMaintenanceRule,
) {
  const rankDifference = maintenanceStatusRank[right.status] - maintenanceStatusRank[left.status];
  if (rankDifference !== 0) return rankDifference;
  const remainingDifference = left.remainingValue - right.remainingValue;
  if (remainingDifference !== 0) return remainingDifference;
  const priorityDifference = left.rule.priority - right.rule.priority;
  if (priorityDifference !== 0) return priorityDifference;
  return left.rule.sortOrder - right.rule.sortOrder || left.rule.id.localeCompare(right.rule.id);
}

export function evaluateMaintenanceTracker(
  tracker: MaintenanceTrackerSummary,
): EvaluatedMaintenanceTracker {
  const sortedRules = [...tracker.rules].sort(compareEvaluatedRules);
  const actionable = sortedRules.filter((rule) => rule.status !== "HEALTHY");
  const nextRule = actionable[0] ?? sortedRules[0];
  return { ...tracker, rules: sortedRules, nextRule, status: nextRule?.status ?? "HEALTHY" };
}

export function selectFleetAttention(
  trackers: EvaluatedMaintenanceTracker[],
  selectedEquipmentId?: string,
  limit = 5,
) {
  return trackers
    .filter((tracker) =>
      tracker.equipmentId !== selectedEquipmentId &&
      tracker.status !== "HEALTHY" &&
      tracker.nextRule,
    )
    .sort((left, right) => {
      const rankDifference = maintenanceStatusRank[right.status] - maintenanceStatusRank[left.status];
      if (rankDifference !== 0) return rankDifference;
      const leftRule = left.nextRule!;
      const rightRule = right.nextRule!;
      if (left.status === "OVERDUE") {
        const overdueDifference = rightRule.overdueValue - leftRule.overdueValue;
        if (overdueDifference !== 0) return overdueDifference;
      }
      const remainingDifference = leftRule.remainingValue - rightRule.remainingValue;
      if (remainingDifference !== 0) return remainingDifference;
      return `${left.equipmentLabel}|${left.componentName}|${left.trackerId}`.localeCompare(
        `${right.equipmentLabel}|${right.componentName}|${right.trackerId}`,
      );
    })
    .slice(0, limit);
}

export function maintenanceProgressPercentage(currentValue: number, dueValue: number) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(dueValue) || dueValue <= 0) return 0;
  return Math.min(100, Math.max(0, (currentValue / dueValue) * 100));
}

export function selectMaintenanceEquipmentId(
  equipmentIds: readonly string[],
  requestedEquipmentId?: string,
  scheduledEquipmentId?: string,
) {
  if (requestedEquipmentId && equipmentIds.includes(requestedEquipmentId)) return requestedEquipmentId;
  if (scheduledEquipmentId && equipmentIds.includes(scheduledEquipmentId)) return scheduledEquipmentId;
  return equipmentIds[0];
}

export function snapshotMaintenanceService(
  evaluation: EvaluatedMaintenanceRule,
  lifecycleValue: number,
  lifecycleNumber: number,
  serviceSequence: number,
  effectiveAt: Date,
) {
  const rule = evaluation.rule;
  return {
    effectiveAt,
    actionName: rule.actionName,
    counterScope: rule.counterScope,
    thresholdValue: rule.thresholdValue,
    upperThresholdValue: rule.upperThresholdValue ?? null,
    warningLeadValue: rule.warningLeadValue ?? null,
    repeatIntervalValue: rule.repeatIntervalValue ?? null,
    maximumRepeatCount: rule.maximumRepeatCount ?? null,
    startsNewLifecycle: rule.startsNewLifecycle,
    targetValue: evaluation.dueValue,
    intervalValue: evaluation.currentValue,
    lifecycleValue,
    varianceValue: evaluation.currentValue - evaluation.dueValue,
    lifecycleNumber,
    serviceSequence,
  };
}

export function formatMaintenanceValue(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function displayOperationalDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

export function maintenanceRuntimeCoverageLabel(
  coverage: MaintenanceTrackerSummary["runtimeCoverage"],
) {
  if (coverage.reportCount === 0) {
    return "No completed DDRs after this lifecycle anchor. Counters reflect available verified history only.";
  }
  const first = coverage.firstOperationalDate
    ? displayOperationalDate(coverage.firstOperationalDate)
    : undefined;
  const last = coverage.lastOperationalDate
    ? displayOperationalDate(coverage.lastOperationalDate)
    : undefined;
  const range = first && last
    ? first === last ? first : `${first}–${last}`
    : "available dates";
  return `${coverage.reportCount} completed DDR${coverage.reportCount === 1 ? "" : "s"} · ${range}. Counters reflect available verified history only.`;
}
