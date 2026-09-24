import { describe, expect, it } from "vitest";

import { deriveMaintenanceTracker } from "@/features/maintenance-tracking/derive";
import type { MaintenanceRuleDefinition } from "@/features/maintenance-tracking/domain";
import {
  calculateEquipmentOperatingMinutes,
  MaintenanceRuntimeSplitError,
  type MaintenanceRuntimeReport,
} from "@/features/maintenance-tracking/runtime-source";

function report(
  id: string,
  equipmentId: string,
  date: string,
  downtimeMinutes = 0,
  shift: "DAY" | "NIGHT" = "DAY",
): MaintenanceRuntimeReport {
  const startMinuteOffset = shift === "DAY" ? 300 : 1020;
  return {
    id,
    equipmentId,
    operationalWorkDate: new Date(`${date}T00:00:00.000Z`),
    shift,
    status: "COMPLETED",
    timelineEntries: downtimeMinutes > 0 ? [{
      startMinuteOffset,
      durationMinutes: downtimeMinutes,
      causesDowntime: true,
      delayCode: "01",
    }] : [],
    groundChecks: [],
    downtimeBlocks: [],
  };
}

function date(day: number, hour = 0) {
  return new Date(`2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`);
}

const resocket: MaintenanceRuleDefinition = {
  id: "resocket",
  actionName: "Resocket",
  counterScope: "SERVICE_INTERVAL",
  thresholdValue: 150,
  repeatable: true,
  repeatIntervalValue: 150,
  startsNewLifecycle: false,
  active: true,
  priority: 20,
  sortOrder: 10,
};
const replace: MaintenanceRuleDefinition = {
  id: "replace",
  actionName: "Replace",
  counterScope: "COMPONENT_LIFECYCLE",
  thresholdValue: 1300,
  upperThresholdValue: 1400,
  repeatable: false,
  startsNewLifecycle: true,
  active: true,
  priority: 10,
  sortOrder: 20,
};

describe("DDR authoritative maintenance runtime", () => {
  it("isolates exact Equipment, accumulates reports, and ignores duplicate report identities", () => {
    const reports = [report("a", "101151", "2026-09-01"), report("b", "101151", "2026-09-02", 60), report("other", "101119", "2026-09-01")];
    expect(calculateEquipmentOperatingMinutes("101151", date(1), date(4), reports)).toBe(1380);
    expect(calculateEquipmentOperatingMinutes("101119", date(1), date(4), reports)).toBe(720);
    expect(calculateEquipmentOperatingMinutes("101151", date(1), date(4), [...reports, reports[0]])).toBe(1380);
  });

  it("reflects a corrected DDR because the current authoritative version is recalculated", () => {
    const original = report("same", "101151", "2026-09-01", 90);
    const corrected = report("same", "101151", "2026-09-01", 135);
    expect(calculateEquipmentOperatingMinutes("101151", date(1), date(2), [original])).toBe(630);
    expect(calculateEquipmentOperatingMinutes("101151", date(1), date(2), [original, corrected])).toBe(585);
  });

  it("splits runtime at a service time inside a normal DDR", () => {
    const night = report("night", "101151", "2026-09-24", 0, "NIGHT");
    const shiftStart = new Date("2026-09-24T21:00:00.000Z");
    const service = new Date("2026-09-25T03:30:00.000Z");
    const shiftEnd = new Date("2026-09-25T09:00:00.000Z");
    expect(calculateEquipmentOperatingMinutes("101151", shiftStart, service, [night])).toBe(390);
    expect(calculateEquipmentOperatingMinutes("101151", service, shiftEnd, [night])).toBe(330);
  });

  it("rejects ambiguous intra-report splits when downtime extends past the fixed shift budget", () => {
    const source = report("late", "101151", "2026-09-24", 0, "DAY");
    source.timelineEntries = [{ startMinuteOffset: 1030, durationMinutes: 10, causesDowntime: true, delayCode: "13" }];
    expect(() => calculateEquipmentOperatingMinutes(
      "101151",
      new Date("2026-09-24T09:00:00.000Z"),
      new Date("2026-09-24T16:00:00.000Z"),
      [source],
    )).toThrow(MaintenanceRuntimeSplitError);
  });
});

