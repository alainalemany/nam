import type { EquipmentCategory } from "@prisma/client";

import { calculateWorkedMinutes } from "./calculations";
import type { DailyTimeEntryInput, EquipmentSnapshot } from "./types";

export type EquipmentSnapshotSource = {
  id: string;
  displayName: string;
  equipmentNumber: string | null;
  category: EquipmentCategory;
  mine: { name: string; city: { name: string; state: string | null } };
};

export type ExistingEquipmentSnapshot = {
  primaryEquipmentId: string | null;
  primaryEquipmentDisplayNameSnapshot: string;
  primaryEquipmentNumberSnapshot: string | null;
  primaryEquipmentCategorySnapshot: EquipmentCategory;
  primaryMineNameSnapshot: string;
  primaryCityNameSnapshot: string;
  primaryCityStateSnapshot: string | null;
};

export type WorkCodeSource = { id: string; code: string; description: string; active: boolean };
export type WorkOrderSource = { id: string; workOrderNumber: string; description: string; active: boolean };
export type SupportPersonSource = {
  id: string;
  displayName: string;
  tradeOrRole: string;
  company: string | null;
  active: boolean;
};

export type ExistingAllocationSnapshot = {
  sequence: number;
  workCodeId: string;
  workCodeSnapshot: string;
  workCodeDescriptionSnapshot: string;
  workOrderId: string | null;
  workOrderSnapshot: string | null;
  workOrderDescriptionSnapshot: string | null;
  supportPersonnel: Array<{
    supportPersonId: string;
    supportPersonDisplayNameSnapshot: string;
    supportPersonTradeOrRoleSnapshot: string;
    supportPersonCompanySnapshot: string | null;
  }>;
};

export function equipmentSnapshot(source: EquipmentSnapshotSource): EquipmentSnapshot {
  return {
    displayName: source.displayName,
    equipmentNumber: source.equipmentNumber,
    category: source.category,
    mineName: source.mine.name,
    cityName: source.mine.city.name,
    cityState: source.mine.city.state,
  };
}

function existingSnapshot(source: ExistingEquipmentSnapshot): EquipmentSnapshot {
  return {
    displayName: source.primaryEquipmentDisplayNameSnapshot,
    equipmentNumber: source.primaryEquipmentNumberSnapshot,
    category: source.primaryEquipmentCategorySnapshot,
    mineName: source.primaryMineNameSnapshot,
    cityName: source.primaryCityNameSnapshot,
    cityState: source.primaryCityStateSnapshot,
  };
}

export function entryEquipmentSnapshot(
  equipmentId: string,
  equipmentById: Map<string, EquipmentSnapshotSource>,
  existing?: ExistingEquipmentSnapshot,
) {
  const normalizedEquipmentId = equipmentId || null;
  if (existing && existing.primaryEquipmentId === normalizedEquipmentId) {
    return existingSnapshot(existing);
  }
  const source = equipmentById.get(equipmentId);
  if (!source) throw new Error("Selected equipment could not be found.");
  return equipmentSnapshot(source);
}

function optional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildDailyEntryData(
  entry: DailyTimeEntryInput,
  regularMinutes: number,
  overtimeMinutes: number,
  equipmentById: Map<string, EquipmentSnapshotSource>,
  existing?: ExistingEquipmentSnapshot,
) {
  const snapshot = entryEquipmentSnapshot(entry.primaryEquipmentId, equipmentById, existing);
  return {
    workDate: new Date(`${entry.workDate}T00:00:00.000Z`),
    clockIn: entry.clockIn,
    clockOut: entry.clockOut,
    unpaidBreakMinutes: entry.unpaidBreakMinutes,
    workedMinutes: calculateWorkedMinutes(entry.clockIn, entry.clockOut, entry.unpaidBreakMinutes),
    regularMinutes,
    overtimeMinutes,
    primaryEquipmentId: entry.primaryEquipmentId || null,
    primaryEquipmentDisplayNameSnapshot: snapshot.displayName,
    primaryEquipmentNumberSnapshot: snapshot.equipmentNumber,
    primaryEquipmentCategorySnapshot: snapshot.category,
    primaryMineNameSnapshot: snapshot.mineName,
    primaryCityNameSnapshot: snapshot.cityName,
    primaryCityStateSnapshot: snapshot.cityState,
    workScheduleDailyAssignmentId: optional(entry.workScheduleDailyAssignmentId),
    notes: optional(entry.notes),
  };
}

export function allocationSnapshots(
  workCodeId: string,
  workOrderId: string | undefined,
  workCodeById: Map<string, WorkCodeSource>,
  workOrderById: Map<string, WorkOrderSource>,
  existing?: ExistingAllocationSnapshot,
) {
  const workCode = workCodeById.get(workCodeId);
  if (!workCode) throw new Error("Selected Work Code could not be found.");
  const preserveCode = existing?.workCodeId === workCodeId;

  const normalizedWorkOrderId = optional(workOrderId);
  const workOrder = normalizedWorkOrderId ? workOrderById.get(normalizedWorkOrderId) : undefined;
  if (normalizedWorkOrderId && !workOrder) throw new Error("Selected Work Order could not be found.");
  const preserveOrder = existing?.workOrderId === normalizedWorkOrderId;

  return {
    workCodeSnapshot: preserveCode ? existing.workCodeSnapshot : workCode.code,
    workCodeDescriptionSnapshot: preserveCode
      ? existing.workCodeDescriptionSnapshot
      : workCode.description,
    workOrderId: normalizedWorkOrderId,
    workOrderSnapshot: normalizedWorkOrderId
      ? preserveOrder
        ? existing?.workOrderSnapshot ?? null
        : workOrder?.workOrderNumber ?? null
      : null,
    workOrderDescriptionSnapshot: normalizedWorkOrderId
      ? preserveOrder
        ? existing?.workOrderDescriptionSnapshot ?? null
        : workOrder?.description ?? null
      : null,
  };
}

export function supportPersonSnapshot(
  supportPersonId: string,
  supportPersonById: Map<string, SupportPersonSource>,
  existing?: ExistingAllocationSnapshot,
) {
  const preserved = existing?.supportPersonnel.find(
    (person) => person.supportPersonId === supportPersonId,
  );
  if (preserved) return preserved;
  const person = supportPersonById.get(supportPersonId);
  if (!person) throw new Error("Selected Support Person could not be found.");
  return {
    supportPersonId: person.id,
    supportPersonDisplayNameSnapshot: person.displayName,
    supportPersonTradeOrRoleSnapshot: person.tradeOrRole,
    supportPersonCompanySnapshot: person.company,
  };
}
