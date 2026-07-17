import {
  Prisma,
  type EquipmentCategory,
  type OperationalSafetyChecklistItemSection,
  type OperationalSafetyChecklistResponseCode,
  type OperationalSafetyChecklistResponseSet,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  safetyChecklistMeterMismatchMessage,
} from "./constants";
import {
  getResponseOption,
  getSafetyChecklistTemplate,
  resolveSafetyChecklistTemplate,
  type SafetyChecklistTemplateDefinition,
  type SafetyChecklistTemplateField,
} from "./templates";
import type { SafetyChecklistSubmissionInput } from "./validation";

export type SafetyChecklistEquipmentSnapshotSource = {
  id: string;
  displayName: string;
  equipmentNumber: string | null;
  category: EquipmentCategory;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  mine: {
    name: string;
    city: { name: string; state: string | null };
  };
};

export type ExistingSafetyChecklistSnapshot = {
  equipmentId: string | null;
  equipmentDisplayName: string;
  equipmentNumber: string | null;
  equipmentCategory: EquipmentCategory;
  mineName: string;
  cityName: string;
  cityState: string | null;
};

export class SafetyChecklistPersistenceError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

export function equipmentSnapshot(source: SafetyChecklistEquipmentSnapshotSource) {
  return {
    equipmentDisplayName: source.displayName,
    equipmentNumber: source.equipmentNumber,
    equipmentCategory: source.category,
    mineName: source.mine.name,
    cityName: source.mine.city.name,
    cityState: source.mine.city.state,
  };
}

export function preservedEquipmentSnapshot(existing: ExistingSafetyChecklistSnapshot) {
  return {
    equipmentDisplayName: existing.equipmentDisplayName,
    equipmentNumber: existing.equipmentNumber,
    equipmentCategory: existing.equipmentCategory,
    mineName: existing.mineName,
    cityName: existing.cityName,
    cityState: existing.cityState,
  };
}

