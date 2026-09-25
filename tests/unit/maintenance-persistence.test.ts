import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = {
  equipment: { findUnique: vi.fn() },
  trackedMaintenanceComponent: { findUnique: vi.fn() },
  maintenanceRule: { findUnique: vi.fn() },
  equipmentMaintenanceTracker: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  maintenanceServiceEvent: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
      operation(transaction),
    ),
  },
}));

import { initializeHistoricalMaintenanceLifecycle } from "@/features/maintenance-tracking/persistence";

const equipment = {
  id: "equipment-101151",
  category: "DRAGLINE" as const,
  status: "ACTIVE" as const,
};
const component = {
  id: "drag-cable",
  name: "Drag Cable",
  trackingUnit: "HOURS",
  active: true,
};
const rule = {
  id: "drag-replace",
  componentId: component.id,
  actionName: "Change / Replace",
  counterScope: "COMPONENT_LIFECYCLE" as const,
  thresholdValue: new Prisma.Decimal(1300),
  upperThresholdValue: new Prisma.Decimal(1400),
  repeatable: false,
  repeatIntervalValue: null,
  maximumRepeatCount: null,
  warningLeadValue: new Prisma.Decimal(100),
  startsNewLifecycle: true,
  active: true,
};
const input = {
  equipmentId: equipment.id,
  componentId: component.id,
  ruleId: rule.id,
  effectiveDate: "2026-09-19",
  machineMeterSnapshot: 9380,
  actionName: "New / Replace",
  notes: "Initialized from 101151 maintenance notebook.",
};

function tracker(overrides: Record<string, unknown> = {}) {
  return {
    id: "tracker-1",
    equipmentId: equipment.id,
    componentId: component.id,
    active: true,
    recordVersion: 1,
    trackingStartedAt: new Date("2026-09-20T09:00:00.000Z"),
    serviceEvents: [],
    counterEntries: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  transaction.equipment.findUnique.mockResolvedValue(equipment);
  transaction.trackedMaintenanceComponent.findUnique.mockResolvedValue(component);
  transaction.maintenanceRule.findUnique.mockResolvedValue(rule);
  transaction.equipmentMaintenanceTracker.findUnique.mockResolvedValue(null);
  transaction.equipmentMaintenanceTracker.create.mockResolvedValue(tracker());
  transaction.equipmentMaintenanceTracker.update.mockResolvedValue(tracker({ recordVersion: 2 }));
  transaction.maintenanceServiceEvent.create.mockResolvedValue({ id: "anchor-1" });
});

describe("historical maintenance lifecycle initialization", () => {
  it("rejects an impossible calendar date before starting a transaction", async () => {
    await expect(initializeHistoricalMaintenanceLifecycle({
      ...input,
      effectiveDate: "2026-02-31",
    })).rejects.toThrow("valid calendar date");
  });

  it("creates a date-only lifecycle anchor without fabricated prior values", async () => {
    await expect(initializeHistoricalMaintenanceLifecycle(input)).resolves.toEqual({
      trackerId: "tracker-1",
      eventId: "anchor-1",
      created: true,
    });
    expect(transaction.equipmentMaintenanceTracker.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          equipmentId: equipment.id,
          componentId: component.id,
          trackingStartedAt: new Date("2026-09-20T09:00:00.000Z"),
        }),
      }),
    );
    expect(transaction.maintenanceServiceEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventKind: "LIFECYCLE_INITIALIZATION",
        effectiveAt: null,
        effectiveDate: new Date("2026-09-19T00:00:00.000Z"),
        machineMeterSnapshot: expect.any(Prisma.Decimal),
        intervalValueAtService: null,
        lifecycleValueAtService: null,
        varianceValueSnapshot: null,
        lifecycleNumber: 1,
        serviceSequence: 0,
      }),
    });
    const eventData = transaction.maintenanceServiceEvent.create.mock.calls[0][0].data;
    expect(eventData.machineMeterSnapshot.toString()).toBe("9380");
  });

  it("is a no-op when the identical initialization already exists", async () => {
    const existingEvent = {
      id: "anchor-existing",
      eventKind: "LIFECYCLE_INITIALIZATION",
      ruleId: rule.id,
      effectiveAt: null,
      effectiveDate: new Date("2026-09-19T00:00:00.000Z"),
      actionNameSnapshot: "New / Replace",
      machineMeterSnapshot: new Prisma.Decimal(9380),
      notes: input.notes,
    };
    transaction.equipmentMaintenanceTracker.findUnique.mockResolvedValue(
      tracker({ serviceEvents: [existingEvent] }),
    );
    await expect(initializeHistoricalMaintenanceLifecycle(input)).resolves.toEqual({
      trackerId: "tracker-1",
      eventId: "anchor-existing",
      created: false,
    });
    expect(transaction.maintenanceServiceEvent.create).not.toHaveBeenCalled();
    expect(transaction.equipmentMaintenanceTracker.update).not.toHaveBeenCalled();
  });

  it("rejects conflicting existing history rather than overwriting it", async () => {
    transaction.equipmentMaintenanceTracker.findUnique.mockResolvedValue(
      tracker({
        serviceEvents: [{
          id: "different-anchor",
          eventKind: "LIFECYCLE_INITIALIZATION",
          ruleId: rule.id,
          effectiveAt: null,
          effectiveDate: new Date("2026-09-19T00:00:00.000Z"),
          actionNameSnapshot: "New / Replace",
          machineMeterSnapshot: new Prisma.Decimal(9379),
          notes: input.notes,
        }],
      }),
    );
    await expect(initializeHistoricalMaintenanceLifecycle(input)).rejects.toThrow(
      "Conflicting maintenance tracking history",
    );
    expect(transaction.maintenanceServiceEvent.create).not.toHaveBeenCalled();
  });
});