describe("service interval and lifecycle boundaries", () => {
  const tracker = (events: Parameters<typeof deriveMaintenanceTracker>[0]["serviceEvents"] = []) => ({
    trackerId: "tracker",
    equipmentId: "101151",
    equipmentLabel: "Dragline 101151",
    componentId: "drag-cable",
    componentName: "Drag Cable",
    trackingUnit: "HOURS",
    trackingStartedAt: date(1),
    rules: [resocket, replace],
    serviceEvents: events,
    adjustments: [],
  });

  it("supports early, on-time, and overdue service values without capping", () => {
    expect(evaluateAtHours(132).rules.find((item) => item.rule.id === "resocket")?.currentValue).toBe(132);
    expect(evaluateAtHours(150).rules.find((item) => item.rule.id === "resocket")?.status).toBe("DUE");
    expect(evaluateAtHours(180).rules.find((item) => item.rule.id === "resocket")).toMatchObject({ status: "OVERDUE", currentValue: 180, overdueValue: 30 });
  });

  function evaluateAtHours(hours: number) {
    return deriveMaintenanceTracker(
      { ...tracker(), adjustments: [{ effectiveAt: date(1), adjustmentValue: hours }] },
      [],
      date(20),
    );
  }

  it("resocket resets its interval while preserving total lifecycle hours and history", () => {
    const event = { id: "pm-1", ruleId: "resocket", effectiveAt: date(10), startsNewLifecycleSnapshot: false };
    const summary = deriveMaintenanceTracker({ ...tracker([event]), adjustments: [
      { effectiveAt: date(2), adjustmentValue: 180 },
      { effectiveAt: date(11), adjustmentValue: 24 },
    ] }, [], date(12));
    expect(summary.lifecycleValue).toBe(204);
    expect(summary.rules.find((item) => item.rule.id === "resocket")).toMatchObject({ currentValue: 24, completedCount: 1 });
    expect(tracker([event]).serviceEvents).toHaveLength(1);
  });

  it("uses a backdated effective timestamp rather than the later audit timestamp", () => {
    const event = {
      id: "backdated-pm",
      ruleId: "resocket",
      effectiveAt: date(10),
      createdAt: date(12),
      startsNewLifecycleSnapshot: false,
    };
    const summary = deriveMaintenanceTracker({
      ...tracker([event]),
      adjustments: [
        { effectiveAt: date(9), adjustmentValue: 150 },
        { effectiveAt: date(11), adjustmentValue: 18 },
      ],
    }, [], date(13));
    expect(event.createdAt).not.toEqual(event.effectiveAt);
    expect(summary.lifecycleValue).toBe(168);
    expect(summary.rules.find((item) => item.rule.id === "resocket")?.currentValue).toBe(18);
  });

  it("replacement starts a new lifecycle and resets interval counts", () => {
    const events = [
      { id: "pm-1", ruleId: "resocket", effectiveAt: date(5), startsNewLifecycleSnapshot: false },
      { id: "replace-1", ruleId: "replace", effectiveAt: date(10), startsNewLifecycleSnapshot: true },
    ];
    const summary = deriveMaintenanceTracker({ ...tracker(events), adjustments: [
      { effectiveAt: date(2), adjustmentValue: 1368 },
      { effectiveAt: date(11), adjustmentValue: 12 },
    ] }, [], date(12));
    expect(summary).toMatchObject({ lifecycleNumber: 2, lifecycleValue: 12 });
    expect(summary.rules.find((item) => item.rule.id === "resocket")).toMatchObject({ currentValue: 12, completedCount: 0 });
    expect(events).toHaveLength(2);
  });

  it("tracks Hoist resocket count independently of lifecycle hours and enforces maximum", () => {
    const hoistRule = { ...resocket, thresholdValue: 500, repeatIntervalValue: 500, maximumRepeatCount: 4 };
    const events = [1, 2, 3, 4].map((sequence) => ({ id: `pm-${sequence}`, ruleId: "resocket", effectiveAt: date(sequence + 2), startsNewLifecycleSnapshot: false }));
    const summary = deriveMaintenanceTracker({ ...tracker(events), rules: [hoistRule, { ...replace, thresholdValue: 1500, upperThresholdValue: undefined }], adjustments: [{ effectiveAt: date(2), adjustmentValue: 970 }] }, [], date(10));
    expect(summary.lifecycleValue).toBe(970);
    expect(summary.rules.find((item) => item.rule.id === "resocket")).toBeUndefined();
    expect(summary.rules.find((item) => item.rule.id === "replace")?.currentValue).toBe(970);
  });
});
