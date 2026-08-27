import type { Prisma } from "@prisma/client";

import { equipmentCategoryOptions } from "./constants";

export type EquipmentSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type EquipmentCategoryValue =
  (typeof equipmentCategoryOptions)[number]["value"];

export type EquipmentFilters = {
  category?: EquipmentCategoryValue;
  mineId?: string;
  q?: string;
  status?: "ACTIVE" | "INACTIVE";
};

const filterStatusValues = ["ACTIVE", "INACTIVE"] as const;

function cleanValue(value: string | string[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

function isCategory(value: string): value is EquipmentCategoryValue {
  return equipmentCategoryOptions.some((option) => option.value === value);
}

function isFilterStatus(
  value: string,
): value is NonNullable<EquipmentFilters["status"]> {
  return filterStatusValues.includes(value as (typeof filterStatusValues)[number]);
}

export function parseEquipmentFilters(
  searchParams: EquipmentSearchParams,
): EquipmentFilters {
  const category = cleanValue(searchParams.category);
  const status = cleanValue(searchParams.status);

  return {
    q: cleanValue(searchParams.q),
    mineId: cleanValue(searchParams.mineId),
    category: category && isCategory(category) ? category : undefined,
    status: status && isFilterStatus(status) ? status : undefined,
  };
}

export function hasEquipmentFilters(filters: EquipmentFilters) {
  return Object.values(filters).some(Boolean);
}

export function buildEquipmentWhere(
  filters: EquipmentFilters,
): Prisma.EquipmentWhereInput {
  const and: Prisma.EquipmentWhereInput[] = [];

  if (filters.q) {
    const text = {
      contains: filters.q,
      mode: "insensitive" as const,
    };
    and.push({
      OR: [{ displayName: text }, { equipmentNumber: text }],
    });
  }

  if (filters.category) {
    and.push({ category: filters.category });
  }

  if (filters.mineId) {
    and.push({ mineId: filters.mineId });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  return and.length > 0 ? { AND: and } : {};
}
