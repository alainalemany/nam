import { prisma } from "@/lib/prisma";

import { buildSafetyChecklistWhere, type SafetyChecklistFilters } from "./filters";
import { getSafetyChecklistTemplate, resolveSafetyChecklistTemplate } from "./templates";
import type {
  SafetyChecklistEquipmentOption,
  SafetyChecklistFormInitialValues,
} from "./types";

export async function getOperationalSafetyChecklists(
  filters: SafetyChecklistFilters = {},
) {
  const records = await prisma.operationalSafetyChecklist.findMany({
    where: buildSafetyChecklistWhere(filters),
    include: {
      responses: {
        select: { responseCode: true },
      },
    },
    orderBy: [{ inspectionDate: "desc" }, { shift: "asc" }, { createdAt: "desc" }],
  });

  return records.map((record) => ({
    ...record,
    needsRepairCount: record.responses.filter(
      (response) => response.responseCode === "NEEDS_REPAIR",
    ).length,
    previouslyNotedCount: record.responses.filter(
      (response) => response.responseCode === "PREVIOUSLY_NOTED",
    ).length,
  }));
}

export async function getOperationalSafetyChecklistById(id: string) {
  return prisma.operationalSafetyChecklist.findUnique({
    where: { id },
    include: {
      responses: { orderBy: { itemOrder: "asc" } },
    },
  });
}

function equipmentOption(
  equipment: Awaited<ReturnType<typeof loadChecklistEquipment>>[number],
  selected?: {
    id: string;
    templateKey: string;
    templateVersion: number;
  },
): SafetyChecklistEquipmentOption | null {
  const template =
    selected?.id === equipment.id
      ? getSafetyChecklistTemplate(selected.templateKey, selected.templateVersion)
      : resolveSafetyChecklistTemplate(equipment.category);
  if (!template) return null;
  return {
    id: equipment.id,
    label: `${equipment.displayName}${equipment.equipmentNumber ? ` #${equipment.equipmentNumber}` : ""} (${equipment.mine.name})`,
    displayName: equipment.displayName,
    equipmentNumber: equipment.equipmentNumber,
    category: equipment.category,
    mineName: equipment.mine.name,
    cityName: equipment.mine.city.name,
    cityState: equipment.mine.city.state,
    templateKey: template.key,
    templateVersion: template.version,
    templateName: template.name,
  };
}

async function loadChecklistEquipment(selectedEquipmentId?: string) {
  return prisma.equipment.findMany({
    where: {
      OR: [
        {
          status: "ACTIVE",
          category: { in: ["DRAGLINE", "WORK_TRUCK", "TRACTOR", "FORKLIFT"] },
        },
        ...(selectedEquipmentId ? [{ id: selectedEquipmentId }] : []),
      ],
    },
    include: { mine: { include: { city: true } } },
    orderBy: [{ mine: { name: "asc" } }, { displayName: "asc" }],
  });
}

export async function getSafetyChecklistEquipmentOptions(selected?: {
  id: string;
  templateKey: string;
  templateVersion: number;
}) {
  const equipment = await loadChecklistEquipment(selected?.id);
  return equipment
    .map((item) => equipmentOption(item, selected))
    .filter((option): option is SafetyChecklistEquipmentOption => option !== null);
}

export async function getSafetyChecklistFilterOptions() {
  const equipment = await prisma.equipment.findMany({
    where: { category: { in: ["DRAGLINE", "WORK_TRUCK", "TRACTOR", "FORKLIFT"] } },
    include: { mine: true },
    orderBy: [{ mine: { name: "asc" } }, { displayName: "asc" }],
  });
  return equipment.map((item) => ({
    id: item.id,
    label: `${item.displayName}${item.equipmentNumber ? ` #${item.equipmentNumber}` : ""} (${item.mine.name})`,
  }));
}

export function safetyChecklistToFormInitial(
  checklist: NonNullable<Awaited<ReturnType<typeof getOperationalSafetyChecklistById>>>,
): SafetyChecklistFormInitialValues {
  return {
    inspectionDate: checklist.inspectionDate.toISOString().slice(0, 10),
    shift: checklist.shift,
    equipmentId: checklist.equipmentId ?? "",
    templateKey: checklist.templateKey,
    templateVersion: checklist.templateVersion,
    startingMeter: String(checklist.startingMeter),
    operatorDisplayName: checklist.operatorDisplayName,
    supervisorDisplayName: checklist.supervisorDisplayName,
    problemDescription: checklist.problemDescription ?? "",
    responses: Object.fromEntries(
      checklist.responses.map((response) => [response.itemKey, response.responseCode]),
    ),
  };
}

export function displaySafetyChecklistDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}
