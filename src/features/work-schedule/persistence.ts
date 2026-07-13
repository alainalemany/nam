import type { EquipmentCategory } from "@prisma/client";

import {
  normalizePrimaryEmployeeKey,
  type AssignmentFormInput,
  type WeeklyScheduleFormInput,
} from "./validation";

export type EquipmentSnapshotSource = {
  id: string;
  displayName: string;
  equipmentNumber: string | null;
  category: EquipmentCategory;
  mine: {
    name: string;
    city: {
      name: string;
      state: string | null;
    };
  };
};

type EquipmentSnapshot = {
  equipmentDisplayName: string | null;
  equipmentNumber: string | null;
  equipmentCategory: EquipmentCategory | null;
  mineName: string | null;
  cityName: string | null;
  cityState: string | null;
};

export type ExistingAssignmentSnapshot = {
  plannedEquipmentId: string | null;
  plannedEquipmentDisplayName: string | null;
  plannedEquipmentNumber: string | null;
  plannedEquipmentCategory: EquipmentCategory | null;
  plannedMineName: string | null;
  plannedCityName: string | null;
  plannedCityState: string | null;
  actualEquipmentId: string | null;
  actualEquipmentDisplayName: string | null;
  actualEquipmentNumber: string | null;
  actualEquipmentCategory: EquipmentCategory | null;
  actualMineName: string | null;
  actualCityName: string | null;
  actualCityState: string | null;
};

export function equipmentSnapshot(
  equipment: EquipmentSnapshotSource | undefined,
): EquipmentSnapshot {
  if (!equipment) {
    return {
      equipmentDisplayName: null,
      equipmentNumber: null,
      equipmentCategory: null,
      mineName: null,
      cityName: null,
      cityState: null,
    };
  }

  return {
    equipmentDisplayName: equipment.displayName,
    equipmentNumber: equipment.equipmentNumber,
    equipmentCategory: equipment.category,
    mineName: equipment.mine.name,
    cityName: equipment.mine.city.name,
    cityState: equipment.mine.city.state,
  };
}

function emptySnapshot(): EquipmentSnapshot {
  return {
    equipmentDisplayName: null,
    equipmentNumber: null,
    equipmentCategory: null,
    mineName: null,
    cityName: null,
    cityState: null,
  };
}

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function plannedSnapshotFromExisting(
  existing: ExistingAssignmentSnapshot,
): EquipmentSnapshot {
  return {
    equipmentDisplayName: existing.plannedEquipmentDisplayName,
    equipmentNumber: existing.plannedEquipmentNumber,
    equipmentCategory: existing.plannedEquipmentCategory,
    mineName: existing.plannedMineName,
    cityName: existing.plannedCityName,
    cityState: existing.plannedCityState,
  };
}

function actualSnapshotFromExisting(
  existing: ExistingAssignmentSnapshot,
): EquipmentSnapshot {
  return {
    equipmentDisplayName: existing.actualEquipmentDisplayName,
    equipmentNumber: existing.actualEquipmentNumber,
    equipmentCategory: existing.actualEquipmentCategory,
    mineName: existing.actualMineName,
    cityName: existing.actualCityName,
    cityState: existing.actualCityState,
  };
}

function plannedSnapshotForAssignment(
  assignment: AssignmentFormInput,
  equipmentById: Map<string, EquipmentSnapshotSource>,
  existing?: ExistingAssignmentSnapshot,
) {
  const selectedEquipmentId = asNullable(assignment.plannedEquipmentId);

  if (existing && selectedEquipmentId === existing.plannedEquipmentId) {
    return plannedSnapshotFromExisting(existing);
  }

  if (selectedEquipmentId) {
    return equipmentSnapshot(equipmentById.get(selectedEquipmentId));
  }

  return emptySnapshot();
}

function actualSnapshotForAssignment(
  assignment: AssignmentFormInput,
  equipmentById: Map<string, EquipmentSnapshotSource>,
  existing?: ExistingAssignmentSnapshot,
) {
  const selectedEquipmentId = asNullable(assignment.actualEquipmentId);

  if (existing && selectedEquipmentId === existing.actualEquipmentId) {
    return actualSnapshotFromExisting(existing);
  }

  if (selectedEquipmentId) {
    return equipmentSnapshot(equipmentById.get(selectedEquipmentId));
  }

  return emptySnapshot();
}

