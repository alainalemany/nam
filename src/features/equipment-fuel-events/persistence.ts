import { Prisma, type EquipmentFuelType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { isFuelTypeCompatible, maxEventGallons, maxFuelEventCost } from "./constants";
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

function stationSnapshot(station: {
  name: string;
  address: string | null;
  postalCode: string | null;
  city: { name: string; state: string | null };
}) {
  return {
    gasStationNameSnapshot: station.name,
    gasStationAddressSnapshot: station.address,
    gasStationCitySnapshot: station.city.name,
    gasStationStateSnapshot: station.city.state,
    gasStationPostalCodeSnapshot: station.postalCode,
  };
}

function preservedStationSnapshot(existing: ExistingFuelEvent) {
  return {
    gasStationNameSnapshot: existing.gasStationNameSnapshot,
    gasStationAddressSnapshot: existing.gasStationAddressSnapshot,
    gasStationCitySnapshot: existing.gasStationCitySnapshot,
    gasStationStateSnapshot: existing.gasStationStateSnapshot,
    gasStationPostalCodeSnapshot: existing.gasStationPostalCodeSnapshot,
  };
}

export function calculateFuelEventTotals(input: EquipmentFuelEventSubmissionInput) {
  const totalGallons = input.tankFills.reduce(
    (total, fill) => total.plus(fill.gallons),
    new Prisma.Decimal(0),
  );
  if (totalGallons.greaterThan(maxEventGallons)) {
    throw new EquipmentFuelPersistenceError(
      "The delivered-gallon total exceeds the allowed maximum.",
      "tankFills",
    );
  }
  const totalCost = input.pricePerGallon
    ? totalGallons
      .times(input.pricePerGallon)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : null;
  if (totalCost?.greaterThan(maxFuelEventCost)) {
    throw new EquipmentFuelPersistenceError(
      "Price and delivered gallons produce a total cost above the supported maximum.",
      "pricePerGallon",
    );
  }
  return { totalGallons, totalCost };
}

function tankFillData(input: EquipmentFuelEventSubmissionInput) {
  const totals = calculateFuelEventTotals(input);
  return {
    ...totals,
    fills: input.tankFills.map((fill) => ({
      sequence: fill.sequence,
      tankLabel: normalizeFuelDisplayText(fill.tankLabel),
      normalizedTankLabel: normalizeFuelReference(fill.tankLabel),
      gallons: fill.gallons,
    })),
  };
}

function requiresCompleteV2(existing: ExistingFuelEvent | undefined) {
  return !existing || Boolean(
    existing.gasStationId ||
    existing.pricePerGallon ||
    existing.totalCost ||
    existing.meterType ||
    existing.meterReading,
  );
}

function assertCompleteV2(input: EquipmentFuelEventSubmissionInput, existing?: ExistingFuelEvent) {
  const hasSubmittedV2Context = Boolean(
    input.gasStationId || input.pricePerGallon || input.meterType || input.meterReading,
  );
  if (!requiresCompleteV2(existing) && !hasSubmittedV2Context) return;
  if (!input.gasStationId) throw new EquipmentFuelPersistenceError("Gas Station is required.", "gasStationId");
  if (!input.pricePerGallon) throw new EquipmentFuelPersistenceError("Price per gallon is required.", "pricePerGallon");
  if (!input.meterType) throw new EquipmentFuelPersistenceError("Meter type is required.", "meterType");
  if ((input.meterType === "HOURS" || input.meterType === "ODOMETER") && !input.meterReading) {
    throw new EquipmentFuelPersistenceError("Meter reading is required for Hours or Odometer.", "meterReading");
  }
  if (input.meterType === "NOT_APPLICABLE" && input.meterReading) {
    throw new EquipmentFuelPersistenceError(
      "Meter reading must be blank when the meter type is Not Applicable.",
      "meterReading",
    );
  }
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
    assertCompleteV2(input, existing);

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

    const station = input.gasStationId
      ? await transaction.gasStation.findUnique({
        where: { id: input.gasStationId },
        include: { city: true },
      })
      : null;
    if (input.gasStationId && !station) {
      throw new EquipmentFuelPersistenceError("The selected Gas Station could not be found.", "gasStationId");
    }
    const stationChanged = existing?.gasStationId !== station?.id;
    if (station && (!existing || stationChanged) && !station.isActive) {
      throw new EquipmentFuelPersistenceError("Select an active Gas Station for this Fuel Event.", "gasStationId");
    }

    const { fills, totalGallons, totalCost } = tankFillData(input);
    const equipmentFields = existing && !equipmentChanged
      ? preservedEquipmentSnapshot(existing)
      : equipmentSnapshot(equipment);
    const stationFields = station
      ? existing && !stationChanged
        ? preservedStationSnapshot(existing)
        : stationSnapshot(station)
      : {
        gasStationNameSnapshot: null,
        gasStationAddressSnapshot: null,
        gasStationCitySnapshot: null,
        gasStationStateSnapshot: null,
        gasStationPostalCodeSnapshot: null,
      };
    const parentData = {
      operationalWorkDate: equipmentFuelDateToUtc(input.operationalWorkDate),
      eventTime: input.eventTime,
      equipmentId: equipment.id,
      ...equipmentFields,
      fuelType: input.fuelType,
      gasStationId: station?.id ?? null,
      ...stationFields,
      pricePerGallon: input.pricePerGallon ?? null,
      totalGallons,
      totalCost,
      meterType: input.meterType ?? null,
      meterReading: input.meterType === "NOT_APPLICABLE" ? null : input.meterReading ?? null,
      receiptReference: input.receiptReference ?? null,
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
