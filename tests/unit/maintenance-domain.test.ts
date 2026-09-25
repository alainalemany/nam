import { describe, expect, it } from "vitest";

import {
  evaluateMaintenanceRule,
  evaluateMaintenanceTracker,
  maintenanceProgressPercentage,
  selectFleetAttention,
  selectMaintenanceEquipmentId,
  snapshotMaintenanceService,
  type EvaluatedMaintenanceRule,
  type MaintenanceRuleDefinition,
  type MaintenanceTrackerSummary,
} from "@/features/maintenance-tracking/domain";

function rule(overrides: Partial<MaintenanceRuleDefinition> = {}): MaintenanceRuleDefinition {
  return {
    id: "replace",
    actionName: "Change / Replace",
    counterScope: "COMPONENT_LIFECYCLE",
    thresholdValue: 750,
    repeatable: false,
    startsNewLifecycle: true,
    active: true,
    priority: 10,
    sortOrder: 10,
    ...overrides,
  };
}

function evaluated(currentValue: number, overrides: Partial<MaintenanceRuleDefinition> = {}) {
  return evaluateMaintenanceRule(currentValue, rule(overrides), 0, new Date("2026-01-01T00:00:00Z"))!;
}

function tracker(id: string, equipmentId: string, evaluation: EvaluatedMaintenanceRule): MaintenanceTrackerSummary {
  return {
    trackerId: id,
    equipmentId,
    equipmentLabel: `Dragline ${equipmentId}`,
    componentId: `component-${id}`,
    componentName: "Teeth",
    trackingUnit: "HOURS",
    lifecycleValue: evaluation.currentValue,
    lifecycleNumber: 1,
    lifecycleStartedAt: new Date("2026-01-01T00:00:00Z"),
    runtimeCoverage: { reportCount: 1, firstOperationalDate: "2026-01-01", lastOperationalDate: "2026-01-01" },
    rules: [evaluation],
  };
}

describe("maintenance threshold calculations", () => {
  it("distinguishes healthy, due soon, exact due, and overdue", () => {
    expect(evaluated(674, { warningLeadValue: 75 }).status).toBe("HEALTHY");
    expect(evaluated(690, { warningLeadValue: 75 }).status).toBe("DUE_SOON");
    expect(evaluated(750).status).toBe("DUE");
    expect(evaluated(780)).toMatchObject({ status: "OVERDUE", currentValue: 780, overdueValue: 30 });
  });

  it("preserves the inclusive lower/upper service window and overdue boundary", () => {
    const window = { thresholdValue: 1300, upperThresholdValue: 1400, warningLeadValue: 100 };
    expect(evaluated(1250, window).status).toBe("DUE_SOON");
    expect(evaluated(1300, window).status).toBe("DUE_WINDOW");
    expect(evaluated(1400, window).status).toBe("DUE_WINDOW");
    expect(evaluated(1401, window)).toMatchObject({ status: "OVERDUE", overdueValue: 1 });
  });

  it("restarts a repeatable service interval instead of making it cumulative", () => {
    const repeat = rule({
      id: "resocket",
      actionName: "Resocket",
      counterScope: "SERVICE_INTERVAL",
      thresholdValue: 150,
      repeatable: true,
      repeatIntervalValue: 150,
      startsNewLifecycle: false,
    });
    expect(evaluateMaintenanceRule(149, repeat, 2)?.dueValue).toBe(150);
    expect(evaluateMaintenanceRule(150, repeat, 2)?.status).toBe("DUE");
  });

  it("removes a repeatable rule only after its configured maximum", () => {
    const repeat = rule({ repeatable: true, repeatIntervalValue: 500, maximumRepeatCount: 4 });
    expect(evaluateMaintenanceRule(1, repeat, 3)).toBeDefined();
    expect(evaluateMaintenanceRule(1, repeat, 4)).toBeUndefined();
  });

  it("snapshots early, on-time, and late variance under the rule in force", () => {
    const originalRule = rule({ thresholdValue: 150, actionName: "Resocket", startsNewLifecycle: false });
    const effectiveAt = new Date("2026-09-24T03:30:00.000Z");
    const early = snapshotMaintenanceService(evaluateMaintenanceRule(132, originalRule)!, 900, 1, 3, effectiveAt);
    const onTime = snapshotMaintenanceService(evaluateMaintenanceRule(150, originalRule)!, 918, 1, 3, effectiveAt);
    const late = snapshotMaintenanceService(evaluateMaintenanceRule(180, originalRule)!, 948, 1, 3, effectiveAt);
    expect(early).toMatchObject({ thresholdValue: 150, targetValue: 150, varianceValue: -18, effectiveAt });
    expect(onTime.varianceValue).toBe(0);
    expect(late.varianceValue).toBe(30);

    const editedRule = { ...originalRule, thresholdValue: 175 };
    expect(editedRule.thresholdValue).toBe(175);
    expect(early.thresholdValue).toBe(150);
  });
});

describe("Home maintenance selection and presentation", () => {
  it("uses a valid manual selector before schedule default, then falls back deterministically", () => {
    const ids = ["101104", "101151"];
    expect(selectMaintenanceEquipmentId(ids, "101104", "101151")).toBe("101104");
    expect(selectMaintenanceEquipmentId(ids, undefined, "101151")).toBe("101151");
    expect(selectMaintenanceEquipmentId(ids, "missing", "missing")).toBe("101104");
  });

  it("excludes healthy and selected-equipment items and prioritizes overdue", () => {
    const healthy = evaluateMaintenanceTracker(tracker("healthy", "101104", evaluated(100)));
    const selectedOverdue = evaluateMaintenanceTracker(tracker("selected", "101151", evaluated(800)));
    const soon = evaluateMaintenanceTracker(tracker("soon", "101119", evaluated(700, { warningLeadValue: 75 })));
    const overdue = evaluateMaintenanceTracker(tracker("overdue", "101137", evaluated(900)));
    expect(selectFleetAttention([healthy, selectedOverdue, soon, overdue], "101151").map((item) => item.trackerId)).toEqual(["overdue", "soon"]);
  });

  it("keeps the numeric overage while capping ring progress at 100 percent", () => {
    expect(maintenanceProgressPercentage(142, 150)).toBeCloseTo(94.67, 1);
    expect(maintenanceProgressPercentage(150, 150)).toBe(100);
    expect(maintenanceProgressPercentage(180, 150)).toBe(100);
    expect(evaluated(180, { thresholdValue: 150 })).toMatchObject({ currentValue: 180, overdueValue: 30 });
  });
});