function crewMember(
  phase: "PLANNED" | "ACTUAL",
  role: "PRIMARY_EMPLOYEE" | "PARTNER",
  displayName: string | undefined,
  isUnknown = false,
) {
  if (!displayName && !isUnknown) {
    return null;
  }

  return {
    phase,
    role,
    displayName: asNullable(displayName),
    isUnknown,
  };
}

export function buildAssignmentCrewMembers(
  assignment: AssignmentFormInput,
  primaryEmployeeDisplayName: string,
) {
  const hasActualCrew =
    assignment.actualStatus === "SCHEDULED" ||
    Boolean(assignment.actualPrimaryDisplayName) ||
    Boolean(assignment.actualPartnerDisplayName) ||
    assignment.actualPartnerUnknown;

  return [
    crewMember(
      "PLANNED",
      "PRIMARY_EMPLOYEE",
      assignment.plannedPrimaryDisplayName ?? primaryEmployeeDisplayName,
    ),
    crewMember(
      "PLANNED",
      "PARTNER",
      assignment.plannedPartnerDisplayName,
      assignment.plannedPartnerUnknown,
    ),
    ...(hasActualCrew
      ? [
          crewMember(
            "ACTUAL",
            "PRIMARY_EMPLOYEE",
            assignment.actualPrimaryDisplayName ?? primaryEmployeeDisplayName,
          ),
          crewMember(
            "ACTUAL",
            "PARTNER",
            assignment.actualPartnerDisplayName,
            assignment.actualPartnerUnknown,
          ),
        ]
      : []),
  ].filter((member): member is NonNullable<typeof member> => member !== null);
}

export function buildDailyAssignmentWriteData(
  assignment: AssignmentFormInput,
  primaryEmployeeDisplayName: string,
  equipmentById: Map<string, EquipmentSnapshotSource>,
  existing?: ExistingAssignmentSnapshot,
) {
  const plannedSnapshot = plannedSnapshotForAssignment(assignment, equipmentById, existing);
  const actualSnapshot = actualSnapshotForAssignment(assignment, equipmentById, existing);

  return {
    assignmentDate: new Date(`${assignment.assignmentDate}T00:00:00.000Z`),
    dayOfWeek: assignment.dayOfWeek,
    plannedStatus: assignment.plannedStatus,
    plannedShift: assignment.plannedShift,
    plannedEquipmentId: asNullable(assignment.plannedEquipmentId),
    plannedEquipmentDisplayName: plannedSnapshot.equipmentDisplayName,
    plannedEquipmentNumber: plannedSnapshot.equipmentNumber,
    plannedEquipmentCategory: plannedSnapshot.equipmentCategory,
    plannedMineName: plannedSnapshot.mineName,
    plannedCityName: plannedSnapshot.cityName,
    plannedCityState: plannedSnapshot.cityState,
    actualStatus: assignment.actualStatus,
    actualShift: assignment.actualShift,
    actualEquipmentId: asNullable(assignment.actualEquipmentId),
    actualEquipmentDisplayName: actualSnapshot.equipmentDisplayName,
    actualEquipmentNumber: actualSnapshot.equipmentNumber,
    actualEquipmentCategory: actualSnapshot.equipmentCategory,
    actualMineName: actualSnapshot.mineName,
    actualCityName: actualSnapshot.cityName,
    actualCityState: actualSnapshot.cityState,
    changeReason: asNullable(assignment.changeReason),
    plannedNotes: asNullable(assignment.plannedNotes),
    actualNotes: asNullable(assignment.actualNotes),
    crewMembers: {
      create: buildAssignmentCrewMembers(assignment, primaryEmployeeDisplayName),
    },
  };
}

export function buildWeeklyScheduleWriteData(
  input: WeeklyScheduleFormInput,
  equipmentById: Map<string, EquipmentSnapshotSource>,
) {
  const weekStartDate = new Date(`${input.weekStartDate}T00:00:00.000Z`);
  const weekEndDate = new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);

  return {
    weekStartDate,
    weekEndDate,
    status: input.status,
    primaryEmployeeDisplayName: input.primaryEmployeeDisplayName,
    primaryEmployeeKey: normalizePrimaryEmployeeKey(input.primaryEmployeeDisplayName),
    assignedByDisplayName: input.assignedByDisplayName,
    receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
    sourceNote: asNullable(input.sourceNote),
    scheduleNotes: asNullable(input.scheduleNotes),
    assignments: {
      create: input.assignments.map((assignment) =>
        buildDailyAssignmentWriteData(
          assignment,
          input.primaryEmployeeDisplayName,
          equipmentById,
        ),
      ),
    },
  };
}
