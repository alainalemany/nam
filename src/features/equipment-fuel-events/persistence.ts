import { Prisma, type EquipmentFuelType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { isFuelTypeCompatible, maxEventGallons } from "./constants";
import { equipmentFuelDateToUtc } from "./date";
import type { EquipmentFuelEventSubmissionInput } from "./validation";
import { normalizeFuelDisplayText, normalizeFuelReference } from "./validation";

export class EquipmentFuelPersistenceError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

const eventInclude = {
  tankFills: true,
} satisfies Prisma.EquipmentFuelEventInclude;

type ExistingFuelEvent = Prisma.EquipmentFuelEventGetPayload<{ include: typeof eventInclude }>;

function equipmentSnapshot(equipment: {
  displayName: string;
  equipmentNumber: string | null;
  category: ExistingFuelEvent["equipmentCategory"];
  mine: { name: string; city: { name: string; state: string | null } };
}) {
  return {
    equipmentDisplayName: equipment.displayName,
    equipmentNumber: equipment.equipmentNumber,
    equipmentCategory: equipment.category,
    mineName: equipment.mine.name,
    cityName: equipment.mine.city.name,
    cityState: equipment.mine.city.state,
  };
}

function preservedEquipmentSnapshot(existing: ExistingFuelEvent) {
  return {
    equipmentDisplayName: existing.equipmentDisplayName,
    equipmentNumber: existing.equipmentNumber,
    equipmentCategory: existing.equipmentCategory,
    mineName: existing.mineName,
    cityName: existing.cityName,
    cityState: existing.cityState,
  };
}

function tankFillData(input: EquipmentFuelEventSubmissionInput) {
  const totalGallons = input.tankFills.reduce((total, fill) => total + fill.gallons, 0);
  if (!Number.isSafeInteger(totalGallons) || totalGallons > maxEventGallons) {
    throw new EquipmentFuelPersistenceError("The delivered-gallon total exceeds the allowed maximum.", "tankFills");
  }
  return {
    totalGallons,
    fills: input.tankFills.map((fill) => ({
      sequence: fill.sequence,
      tankLabel: normalizeFuelDisplayText(fill.tankLabel),
      normalizedTankLabel: normalizeFuelReference(fill.tankLabel),
      gallons: fill.gallons,
    })),
  };
}

export async function persistEquipmentFuelEvent(
  input: EquipmentFuelEventSubmissionInput,
  eventId?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const loadedExisting = eventId
      ? await transaction.equipmentFuelEvent.findUnique({ where: { id: eventId }, include: eventInclude })
      : undefined;
    if (eventId && !loadedExisting) throw new EquipmentFuelPersistenceError("Fuel Event could not be found.");
    const existing = loadedExisting ?? undefined;

    const equipment = await transaction.equipment.findUnique({
      where: { id: input.equipmentId },
      include: { mine: { include: { city: true } } },
    });
    if (!equipment) throw new EquipmentFuelPersistenceError("The selected Equipment could not be found.", "equipmentId");
    const equipmentChanged = existing?.equipmentId !== equipment.id;
    if ((!existing || equipmentChanged) && equipment.status !== "ACTIVE") {
      throw new EquipmentFuelPersistenceError("Select active Equipment for this Fuel Event.", "equipmentId");
    }
    if (!isFuelTypeCompatible(equipment.powerType, input.fuelType as EquipmentFuelType)) {
      throw new EquipmentFuelPersistenceError("The selected fuel type is not compatible with this Equipment.", "fuelType");
    }

    const { fills, totalGallons } = tankFillData(input);
    const snapshot = existing && !equipmentChanged
      ? preservedEquipmentSnapshot(existing)
      : equipmentSnapshot(equipment);
    const parentData = {
      operationalWorkDate: equipmentFuelDateToUtc(input.operationalWorkDate),
      eventTime: input.eventTime,
      equipmentId: equipment.id,
      ...snapshot,
      fuelType: input.fuelType,
      totalGallons,
      notes: input.notes ?? null,
    };

    if (!existing) {
      return transaction.equipmentFuelEvent.create({
        data: {
          ...parentData,
          fuelServicePersonId: null,
          fuelServicePersonDisplayNameSnapshot: null,
          dailyLogActivityId: null,
          tankFills: { create: fills },
        },
        select: { id: true },
      });
    }

    await transaction.equipmentFuelEvent.update({ where: { id: existing.id }, data: parentData });
    await transaction.equipmentFuelEventTankFill.deleteMany({ where: { equipmentFuelEventId: existing.id } });
    await transaction.equipmentFuelEventTankFill.createMany({
      data: fills.map((fill) => ({ ...fill, equipmentFuelEventId: existing.id })),
    });
    return { id: existing.id };
  });
}

export async function saveFuelServicePersonReference(input: { displayName: string; active: boolean }, id?: string) {
  const displayName = normalizeFuelDisplayText(input.displayName);
  const normalizedKey = normalizeFuelReference(displayName);
  if (id) {
    return prisma.fuelServicePerson.update({ where: { id }, data: { displayName, normalizedKey, active: input.active } });
  }
  return prisma.fuelServicePerson.create({ data: { displayName, normalizedKey, active: input.active } });
}
