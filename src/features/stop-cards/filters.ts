import type { Prisma } from "@prisma/client";

import {
  stopCardCategoryValues,
  stopCardSeverityValues,
  stopCardStatusValues,
} from "./constants";

export type StopCardSearchParams = Record<string, string | string[] | undefined>;

export type StopCardCategoryValue = (typeof stopCardCategoryValues)[number];
export type StopCardSeverityValue = (typeof stopCardSeverityValues)[number];
export type StopCardStatusValue = (typeof stopCardStatusValues)[number];

export type StopCardFilters = {
  category?: StopCardCategoryValue;
  dateFrom?: string;
  dateTo?: string;
  equipmentId?: string;
  mineId?: string;
  q?: string;
  severity?: StopCardSeverityValue;
  status?: StopCardStatusValue;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const stopCardsPath = "/stop-cards";

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

function isCategoryValue(value: string): value is StopCardCategoryValue {
  return stopCardCategoryValues.includes(value as StopCardCategoryValue);
}

function isSeverityValue(value: string): value is StopCardSeverityValue {
  return stopCardSeverityValues.includes(value as StopCardSeverityValue);
}

function isStatusValue(value: string): value is StopCardStatusValue {
  return stopCardStatusValues.includes(value as StopCardStatusValue);
}

function cleanDate(value: string | string[] | undefined) {
  const cleaned = cleanValue(value);

  if (!cleaned || !datePattern.test(cleaned)) {
    return undefined;
  }

  return cleaned;
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

export function parseStopCardFilters(searchParams: StopCardSearchParams): StopCardFilters {
  const category = cleanValue(searchParams.category);
  const severity = cleanValue(searchParams.severity);
  const status = cleanValue(searchParams.status);

  return {
    q: cleanValue(searchParams.q),
    dateFrom: cleanDate(searchParams.dateFrom),
    dateTo: cleanDate(searchParams.dateTo),
    mineId: cleanValue(searchParams.mineId),
    equipmentId: cleanValue(searchParams.equipmentId),
    category: category && isCategoryValue(category) ? category : undefined,
    severity: severity && isSeverityValue(severity) ? severity : undefined,
    status: status && isStatusValue(status) ? status : undefined,
  };
}

export function hasStopCardFilters(filters: StopCardFilters) {
  return Object.values(filters).some((value) => Boolean(value));
}

export function stopCardFilterHref(
  filters: StopCardFilters,
  updates: Partial<StopCardFilters>,
) {
  const nextFilters: StopCardFilters = {
    ...filters,
    ...updates,
  };
  const params = new URLSearchParams();

  Object.entries(nextFilters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `${stopCardsPath}?${query}` : stopCardsPath;
}

export function buildStopCardWhere(filters: StopCardFilters): Prisma.StopCardWhereInput {
  const and: Prisma.StopCardWhereInput[] = [];

  if (filters.q) {
    const textFilter = contains(filters.q);

    and.push({
      OR: [
        { description: textFilter },
        { correctiveAction: textFilter },
        { location: textFilter },
        { createdBy: textFilter },
        { mine: { name: textFilter } },
        { mine: { city: { name: textFilter } } },
        { equipment: { displayName: textFilter } },
        { equipment: { equipmentNumber: textFilter } },
      ],
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    and.push({
      observationDate: {
        ...(filters.dateFrom ? { gte: dateOnly(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: dateOnly(filters.dateTo) } : {}),
      },
    });
  }

  if (filters.category) {
    and.push({ category: filters.category });
  }

  if (filters.severity) {
    and.push({ severity: filters.severity });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  if (filters.mineId) {
    and.push({ mineId: filters.mineId });
  }

  if (filters.equipmentId) {
    and.push({ equipmentId: filters.equipmentId });
  }

  return and.length > 0 ? { AND: and } : {};
}
