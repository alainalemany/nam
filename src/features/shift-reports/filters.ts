import type { Prisma } from "@prisma/client";

import {
  shiftReportStatusValues,
  shiftValues,
} from "./constants";

export type ShiftReportSearchParams = Record<string, string | string[] | undefined>;

export type ShiftReportStatusValue = (typeof shiftReportStatusValues)[number];
export type ShiftValue = (typeof shiftValues)[number];

export type ShiftReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  equipmentId?: string;
  q?: string;
  shift?: ShiftValue;
  status?: ShiftReportStatusValue;
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

function isStatusValue(value: string): value is ShiftReportStatusValue {
  return shiftReportStatusValues.includes(value as ShiftReportStatusValue);
}

function isShiftValue(value: string): value is ShiftValue {
  return shiftValues.includes(value as ShiftValue);
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

export function parseShiftReportFilters(
  searchParams: ShiftReportSearchParams,
): ShiftReportFilters {
  const shift = cleanValue(searchParams.shift);
  const status = cleanValue(searchParams.status);

  return {
    q: cleanValue(searchParams.q),
    dateFrom: cleanDate(searchParams.dateFrom),
    dateTo: cleanDate(searchParams.dateTo),
    equipmentId: cleanValue(searchParams.equipmentId),
    shift: shift && isShiftValue(shift) ? shift : undefined,
    status: status && isStatusValue(status) ? status : undefined,
  };
}

export function hasShiftReportFilters(filters: ShiftReportFilters) {
  return Object.values(filters).some((value) => Boolean(value));
}

export function buildShiftReportWhere(
  filters: ShiftReportFilters,
): Prisma.ShiftReportWhereInput {
  const and: Prisma.ShiftReportWhereInput[] = [];

  if (filters.q) {
    const textFilter = contains(filters.q);

    and.push({
      OR: [
        { summary: textFilter },
        { operationalNotes: textFilter },
        { location: textFilter },
        { equipment: { displayName: textFilter } },
        { equipment: { equipmentNumber: textFilter } },
      ],
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    and.push({
      reportDate: {
        ...(filters.dateFrom ? { gte: dateOnly(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: dateOnly(filters.dateTo) } : {}),
      },
    });
  }

  if (filters.shift) {
    and.push({ shift: filters.shift });
  }

  if (filters.equipmentId) {
    and.push({ equipmentId: filters.equipmentId });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  return and.length > 0 ? { AND: and } : {};
}
