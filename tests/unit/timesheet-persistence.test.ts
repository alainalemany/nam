import { describe, expect, it } from "vitest";

import {
  allocationSnapshots,
  buildDailyEntryData,
  entryEquipmentSnapshot,
  supportPersonSnapshot,
  type EquipmentSnapshotSource,
  type ExistingAllocationSnapshot,
  type ExistingEquipmentSnapshot,
} from "@/features/timesheets/persistence";

const equipment: EquipmentSnapshotSource = {
  id: "equipment-1", displayName: "Current Dragline", equipmentNumber: "DL-1", category: "DRAGLINE",
  mine: { name: "Current Mine", city: { name: "Current City", state: "WY" } },
};
const historic: ExistingEquipmentSnapshot = {
  primaryEquipmentId: "equipment-1", primaryEquipmentDisplayNameSnapshot: "Historic Dragline",
  primaryEquipmentNumberSnapshot: "OLD-1", primaryEquipmentCategorySnapshot: "DRAGLINE",
  primaryMineNameSnapshot: "Historic Mine", primaryCityNameSnapshot: "Historic City", primaryCityStateSnapshot: "MT",
};
const existingAllocation: ExistingAllocationSnapshot = {
  sequence: 1, workCodeId: "code-1", workCodeSnapshot: "OLD-CODE", workCodeDescriptionSnapshot: "Historic code",
  workOrderId: "order-1", workOrderSnapshot: "OLD-ORDER", workOrderDescriptionSnapshot: "Historic order",
  supportPersonnel: [{ supportPersonId: "person-1", supportPersonDisplayNameSnapshot: "Historic Person", supportPersonTradeOrRoleSnapshot: "Historic Role", supportPersonCompanySnapshot: "Historic Co" }],
};

describe("Timesheet historical snapshot persistence", () => {
  it("preserves Equipment snapshots when selection is unchanged", () => {
    expect(entryEquipmentSnapshot("equipment-1", new Map([[equipment.id, equipment]]), historic)).toMatchObject({ displayName: "Historic Dragline", mineName: "Historic Mine" });
  });

  it("preserves Equipment snapshots when the live relation was deleted", () => {
    const deletedRelation = { ...historic, primaryEquipmentId: null };
    expect(entryEquipmentSnapshot("", new Map(), deletedRelation)).toMatchObject({
      displayName: "Historic Dragline",
      mineName: "Historic Mine",
    });
  });

  it("refreshes Equipment snapshots when selection changes", () => {
    expect(entryEquipmentSnapshot("equipment-1", new Map([[equipment.id, equipment]]))).toMatchObject({ displayName: "Current Dragline", mineName: "Current Mine" });
  });

  it("derives worked and payroll snapshots server-side", () => {
    const data = buildDailyEntryData({ workDate: "2026-07-13", clockIn: "17:00", clockOut: "05:00", unpaidBreakMinutes: 30, primaryEquipmentId: "equipment-1", allocations: [] }, 690, 0, new Map([[equipment.id, equipment]]));
    expect(data).toMatchObject({ workedMinutes: 690, regularMinutes: 690, overtimeMinutes: 0, primaryEquipmentDisplayNameSnapshot: "Current Dragline" });
  });

  it("preserves unchanged Work Code, Work Order, and Support Personnel snapshots", () => {
    const snapshots = allocationSnapshots("code-1", "order-1", new Map([["code-1", { id: "code-1", code: "NEW", description: "New", active: true }]]), new Map([["order-1", { id: "order-1", workOrderNumber: "NEW-WO", description: "New", active: true }]]), existingAllocation);
    expect(snapshots).toMatchObject({ workCodeSnapshot: "OLD-CODE", workOrderSnapshot: "OLD-ORDER" });
    expect(supportPersonSnapshot("person-1", new Map(), existingAllocation)).toMatchObject({ supportPersonDisplayNameSnapshot: "Historic Person" });
  });

  it("refreshes reference snapshots only when selection changes", () => {
    const snapshots = allocationSnapshots("code-2", "order-2", new Map([["code-2", { id: "code-2", code: "P-2", description: "Production", active: true }]]), new Map([["order-2", { id: "order-2", workOrderNumber: "WO-2", description: "Repair", active: true }]]), existingAllocation);
    expect(snapshots).toMatchObject({ workCodeSnapshot: "P-2", workOrderSnapshot: "WO-2" });
    expect(supportPersonSnapshot("person-2", new Map([["person-2", { id: "person-2", displayName: "Current Person", tradeOrRole: "Welder", company: null, active: true }]]), existingAllocation)).toMatchObject({ supportPersonDisplayNameSnapshot: "Current Person" });
  });
});
