import type { EquipmentFuelType, Prisma } from "@prisma/client";

import { equipmentFuelTypeValues } from "./constants";
import { equipmentFuelDateToUtc, isEquipmentFuelDateOnly } from "./date";

export type EquipmentFuelSearchParams = Record<string, string | string[] | undefined>;

export type EquipmentFuelFilters = {
  dateFrom?: string;
  dateTo?: string;
  equipmentId?: string;
  fuelType?: EquipmentFuelType;
  fuelServicePersonId?: string;
};

function clean(value: string | string[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

function cleanDate(value: string | string[] | undefined) {
  const candidate = clean(value);
  return candidate && isEquipmentFuelDateOnly(candidate) ? candidate : undefined;
}

export function parseEquipmentFuelFilters(searchParams: EquipmentFuelSearchParams): EquipmentFuelFilters {
  const fuelType = clean(searchParams.fuelType);
  return {
    dateFrom: cleanDate(searchParams.dateFrom),
    dateTo: cleanDate(searchParams.dateTo),
    equipmentId: clean(searchParams.equipmentId),
    fuelType: fuelType && equipmentFuelTypeValues.includes(fuelType as EquipmentFuelType)
      ? (fuelType as EquipmentFuelType)
      : undefined,
    fuelServicePersonId: clean(searchParams.fuelServicePersonId),
  };
}

export function hasEquipmentFuelFilters(filters: EquipmentFuelFilters) {
  return Object.values(filters).some(Boolean);
}

export function buildEquipmentFuelWhere(filters: EquipmentFuelFilters): Prisma.EquipmentFuelEventWhereInput {
  return {
    ...(filters.dateFrom || filters.dateTo
      ? {
          operationalWorkDate: {
            ...(filters.dateFrom ? { gte: equipmentFuelDateToUtc(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: equipmentFuelDateToUtc(filters.dateTo) } : {}),
          },
        }
      : {}),
    ...(filters.equipmentId ? { equipmentId: filters.equipmentId } : {}),
    ...(filters.fuelType ? { fuelType: filters.fuelType } : {}),
    ...(filters.fuelServicePersonId ? { fuelServicePersonId: filters.fuelServicePersonId } : {}),
  };
}
