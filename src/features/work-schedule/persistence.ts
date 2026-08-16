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

export type EmployeeSnapshotSource = {
  id: string;
  employeeCode: string | null;
  displayName: string;
  isActive: boolean;
  isSupervisor: boolean;
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
  crewMembers: ExistingCrewMemberSnapshot[];
};

export type ExistingCrewMemberSnapshot = {
  phase: "PLANNED" | "ACTUAL";
  role: "PRIMARY_EMPLOYEE" | "PARTNER";
  employeeId: string | null;
  displayName: string | null;
  isUnknown: boolean;
};

export type ExistingWeeklyScheduleSnapshot = {
  primaryEmployeeId: string | null;
  primaryEmployeeDisplayName: string;
  primaryEmployeeKey: string;
  assignedByEmployeeId: string | null;
  assignedByDisplayName: string;
};

type PersonSnapshot = {
  employeeId: string | null;
  displayName: string | null;
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

function existingCrewMember(
  existing: ExistingAssignmentSnapshot | undefined,
  phase: "PLANNED" | "ACTUAL",
  role: "PRIMARY_EMPLOYEE" | "PARTNER",
) {
  return existing?.crewMembers.find(
    (member) => member.phase === phase && member.role === role,
  );
}

function personSnapshot(
  employeeId: string | undefined,
  employeeById: Map<string, EmployeeSnapshotSource>,
  existing: ExistingCrewMemberSnapshot | undefined,
  fallback?: PersonSnapshot,
): PersonSnapshot {
  if (employeeId) {
    if (existing?.employeeId === employeeId) {
      return {
        employeeId,
        displayName: existing.displayName,
      };
    }

    const employee = employeeById.get(employeeId);
    return {
      employeeId,
      displayName: employee?.displayName ?? null,
    };
  }

  if (existing) {
    if (existing.employeeId) {
      return fallback ?? { employeeId: null, displayName: null };
    }

    return {
      employeeId: null,
      displayName: existing.displayName,
    };
  }

  return fallback ?? { employeeId: null, displayName: null };
}

function crewMember(
  phase: "PLANNED" | "ACTUAL",
  role: "PRIMARY_EMPLOYEE" | "PARTNER",
  person: PersonSnapshot,
  isUnknown = false,
) {
  if (!person.employeeId && !person.displayName && !isUnknown) {
    return null;
  }

  return {
    phase,
    role,
    employeeId: person.employeeId,
    displayName: person.displayName,
    isUnknown,
  };
}

export function buildAssignmentCrewMembers(
  assignment: AssignmentFormInput,
  primaryEmployee: PersonSnapshot,
  employeeById: Map<string, EmployeeSnapshotSource>,
  existing?: ExistingAssignmentSnapshot,
) {
  const hasActualCrew =
    assignment.actualStatus === "SCHEDULED" ||
    Boolean(assignment.actualPrimaryEmployeeId) ||
    Boolean(assignment.actualPartnerEmployeeId) ||
    assignment.actualPartnerUnknown;

  const plannedPrimary = personSnapshot(
    assignment.plannedPrimaryEmployeeId,
    employeeById,
    existingCrewMember(existing, "PLANNED", "PRIMARY_EMPLOYEE"),
    primaryEmployee,
  );
  const plannedPartner = personSnapshot(
    assignment.plannedPartnerEmployeeId,
    employeeById,
    existingCrewMember(existing, "PLANNED", "PARTNER"),
  );
  const actualPrimary = personSnapshot(
    assignment.actualPrimaryEmployeeId,
    employeeById,
    existingCrewMember(existing, "ACTUAL", "PRIMARY_EMPLOYEE"),
    plannedPrimary,
  );
  const actualPartner = personSnapshot(
    assignment.actualPartnerEmployeeId,
    employeeById,
    existingCrewMember(existing, "ACTUAL", "PARTNER"),
  );

  return [
    crewMember("PLANNED", "PRIMARY_EMPLOYEE", plannedPrimary),
    crewMember(
      "PLANNED",
      "PARTNER",
      plannedPartner,
      assignment.plannedPartnerUnknown,
    ),
    ...(hasActualCrew
      ? [
          crewMember("ACTUAL", "PRIMARY_EMPLOYEE", actualPrimary),
          crewMember(
            "ACTUAL",
            "PARTNER",
            actualPartner,
            assignment.actualPartnerUnknown,
          ),
        ]
      : []),
  ].filter((member): member is NonNullable<typeof member> => member !== null);
}

export function buildDailyAssignmentWriteData(
  assignment: AssignmentFormInput,
  primaryEmployee: PersonSnapshot,
  equipmentById: Map<string, EquipmentSnapshotSource>,
  employeeById: Map<string, EmployeeSnapshotSource>,
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
      create: buildAssignmentCrewMembers(
        assignment,
        primaryEmployee,
        employeeById,
        existing,
      ),
    },
  };
}

export function buildWeeklyScheduleWriteData(
  input: WeeklyScheduleFormInput,
  equipmentById: Map<string, EquipmentSnapshotSource>,
  employeeById: Map<string, EmployeeSnapshotSource>,
  existing?: ExistingWeeklyScheduleSnapshot,
) {
  const weekStartDate = new Date(`${input.weekStartDate}T00:00:00.000Z`);
  const weekEndDate = new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  const selectedPrimary = input.primaryEmployeeId
    ? employeeById.get(input.primaryEmployeeId)
    : undefined;
  const selectedAssignedBy = input.assignedByEmployeeId
    ? employeeById.get(input.assignedByEmployeeId)
    : undefined;
  const primaryEmployee =
    selectedPrimary && selectedPrimary.id !== existing?.primaryEmployeeId
      ? { employeeId: selectedPrimary.id, displayName: selectedPrimary.displayName }
      : {
          employeeId: selectedPrimary?.id ?? existing?.primaryEmployeeId ?? null,
          displayName:
            existing?.primaryEmployeeDisplayName ?? selectedPrimary?.displayName ?? null,
        };
  const primaryEmployeeKey =
    existing && primaryEmployee.employeeId === existing.primaryEmployeeId
      ? existing.primaryEmployeeKey
      : normalizePrimaryEmployeeKey(primaryEmployee.displayName ?? "");
  const assignedByDisplayName =
    selectedAssignedBy && selectedAssignedBy.id !== existing?.assignedByEmployeeId
      ? selectedAssignedBy.displayName
      : existing?.assignedByDisplayName ?? selectedAssignedBy?.displayName ?? "";

  return {
    weekStartDate,
    weekEndDate,
    status: input.status,
    primaryEmployeeId: primaryEmployee.employeeId,
    primaryEmployeeDisplayName: primaryEmployee.displayName ?? "",
    primaryEmployeeKey,
    assignedByEmployeeId: selectedAssignedBy?.id ?? existing?.assignedByEmployeeId ?? null,
    assignedByDisplayName,
    receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
    sourceNote: asNullable(input.sourceNote),
    scheduleNotes: asNullable(input.scheduleNotes),
    assignments: {
      create: input.assignments.map((assignment) =>
        buildDailyAssignmentWriteData(
          assignment,
          primaryEmployee,
          equipmentById,
          employeeById,
        ),
      ),
    },
  };
}