export function responseSnapshot(
  field: SafetyChecklistTemplateField,
  responseCode: string,
) {
  const option = getResponseOption(field.responseSet, responseCode);
  if (!option) {
    throw new SafetyChecklistPersistenceError(
      `${field.label} has an invalid response.`,
      `responses.${field.key}`,
    );
  }
  return {
    itemKey: field.key,
    itemLabel: field.label,
    itemOrder: field.order,
    itemSection: field.section as OperationalSafetyChecklistItemSection,
    requiredMarker: field.marker,
    responseSet: field.responseSet as OperationalSafetyChecklistResponseSet,
    responseCode: option.value as OperationalSafetyChecklistResponseCode,
    responseLabel: option.label,
  };
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function nullable(value: string | undefined) {
  return value?.trim() || null;
}

function responseData(
  input: SafetyChecklistSubmissionInput,
  template: SafetyChecklistTemplateDefinition,
) {
  const submitted = new Map(
    input.responses.map((response) => [response.itemKey, response.responseCode]),
  );
  return template.fields.map((field) =>
    responseSnapshot(field, submitted.get(field.key) ?? ""),
  );
}

const checklistWithResponses = {
  responses: true,
} satisfies Prisma.OperationalSafetyChecklistInclude;

type ExistingChecklist = Prisma.OperationalSafetyChecklistGetPayload<{
  include: typeof checklistWithResponses;
}>;

function existingSnapshot(checklist: ExistingChecklist): ExistingSafetyChecklistSnapshot {
  return {
    equipmentId: checklist.equipmentId,
    equipmentDisplayName: checklist.equipmentDisplayName,
    equipmentNumber: checklist.equipmentNumber,
    equipmentCategory: checklist.equipmentCategory,
    mineName: checklist.mineName,
    cityName: checklist.cityName,
    cityState: checklist.cityState,
  };
}

async function loadEquipment(
  transaction: Prisma.TransactionClient,
  equipmentId: string,
) {
  return transaction.equipment.findUnique({
    where: { id: equipmentId },
    include: { mine: { include: { city: true } } },
  });
}

function resolveTemplate(
  input: SafetyChecklistSubmissionInput,
  equipment: SafetyChecklistEquipmentSnapshotSource,
  existing?: ExistingChecklist,
) {
  const equipmentUnchanged = existing?.equipmentId === equipment.id;
  const template = equipmentUnchanged
    ? getSafetyChecklistTemplate(existing.templateKey, existing.templateVersion)
    : resolveSafetyChecklistTemplate(equipment.category);

  if (!template) {
    throw new SafetyChecklistPersistenceError(
      "The selected Equipment is not eligible for an approved checklist template.",
      "equipmentId",
    );
  }
  if (input.templateKey !== template.key || input.templateVersion !== template.version) {
    throw new SafetyChecklistPersistenceError(
      "The checklist template does not match the selected Equipment.",
      "equipmentId",
    );
  }
  return template;
}

export async function persistOperationalSafetyChecklist(
  input: SafetyChecklistSubmissionInput,
  checklistId?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const loadedExisting = checklistId
      ? await transaction.operationalSafetyChecklist.findUnique({
          where: { id: checklistId },
          include: checklistWithResponses,
        })
      : undefined;

    if (checklistId && !loadedExisting) {
      throw new SafetyChecklistPersistenceError("Checklist could not be found.");
    }
    const existing = loadedExisting ?? undefined;

    const equipment = await loadEquipment(transaction, input.equipmentId);
    if (!equipment) {
      throw new SafetyChecklistPersistenceError(
        "The selected Equipment could not be found.",
        "equipmentId",
      );
    }

    const equipmentChanged = existing?.equipmentId !== equipment.id;
    if ((!existing || equipmentChanged) && equipment.status !== "ACTIVE") {
      throw new SafetyChecklistPersistenceError(
        "Select active Equipment for this checklist.",
        "equipmentId",
      );
    }

    const template = resolveTemplate(input, equipment, existing);
    const meterMismatch = safetyChecklistMeterMismatchMessage(
      equipment.category,
      input.meterKind,
    );
    const meterIdentityChanged =
      !existing || equipmentChanged || existing.meterKind !== input.meterKind;
    if (
      meterMismatch &&
      meterIdentityChanged &&
      !input.meterMismatchConfirmed
    ) {
      throw new SafetyChecklistPersistenceError(
        `${meterMismatch} Select the confirmation before saving.`,
        "meterKind",
      );
    }
    const responses = responseData(input, template);
    const snapshot =
      existing && !equipmentChanged
        ? preservedEquipmentSnapshot(existingSnapshot(existing))
        : equipmentSnapshot(equipment);

    const parentData = {
      inspectionDate: dateOnly(input.inspectionDate),
      shift: input.shift,
      equipmentId: equipment.id,
      ...snapshot,
      templateKey: template.key,
      templateVersion: template.version,
      templateName: template.name,
      meterKind: input.meterKind,
      startingMeter: input.startingMeter,
      operatorDisplayName: input.operatorDisplayName,
      supervisorDisplayName: input.supervisorDisplayName,
      problemDescription: nullable(input.problemDescription),
    };

    if (!existing) {
      return transaction.operationalSafetyChecklist.create({
        data: {
          ...parentData,
          responses: { create: responses },
        },
        select: { id: true, recordVersion: true },
      });
    }

    const templateChanged =
      existing.templateKey !== template.key || existing.templateVersion !== template.version;

    const updated = await transaction.operationalSafetyChecklist.update({
      where: { id: existing.id },
      data: {
        ...parentData,
        recordVersion: { increment: 1 },
      },
      select: { id: true, recordVersion: true },
    });

    if (templateChanged) {
      await transaction.operationalSafetyChecklistResponse.deleteMany({
        where: { operationalSafetyChecklistId: existing.id },
      });
      await transaction.operationalSafetyChecklistResponse.createMany({
        data: responses.map((response) => ({
          operationalSafetyChecklistId: existing.id,
          ...response,
        })),
      });
    } else {
      const existingByKey = new Map(
        existing.responses.map((response) => [response.itemKey, response]),
      );
      for (const response of responses) {
        const preserved = existingByKey.get(response.itemKey);
        await transaction.operationalSafetyChecklistResponse.upsert({
          where: {
            operationalSafetyChecklistId_itemKey: {
              operationalSafetyChecklistId: existing.id,
              itemKey: response.itemKey,
            },
          },
          create: {
            operationalSafetyChecklistId: existing.id,
            ...response,
          },
          update: preserved
            ? {
                responseCode: response.responseCode,
                responseLabel: response.responseLabel,
              }
            : response,
        });
      }
      await transaction.operationalSafetyChecklistResponse.deleteMany({
        where: {
          operationalSafetyChecklistId: existing.id,
          itemKey: { notIn: responses.map((response) => response.itemKey) },
        },
      });
    }

    return updated;
  });
}
