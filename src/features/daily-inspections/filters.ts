import type { Prisma } from "@prisma/client";

import { dailyInspectionStatusValues } from "./constants";

export type DailyInspectionSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type DailyInspectionStatusValue = (typeof dailyInspectionStatusValues)[number];

export type DailyInspectionFilters = {
  dateFrom?: string;
  dateTo?: string;
  equipmentId?: string;
  q?: string;
  status?: DailyInspectionStatusValue;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanValue(value: string | string[] | undefined) {
  const first = firstValue(value);

  if (!first) {
    return undefined;
  }

  const trimmed = first.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function cleanDate(value: string | string[] | undefined) {
  const cleaned = cleanValue(value);

  if (!cleaned || !datePattern.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function isStatusValue(value: string): value is DailyInspectionStatusValue {
  return dailyInspectionStatusValues.includes(value as DailyInspectionStatusValue);
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function contains(value: string) {
  return {
    contains: value,
    mode: "insensitive" as const,
  };
}

export function parseDailyInspectionFilters(
  searchParams: DailyInspectionSearchParams,
): DailyInspectionFilters {
  const status = cleanValue(searchParams.status);

  return {
    q: cleanValue(searchParams.q),
    dateFrom: cleanDate(searchParams.dateFrom),
    dateTo: cleanDate(searchParams.dateTo),
    equipmentId: cleanValue(searchParams.equipmentId),
    status: status && isStatusValue(status) ? status : undefined,
  };
}

export function hasDailyInspectionFilters(filters: DailyInspectionFilters) {
  return Object.values(filters).some((value) => Boolean(value));
}

export function buildDailyInspectionWhere(
  filters: DailyInspectionFilters,
): Prisma.DailyInspectionWhereInput {
  const and: Prisma.DailyInspectionWhereInput[] = [];

  if (filters.q) {
    const textFilter = contains(filters.q);

    and.push({
      OR: [
        { findings: textFilter },
        { notes: textFilter },
        { equipment: { displayName: textFilter } },
        { equipment: { equipmentNumber: textFilter } },
      ],
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    and.push({
      inspectionDate: {
        ...(filters.dateFrom ? { gte: dateOnly(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: dateOnly(filters.dateTo) } : {}),
      },
    });
  }

  if (filters.equipmentId) {
    and.push({ equipmentId: filters.equipmentId });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  return and.length > 0 ? { AND: and } : {};
}
